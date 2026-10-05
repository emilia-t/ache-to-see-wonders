import type { 
  DynamicEntitieList,
  GameConfig,
  Point,
  EntityDebugFlags,
  ServantGrid,
  Servant,
  PlayerRule,
  ServantMap,
  NeighborGrid,
  PlayerInventory,
  DroppedItemStack,
  InventoryDeathDrop,
  PlayerDeathDrop,
  ResearchEntry,
  ResearchDowngrade,
  InventoryEntry
} from '@/components/pixel_war/interface/Interface';

import {
  RESEARCH_COOLDOWN_REDUCTION_MAX,
  RESEARCH_COOLDOWN_REDUCTION_PER_LEVEL,
  RESEARCH_DEATH_KEEP_CHANCE_PER_LEVEL,
  RESEARCH_FIRE_RATE_BONUS_PER_LEVEL,
  RESEARCH_FORTRESS_ABSORB_PER_LEVEL,
  RESEARCH_HEALTH_MAX_BONUS_PER_LEVEL,
  RESEARCH_LUCKY_STAR_BONUS_PER_LEVEL,
  RESEARCH_MOVE_SPEED_BONUS_PER_LEVEL,
  RESEARCH_STAMINA_DRAIN_MIN,
  RESEARCH_STAMINA_DRAIN_REDUCTION_PER_LEVEL,
  RESEARCH_STAMINA_MAX_BONUS_PER_LEVEL,
  H_getResearchEntry,
  H_getResearchDefinition,
  H_getResearchLevel,
  H_getResearchTriggerProbability,
  H_rollResearchOptions
} from '@/components/pixel_war/class/Research/Research';

import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import {
  INVENTORY_SKILL_SLOT_COUNT,
  H_createEmptyPlayerInventory,
  H_ensurePlayerInventory,
  H_inventoryAddItem,
  H_inventoryAddSkill,
  H_inventoryAutoEquipSkill,
  H_inventoryCanAcceptItem,
  H_inventoryFindEntry,
  H_inventoryHasSkill,
  H_inventoryRemoveEntry,
  H_normalizePlayerInventory
} from '@/components/pixel_war/class/Inventory/Inventory';
import { H_getSkillByTag } from '@/components/pixel_war/registry/SkillRegistry';
import { H_getItemDefinition } from '@/components/pixel_war/registry/ItemRegistry';
import type { Skill } from '@/components/pixel_war/class/Skill/Skill';

type PlayerDodgeState = {
  start: Point;
  target: Point;
  direction: Point;
  elapsed: number;
  duration: number;
};

type PlayerDodgeAfterimage = {
  position: Point;
  age: number;
};

/**
 * 玩家运动拖尾状态(纯视觉)。
 *
 * 与 GoldenDodgeXa4 的拖尾同理,状态放在模块级 WeakMap 而不是实体字段上:
 * 单机(Worker)模式会把整个实体对象结构化克隆后由 `H_hydrateEntitySnapshot` 逐字段
 * 水合到客户端实体,会覆盖这些"只属于客户端渲染"的字段(且 `performance.now()` 在
 * Worker 与主线程不同源,时间戳会变成垃圾值);多人(Java)下发的白名单快照也不会包含它们。
 */
type PlayerMotionTrailState = {
  /** 上一次结算时刻(performance.now()) */
  lastSampleTime: number;
  /** 速度采样窗口的起点位置与时刻 */
  windowStart: Point | null;
  windowStartTime: number;
  /** 方向采样窗口的起点位置与时刻(比速度窗口更短,保证转身后朝向迅速跟上) */
  dirWindowStart: Point | null;
  dirWindowStartTime: number;
  /** 平滑后的拖尾强度(0~1,由移速换算而来) */
  strength: number;
  /**
   * 目标拖尾强度(0~1)。
   * 只在速度采样窗口结算时更新,未结算的帧继续向它平滑收敛——
   * 若每帧都重置为 0,平滑目标就会被拉成 0,拖尾几乎不可见。
   */
  targetStrength: number;
  /** 平滑后的移动方向(单位向量,世界坐标 y 轴向上) */
  direction: Point;
};

/** 每个玩家实体的运动拖尾状态(WeakMap:实体销毁时自动回收) */
const PLAYER_MOTION_TRAIL_STATES = new WeakMap<object, PlayerMotionTrailState>();

const H_createPlayerMotionTrailState = (): PlayerMotionTrailState => ({
  lastSampleTime: 0,
  windowStart: null,
  windowStartTime: 0,
  dirWindowStart: null,
  dirWindowStartTime: 0,
  strength: 0,
  targetStrength: 0,
  direction: { x: 1, y: 0 }
});

const H_getPlayerMotionTrailState = (owner: object): PlayerMotionTrailState => {
  let state = PLAYER_MOTION_TRAIL_STATES.get(owner);
  if (!state) {
    state = H_createPlayerMotionTrailState();
    PLAYER_MOTION_TRAIL_STATES.set(owner, state);
  }
  return state;
};

/** 重置玩家运动拖尾状态(重生等瞬移场景,避免把瞬移误判为高速移动) */
const H_resetPlayerMotionTrailState = (owner: object): void => {
  const state = PLAYER_MOTION_TRAIL_STATES.get(owner);
  if (!state) return;
  state.windowStart = null;
  state.lastSampleTime = 0;
  state.dirWindowStart = null;
  state.strength = 0;
  state.targetStrength = 0;
};

class PlayerDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 25;
  public static readonly HEIGHT = 25;
  public static readonly RENDER_SIZE = 21;// 身体渲染边长(仅视觉,碰撞体积仍为 WIDTH × HEIGHT)
  public static readonly MOVE_SPEED = 410;
  public static readonly MIN_MOVE_SPEED = 50;
  public static readonly HEALTH_MAX = 10;// 玩家生命值上限
  public static readonly PLAYER_MOTION_DAMPING = 8.5;// 玩家移动阻尼，值越大松手后减速越快
  public static readonly PLAYER_MOTION_TURN_RESPONSE = 10.5;// 玩家转向响应，值越大移动转向越跟手
  public static readonly playerMoveState = {W: false,A: false,S: false,D: false,Shift: false};
  public static readonly DODGE_DISTANCE = 300;// 单次的闪避距离(像素)
  public static readonly DODGE_SLIDE_DURATION = 0.2;// 闪避位移持续时间(秒)
  public static readonly DODGE_TRAIL_DURATION = 0.3;// 闪避拖影持续时间(秒)
  // 运动拖尾相关配置(纯视觉:不影响移动速度、碰撞体积与战斗数值)
  /** 拖尾起效的最小速度(px/s),低于此值视为静止、拖尾自然淡出 */
  public static readonly TRAIL_MIN_SPEED = 40;
  /** 拖尾达到最强/最长时的速度(px/s) */
  public static readonly TRAIL_FULL_SPEED = 600;
  /** 速度采样窗口(秒):取窗口内的平均位移计算速度,与绘制频率解耦 */
  public static readonly TRAIL_SAMPLE_WINDOW = 0.1;
  /**
   * 方向采样窗口(秒):比速度窗口短得多,保证转身(含 180° 掉头)后朝向迅速跟上;
   * 若方向只在速度窗口结算时更新,平滑等效时间常数会被放大到秒级。
   */
  public static readonly TRAIL_DIRECTION_WINDOW = 0.04;
  /** 单个采样窗口内位移超过该值视为瞬移(重生等),忽略该窗口 */
  public static readonly TRAIL_TELEPORT_DISTANCE = 260;
  /** 拖尾最短/最长长度(px) */
  public static readonly TRAIL_MIN_LENGTH = 24;
  public static readonly TRAIL_MAX_LENGTH = 128;
  /** 拖尾最强时的不透明度 */
  public static readonly TRAIL_MAX_ALPHA = 0.85;
  /** 拖尾强度平滑系数(1/秒,越大越跟手) */
  public static readonly TRAIL_FADE_SMOOTH = 12;
  /** 拖尾方向平滑系数(1/秒,作用于方向采样窗口的时长,越大转身越跟手) */
  public static readonly TRAIL_DIRECTION_SMOOTH = 30;
  // 疾跑与体力相关配置
  public static readonly SPRINT_SPEED_MULTIPLIER = 1.6;// 疾跑速度倍率(相对基础移动速度)
  public static readonly SPRINT_STAMINA_DRAIN_PER_SECOND = 30;// 疾跑过程中体力消耗速率(点/秒)
  public static readonly STAMINA_RECOVER_PER_SECOND = 15;// 非疾跑过程中体力恢复速率(点/秒)
  public static readonly SPRINT_LOW_STAMINA_THRESHOLD = 20;// 体力低于该值时疾跑开始逐渐减速
  public static readonly SPRINT_START_MIN_STAMINA = 20;// 体力高于该值时才能(重新)开始疾跑
  public static readonly STAMINA_EXHAUST_RECOVERY_DELAY = 5;// 体力完全耗尽后的恢复延迟(秒)，体力亏空惩罚
  /** 基础开火冷却(秒),实际冷却由专研(射速/冷却)在此基础上缩放 */
  public static readonly BASE_FIRE_COOLDOWN = 0.5;
  /** 基础体力上限(未叠加专研前) */
  public static readonly BASE_STAMINA_MAX = 100;
  /** 死亡掉落经验系数:按(等级折算总经验 + 当前经验)的该比例掉落 */
  public static readonly DEATH_DROP_COEFFICIENT = 0.6;
  /** 单次死亡掉落经验的上限(避免高等级玩家爆炸式掉落导致卡顿) */
  public static readonly DEATH_DROP_EXP_MAX = 215;
  /** 复活等待时间基准(秒):X = 3 + 等级 / 3 */
  public static readonly RESPAWN_DELAY_BASE_SECONDS = 3;
  /** 复活等待时间的等级除数(等级 / 该值向下取整) */
  public static readonly RESPAWN_DELAY_LEVEL_DIVISOR = 3;
  /** 复活等待时间上限(秒) */
  public static readonly RESPAWN_DELAY_MAX_SECONDS = 30;
  /** 玩家脱离地图范围后,每受到 1 点伤害所需的游戏刻数 */
  public static readonly OUT_OF_MAP_TICKS_PER_DAMAGE = 10;
  /** 玩家脱离地图范围后,每次结算受到的伤害值 */
  public static readonly OUT_OF_MAP_DAMAGE = 1;
  /** 玩家脱离地图范围致死时,死亡界面展示的击杀者名称 */
  public static readonly OUT_OF_MAP_KILLER_NAME = '地图边界';

  /**
   * 计算玩家死亡后的复活等待时间(秒):X = 3 + 等级 / 3。
   * 结果取整且不超过 {@link RESPAWN_DELAY_MAX_SECONDS}。
   * @param level 死亡时的游戏等级
   */
  public static getRespawnDelaySeconds(level: number): number {
    const safeLevel = Math.max(0, Math.floor(level));
    const seconds = PlayerDynamicEntity.RESPAWN_DELAY_BASE_SECONDS
      + Math.floor(safeLevel / PlayerDynamicEntity.RESPAWN_DELAY_LEVEL_DIVISOR);
    return Math.min(PlayerDynamicEntity.RESPAWN_DELAY_MAX_SECONDS, seconds);
  }

  /**
   * 获取从当前等级升到下一等级所需的游戏经验
   * 阶段规则:
   * - 0~20级:   2 × 当前等级 + 6
   * - 21~40级:  3 × 当前等级 + 6
   * - 41~60级:  5 × 当前等级 + 6
   * - 61级及以上:7 × 当前等级 + 6
   * @param level 当前游戏等级
   */
  public static getExpToNextLevel(level: number): number {
    if (level <= 20) return 2 * level + 6;
    if (level <= 40) return 3 * level + 6;
    if (level <= 60) return 5 * level + 6;
    return 7 * level + 6;
  }

  /**
   * 把「等级 + 当前经验」折算成玩家累计获得的总经验值。
   * 即:累加 0 ~ level-1 每一级所需的升级经验,再加上当前等级内已积累的经验。
   * 用于死亡掉落经验的计算(掉落量随累计总经验而非当前格内经验增长)。
   * @param level 当前游戏等级
   * @param currentExp 当前等级内已积累的经验值
   */
  public static getTotalAccumulatedExp(level: number, currentExp: number): number {
    const safeLevel = Math.max(0, Math.floor(level));
    let total = 0;
    for (let l = 0; l < safeLevel; l++) {
      total += PlayerDynamicEntity.getExpToNextLevel(l);
    }
    return total + Math.max(0, currentExp);
  }

  public moveState = {W: false,A: false,S: false,D: false,Shift: false};
  public teamId: number | null;
  public player_score: number;
  public game_level: number;// 游戏等级
  public stamina: number;// 当前体力值(0-100)
  public staminaMax: number;// 体力值上限(100)
  public isSprinting: boolean = false;// 是否处于疾跑状态
  private baseMoveSpeed: number;// 未疾跑时的基础移动速度(由从者数量决定)
  private staminaRecoveryDelayRemaining: number;// 体力亏空后等待恢复的剩余时间(秒)
  public dodgeState: PlayerDodgeState | null = null;
  public dodgeAfterimages: PlayerDodgeAfterimage[] = [];
  public readonly playerRule:PlayerRule = {
    bulletColor: 'rgba(255, 255, 255, 0.9)',
    fireCooldownNow: 0,//下一次开火还需要等待的时长(秒)
    fireCooldownMax: PlayerDynamicEntity.BASE_FIRE_COOLDOWN,//开火CD(秒,受专研缩放)
  };
  /**
   * 玩家已研究的专研项(标签 -> 等级/附带数值)。
   *
   * 由权威端(单人的 Worker / 多人的 Java 服务端)维护并随快照下发;客户端只读取用于展示。
   */
  public research: ResearchEntry[] = [];
  /**
   * 待玩家选择的专研选项(标签列表,长度通常为 3)。
   *
   * 为空表示当前没有待选界面;非空时客户端会展示全屏专研界面,玩家选择后由权威端
   * 结算并清空该字段(见 chooseResearch)。
   */
  public researchPendingOptions: string[] = [];
  /**
   * 尚未展示的专研抽取次数。
   *
   * 每次升级都会独立进行一次触发判定,成功的次数累计到这里;
   * 这样一次 gainExp 跨越多级(例如从 1 级直接升到 4 级)时,
   * 不会因为界面已经打开而漏掉后续等级的抽取机会(见 presentPendingResearchOptions)。
   */
  public researchPendingRolls: number = 0;
  /**
   * 最近一次死亡结算的明细(掉落经验/物品/技能 + 专研降级)。
   *
   * 仅用于死亡界面展示,随快照下发给本人;重生时清空。
   */
  public lastDeathReport: PlayerDeathDrop | null = null;
  /**
   * 最近一次对玩家造成伤害的来源显示名(用于死亡界面「你被 xxx 击倒了」)。
   *
   * 由权威端在施加伤害时写入(见 damageSource 模块):
   * 玩家名 / 从者所属玩家名 / NPC 类型名称 / 「地图边界」。
   */
  public lastDamagerName: string = '';
  /** 本次死亡需要等待的复活时间(秒),由死亡时的等级决定;未死亡时为 0 */
  public deathRespawnDelay: number = 0;
  /** 复活等待的剩余时间(秒),由权威端每帧递减;未死亡时为 0 */
  public deathRespawnRemaining: number = 0;
  /**
   * 地图外伤害计时(累计的游戏刻数)。
   *
   * 玩家脱离地图范围时累加,每达到 {@link OUT_OF_MAP_TICKS_PER_DAMAGE} 刻结算 1 点伤害;
   * 回到地图内或死亡时清零。
   */
  private outOfMapTickCounter: number = 0;

  private servantGrid:ServantGrid|null = null;
  private servantMap:ServantMap|null = null;
  private isme: boolean;
  /** 玩家背包:持有物品与技能,并保存 10 个技能槽的装配状态 */
  public inventory: PlayerInventory = H_createEmptyPlayerInventory();
  /**
   * 技能装配区各槽位的技能剩余CD(秒),下标与 equippedSkills 一致(0 表示就绪)。
   *
   * 该值由**权威端**(单人的 Worker / 多人的 Java 服务端)每帧写入并随快照下发,
   * 客户端只负责渲染、不自行推算,避免与权威端产生偏差。
   * 技能实例在技能注册表中共享、且冷却按持有者记录,所以必须由这一份快照字段带给客户端。
   */
  public equippedSkillCooldowns: number[] = new Array<number>(INVENTORY_SKILL_SLOT_COUNT).fill(0);
  

  constructor(
    position: Point,
    teamId: number | null,
    name: string = 'Player',
    isme: boolean = false
  ) {
    super(position, PlayerDynamicEntity.WIDTH, PlayerDynamicEntity.HEIGHT, '', name, 'player', 'player');
    // 身体显示面积缩小为 RENDER_SIZE × RENDER_SIZE,碰撞箱保持 WIDTH × HEIGHT
    this.renderWidth = PlayerDynamicEntity.RENDER_SIZE;
    this.renderHeight = PlayerDynamicEntity.RENDER_SIZE;
    this.isme = isme;
    this.fillColor = '#2d7ff9a1';
    this.minMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.maxMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.speed = PlayerDynamicEntity.MOVE_SPEED;
    this.motionAirDrag = PlayerDynamicEntity.PLAYER_MOTION_DAMPING;
    this.motionTurnResponsiveness = PlayerDynamicEntity.PLAYER_MOTION_TURN_RESPONSE;
    this.wanderRange = 0;
    this.perceptionRange = 0;
    this.health = PlayerDynamicEntity.HEALTH_MAX;
    this.healthMax = PlayerDynamicEntity.HEALTH_MAX;
    this.movementPassion = 1;
    this.teamId = teamId;
    this.player_score = 0;
    this.game_level = 0;
    this.game_exp = 0;
    this.research = [];
    this.researchPendingOptions = [];
    this.researchPendingRolls = 0;
    this.lastDeathReport = null;
    this.lastDamagerName = '';
    this.deathRespawnDelay = 0;
    this.deathRespawnRemaining = 0;
    this.outOfMapTickCounter = 0;
    this.staminaMax = PlayerDynamicEntity.BASE_STAMINA_MAX;
    this.stamina = this.staminaMax;
    this.isSprinting = false;
    this.baseMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.staminaRecoveryDelayRemaining = 0;
    /**
     * 初始化从者网格start
     */
    this.servantGrid = Array.from(
        { length: 15 },
        (_, r) =>
            Array.from(
                { length: 15 },
                (_, c) => ({
                    row: r,
                    col: c,
                    exist: false,
                    npcId: -1,
                    neighbor: [-1,-1,-1,-1,-1,-1,-1,-1] as NeighborGrid
                })
            )
    ) as unknown as ServantGrid;
    this.servantMap = new Map<number, Servant>();
    /**
     * 初始化从者网格end
     */
    this.stop();
  }

  private collidesWithStatic(newPos: Point, staticEntities: StaticEntity[]) {
    const myBox = {
      x: newPos.x - this.width / 2,
      y: newPos.y - this.height / 2,
      width: this.width,
      height: this.height,
    };

    for (const staticEntity of staticEntities) {
      const otherBox = staticEntity.collisionBox;
      const separated =
        myBox.x + myBox.width <= otherBox.x ||
        myBox.x >= otherBox.x + otherBox.width ||
        myBox.y + myBox.height <= otherBox.y ||
        myBox.y >= otherBox.y + otherBox.height;
      if (!separated) return true;
    }
    return false;
  }

  /**
   * 根据当前从者数量刷新玩家移动速度
   * 每增加一个从者移动速度降低4
   * 最低不低于MIN_MOVE_SPEED
   */
  private refreshSpeedByServantCount(): void {
    const servantCount = this.servantMap?.size ?? 0;
    const base = Math.max(
      PlayerDynamicEntity.MIN_MOVE_SPEED,
      PlayerDynamicEntity.MOVE_SPEED - servantCount * 4
    );
    // 专研"移速"按百分比提升基础移动速度
    this.baseMoveSpeed = base * this.getMoveSpeedMultiplier();
    this.speed = this.baseMoveSpeed;
  }

  /** 专研"移速"的移动速度倍率(1 表示无加成) */
  public getMoveSpeedMultiplier(): number {
    const level = H_getResearchLevel(this.research, 'move_speed');
    return 1 + RESEARCH_MOVE_SPEED_BONUS_PER_LEVEL * level;
  }

  /** 专研"射速"的开火速度倍率(1 表示无加成) */
  public getFireRateMultiplier(): number {
    const level = H_getResearchLevel(this.research, 'fire_rate');
    return 1 + RESEARCH_FIRE_RATE_BONUS_PER_LEVEL * level;
  }

  /** 专研"冷却"的技能冷却倍率(1 表示无减少,最低 0.5) */
  public getCooldownMultiplier(): number {
    const level = H_getResearchLevel(this.research, 'cooldown');
    const reduction = Math.min(
      RESEARCH_COOLDOWN_REDUCTION_MAX,
      RESEARCH_COOLDOWN_REDUCTION_PER_LEVEL * level
    );
    return 1 - reduction;
  }

  /** 当前疾跑体力消耗速率(点/秒,受专研"体力"降低) */
  private getSprintStaminaDrainPerSecond(): number {
    const level = H_getResearchLevel(this.research, 'stamina');
    return Math.max(
      RESEARCH_STAMINA_DRAIN_MIN,
      PlayerDynamicEntity.SPRINT_STAMINA_DRAIN_PER_SECOND
        - RESEARCH_STAMINA_DRAIN_REDUCTION_PER_LEVEL * level
    );
  }

  /** 专研"幸运之星"提供的战利品掉落概率加成(0~0.25) */
  public getLuckyStarBonus(): number {
    const level = H_getResearchLevel(this.research, 'lucky_star');
    return RESEARCH_LUCKY_STAR_BONUS_PER_LEVEL * level;
  }

  /** 专研"死亡不掉落"当前等级对应的保护概率(0~1) */
  public getDeathKeepChance(): number {
    const level = H_getResearchLevel(this.research, 'death_keep');
    return Math.min(1, RESEARCH_DEATH_KEEP_CHANCE_PER_LEVEL * level);
  }

  /**
   * 根据当前专研重新计算受其影响的派生属性:
   * - 生命上限(+具体数值)
   * - 体力上限(+具体数值,并同步体力上限变化量)
   * - 开火冷却(射速与冷却共同缩放)
   * - 移动速度(由 refreshSpeedByServantCount 内部应用)
   *
   * 研究升级后调用;生命/体力上限提升时把增量直接补进当前值。
   */
  public refreshResearchModifiers(): void {
    const healthLevel = H_getResearchLevel(this.research, 'health');
    const newHealthMax = PlayerDynamicEntity.HEALTH_MAX
      + RESEARCH_HEALTH_MAX_BONUS_PER_LEVEL * healthLevel;
    const healthDelta = newHealthMax - this.healthMax;
    this.healthMax = newHealthMax;
    if (healthDelta > 0 && !this.isDead) {
      this.health = Math.min(this.healthMax, this.health + healthDelta);
    }
    if (this.health > this.healthMax) this.health = this.healthMax;

    const staminaLevel = H_getResearchLevel(this.research, 'stamina');
    const newStaminaMax = PlayerDynamicEntity.BASE_STAMINA_MAX
      + RESEARCH_STAMINA_MAX_BONUS_PER_LEVEL * staminaLevel;
    const staminaDelta = newStaminaMax - this.staminaMax;
    this.staminaMax = newStaminaMax;
    if (staminaDelta > 0 && !this.isDead) {
      this.stamina = Math.min(this.staminaMax, this.stamina + staminaDelta);
    }
    if (this.stamina > this.staminaMax) this.stamina = this.staminaMax;

    // 开火冷却 = 基础冷却 ÷ 射速倍率 × 冷却倍率(两者均会缩短间隔)
    const fireRateMultiplier = this.getFireRateMultiplier();
    const cooldownMultiplier = this.getCooldownMultiplier();
    this.playerRule.fireCooldownMax = PlayerDynamicEntity.BASE_FIRE_COOLDOWN
      / fireRateMultiplier
      * cooldownMultiplier;

    this.refreshSpeedByServantCount();
  }

  /**
   * 升级时按概率触发专研:概率 p = (64 - 等级)/100,最低 5%。
   *
   * 每次升级都独立判定;判定成功的次数累计到 researchPendingRolls,
   * 再逐次展示待选项——一次跨多级升级(例如 1 级 → 4 级)时不会漏掉抽取机会。
   */
  private rollResearchOnLevelUp(): void {
    const probability = H_getResearchTriggerProbability(this.game_level);
    if (Math.random() >= probability) return;
    this.researchPendingRolls = Math.max(0, Math.floor(this.researchPendingRolls || 0)) + 1;
    this.presentPendingResearchOptions();
  }

  /**
   * 从累计的待抽取次数中取出一次生成待选研究项。
   * 已有待选项(界面尚未选择)时不重复生成,等玩家选择后由 chooseResearch 再次调用补发。
   */
  private presentPendingResearchOptions(): void {
    if (!Array.isArray(this.researchPendingOptions)) this.researchPendingOptions = [];
    if (!Array.isArray(this.research)) this.research = [];
    const remaining = Math.max(0, Math.floor(this.researchPendingRolls || 0));
    if (remaining <= 0) return;
    if (this.researchPendingOptions.length > 0) return;
    const options = H_rollResearchOptions(this.research);
    this.researchPendingRolls = remaining - 1;
    if (options.length === 0) {
      // 可研究项已全部叠满,清空剩余次数避免界面空转
      this.researchPendingRolls = 0;
      return;
    }
    this.researchPendingOptions = options;
  }

  /**
   * 玩家从待选专研项中选择一项。
   *
   * 由权威端调用(单人的 Worker / 多人的 Java 服务端),客户端只提交选择;
   * 选择成功后清空待选项,并刷新受专研影响的派生属性。
   * 若仍有跨级升级累计下来的抽取次数,立即补发下一次待选项。
   * @param tag 选中的研究项标签,必须属于当前待选项
   * @returns 是否选择成功
   */
  public chooseResearch(tag: string): boolean {
    if (!Array.isArray(this.researchPendingOptions)) this.researchPendingOptions = [];
    if (!Array.isArray(this.research)) this.research = [];
    if (!this.researchPendingOptions.includes(tag)) return false;
    this.applyResearch(tag);
    this.researchPendingOptions = [];
    // 补发跨级升级时累计的抽取机会
    this.presentPendingResearchOptions();
    return true;
  }

  /**
   * 应用一次研究:等级 +1(已持有则叠加),并刷新派生属性。
   * 传说研究项达到上限后不再提升(抽取阶段已排除)。
   */
  private applyResearch(tag: string): void {
    const definition = H_getResearchDefinition(tag);
    if (definition === null) return;
    const entry = H_getResearchEntry(this.research, tag);
    if (entry === null) {
      this.research.push({
        tag,
        level: 1,
        value: tag === 'immovable_fortress' ? RESEARCH_FORTRESS_ABSORB_PER_LEVEL : 0
      });
    } else {
      const maxLevel = definition.maxLevel;
      if (maxLevel !== null && entry.level >= maxLevel) return;
      entry.level += 1;
      if (tag === 'immovable_fortress') {
        // 研究升级时自动恢复到该等级的最大吸收值
        entry.value = RESEARCH_FORTRESS_ABSORB_PER_LEVEL * entry.level;
      }
    }
    this.refreshResearchModifiers();
  }

  /** 移除某个研究项(死亡不掉落降级至 0 / 不动堡垒吸收耗尽) */
  private removeResearch(tag: string): void {
    const index = this.research.findIndex((entry) => entry.tag === tag);
    if (index >= 0) {
      this.research.splice(index, 1);
    }
    this.refreshResearchModifiers();
  }

  /**
   * 专研"不动堡垒":玩家保持不动时吸收受到的伤害。
   * @returns 未被吸收的剩余伤害
   */
  private absorbDamageWithFortress(amount: number): number {
    const entry = H_getResearchEntry(this.research, 'immovable_fortress');
    if (entry === null || entry.level <= 0) return amount;
    // 仅在玩家保持不动时生效(移动/闪避中不吸收)
    if (this.isMoving || this.dodgeState !== null) return amount;
    const level = Math.floor(entry.level);
    let pool = Math.max(0, entry.value);
    if (pool <= 0) {
      this.removeResearch('immovable_fortress');
      return amount;
    }
    const absorbed = Math.min(pool, amount);
    pool -= absorbed;
    entry.value = pool;

    // 降级/移除判定:1 级归零即移除;≥2 级降至下一等级上限则降 1 级
    if (pool <= 0) {
      this.removeResearch('immovable_fortress');
    } else if (level >= 2 && pool <= RESEARCH_FORTRESS_ABSORB_PER_LEVEL * (level - 1)) {
      entry.level = level - 1;
    }
    return amount - absorbed;
  }

  /**
   * 更新疾跑状态与体力值
   * 疾跑必须满足：按住左Shift 且 处于移动过程中。
   * 疾跑期间体力不断消耗，非疾跑期间体力缓慢恢复；
   * 当体力低于阈值时疾跑会逐渐减速，体力耗尽后自动结束疾跑。
   * @param dt 帧间隔(秒)
   * @param isMoving 当前是否存在移动输入
   */
  private updateSprintState(dt: number, isMoving: boolean): void {
    // 疾跑触发条件：按住左Shift + 正在移动
    const wantSprint = this.moveState.Shift && isMoving;

    // 松开Shift或停止移动时，立即结束疾跑
    if (this.isSprinting && !wantSprint) {
      this.isSprinting = false;
    }

    // 体力高于阈值时才允许(重新)开始疾跑
    if (!this.isSprinting && wantSprint && this.stamina > PlayerDynamicEntity.SPRINT_START_MIN_STAMINA) {
      this.isSprinting = true;
    }

    if (this.isSprinting) {
      // 疾跑过程中不断消耗体力(消耗速率受专研"体力"降低)
      this.stamina = Math.max(
        0,
        this.stamina - this.getSprintStaminaDrainPerSecond() * dt
      );
      if (this.stamina <= 0) {
        // 体力耗尽，自动结束疾跑
        this.stamina = 0;
        this.isSprinting = false;
        // 体力完全耗尽后触发亏空惩罚：需等待延迟时间后才能开始恢复
        this.staminaRecoveryDelayRemaining = PlayerDynamicEntity.STAMINA_EXHAUST_RECOVERY_DELAY;
      }
    } else {
      // 非疾跑过程中恢复体力，但体力亏空惩罚期间暂停恢复
      if (this.staminaRecoveryDelayRemaining > 0) {
        // 惩罚倒计时，期间不恢复体力
        this.staminaRecoveryDelayRemaining = Math.max(
          0,
          this.staminaRecoveryDelayRemaining - dt
        );
      } else {
        // 惩罚结束后开始缓慢恢复体力
        this.stamina = Math.min(
          this.staminaMax,
          this.stamina + PlayerDynamicEntity.STAMINA_RECOVER_PER_SECOND * dt
        );
      }
    }

    // 根据疾跑状态与剩余体力计算当前速度倍率
    let speedMultiplier = 1;
    if (this.isSprinting) {
      const lowThreshold = PlayerDynamicEntity.SPRINT_LOW_STAMINA_THRESHOLD;
      if (this.stamina >= lowThreshold) {
        // 体力充足时保持满疾跑速度
        speedMultiplier = PlayerDynamicEntity.SPRINT_SPEED_MULTIPLIER;
      } else {
        // 体力不足时逐渐减速，直到体力归零自动结束疾跑
        const ratio = Math.max(0, this.stamina / lowThreshold);
        speedMultiplier = 1 + (PlayerDynamicEntity.SPRINT_SPEED_MULTIPLIER - 1) * ratio;
      }
    }
    this.speed = this.baseMoveSpeed * speedMultiplier;
  }

  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntitie: DynamicEntitieList,
    gameConfig: GameConfig
  ) {
    if (this.isDead) return;
    /////cd count
    this.playerRule.fireCooldownNow =  Math.max(0, this.playerRule.fireCooldownNow - dt);
    this.refreshSpeedByServantCount();

    // 技能冷却:装配区中每个技能的内置CD计时器各自由玩家推进(闪现CD即来自闪现技能)
    this.updateEquippedSkillCooldowns(dt);
    this.updateDodgeAfterimages(dt);
    /////cd count

    if (this.updateDodgeMovement(dt, staticEntities)) {
      return;
    }

    let dx = 0;
    let dy = 0;
    if (this.moveState.W) dy += 1;
    if (this.moveState.S) dy -= 1;
    if (this.moveState.A) dx -= 1;
    if (this.moveState.D) dx += 1;

    const len = Math.hypot(dx, dy);

    // 更新疾跑状态与体力值，并据此刷新当前速度
    this.updateSprintState(dt, len > 0.0001);

    if (len < 0.0001) {
      this.updateMotionVelocity(null, this.speed, dt);
    } else {
      this.updateMotionVelocity({ x: dx / len, y: dy / len }, this.speed, dt);
    }

    const displacement = this.getMotionDisplacement(dt);
    if (Math.hypot(displacement.x, displacement.y) < 0.0001) {
      this.isMoving = false;
      this.nextTarget = { ...this.position };
      this.targetHistory = [{ ...this.position }];
      this.curvePoints = [{ ...this.position }];
      this.currentCurveIndex = 0;
      return;
    }

    const nextPosX = { x: this.position.x + displacement.x, y: this.position.y };
    const nextPosY = { x: this.position.x, y: this.position.y + displacement.y };
    let moved = false;

    if (!this.collidesWithStatic(nextPosX, staticEntities)) {
      this.position.x = nextPosX.x;
      moved = true;
    } else {
      this.motionVelocity.x = 0;
    }
    if (!this.collidesWithStatic(nextPosY, staticEntities)) {
      this.position.y = nextPosY.y;
      moved = true;
    } else {
      this.motionVelocity.y = 0;
    }

    this.updateCollisionBox();
    this.isMoving = moved || this.hasMotionVelocity();
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;

    if (moved) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      this.crowdStuckTimer = 0;
      this.insideStaticBlockedTimer = 0;
      const faceLen = len > 0.0001 ? len : Math.hypot(displacement.x, displacement.y);
      this.facingDirection = len > 0.0001
        ? { x: dx / faceLen, y: dy / faceLen }
        : { x: displacement.x / faceLen, y: displacement.y / faceLen };
      this.lastMoveDirection = { ...this.facingDirection };
    }

  }

  public override updateCrowdStuckState(_dt: number) {}

  public override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }

  public override updateStayDuration(_dt: number) {}

  public override canGetNewWanderTarget(_dt: number, _staticEntities: StaticEntity[]) {
    return false;
  }

  /**
   * 受到伤害。
   *
   * 专研"不动堡垒":玩家保持不动时,先用吸收池吸收伤害,每吸收 1 点伤害吸收池 -1。
   * 吸收池归零时移除该研究项;等级 ≥ 2 时,吸收池降至下一等级上限则研究等级降 1 级。
   */
  public override applyDamage(amount: number): void {
    if (amount > 0 && !this.isDead) {
      const remaining = this.absorbDamageWithFortress(amount);
      if (remaining <= 0) return;
      super.applyDamage(remaining);
      return;
    }
    super.applyDamage(amount);
  }

  /**
   * 推进与死亡相关的玩家状态(由权威端每帧调用;即使玩家已死亡也必须调用,
   * 因为死亡期间 update() 会直接返回):
   * <ul>
   *   <li>递减复活等待时间;</li>
   *   <li>玩家位于地图范围外时,按「每 10 游戏刻 1 点伤害」结算越界惩罚。</li>
   * </ul>
   */
  public updateDeathAndOutOfMapState(dt: number, gameConfig: GameConfig): void {
    if (this.isDead) {
      // 剩余时间量化到 2 位小数。
      // 多人协议下发时本字段会被量化到 2 位小数,若权威端保留全精度残留值(例如 3.0 连续
      // 减去 0.02 后只剩 8.9e-16),客户端会读到 0 并请求复活,而权威端判定 "> 0" 拒绝,
      // 表现为"自动复活偶发失效"。统一按同一精度推进即可消除该竞态。
      this.deathRespawnRemaining = Math.max(
        0,
        Math.round((this.deathRespawnRemaining - dt) * 100) / 100
      );
      this.outOfMapTickCounter = 0;
      return;
    }
    this.updateOutOfMapDamage(gameConfig);
  }

  /** 是否可以复活:玩家已死亡,且复活等待时间已结束 */
  public canRespawnNow(): boolean {
    return this.isDead && this.deathRespawnRemaining <= 0;
  }

  /**
   * 地图外伤害:玩家离开地图范围(穿越 Curb)后,每 10 游戏刻受到 1 点伤害。
   * 伤害来源记为「地图边界」,用于死亡界面提示。
   */
  private updateOutOfMapDamage(gameConfig: GameConfig): void {
    if (this.isDead) {
      this.outOfMapTickCounter = 0;
      return;
    }
    const outside =
      this.position.x < gameConfig.worldMinX ||
      this.position.x > gameConfig.worldMaxX ||
      this.position.y < gameConfig.worldMinY ||
      this.position.y > gameConfig.worldMaxY;
    if (!outside) {
      this.outOfMapTickCounter = 0;
      return;
    }
    this.outOfMapTickCounter += 1;
    while (this.outOfMapTickCounter >= PlayerDynamicEntity.OUT_OF_MAP_TICKS_PER_DAMAGE) {
      this.outOfMapTickCounter -= PlayerDynamicEntity.OUT_OF_MAP_TICKS_PER_DAMAGE;
      this.lastDamagerName = PlayerDynamicEntity.OUT_OF_MAP_KILLER_NAME;
      this.applyDamage(PlayerDynamicEntity.OUT_OF_MAP_DAMAGE);
      if (this.isDead) {
        this.outOfMapTickCounter = 0;
        break;
      }
    }
  }

  /**
   * 增加游戏经验，经验足够时自动提升游戏等级
   * @param amount 增加的经验值
   */
  public gainExp(amount: number): void {
    if (amount <= 0 || this.isDead) return;
    this.game_exp += amount;
    // 经验足够时连续升级
    while (this.game_exp >= PlayerDynamicEntity.getExpToNextLevel(this.game_level)) {
      this.game_exp -= PlayerDynamicEntity.getExpToNextLevel(this.game_level);
      this.game_level += 1;
      // 每次升级都有概率触发专研界面
      this.rollResearchOnLevelUp();
    }
  }

  /**
   * 拾取物品检测
   * 只要背包还能容纳该物品且距离足够近即可拾取(物品进入背包,由玩家主动使用)
   * @param item 待拾取的物品实体
   * @returns 是否可以拾取
   */
  public tryPickupItem(item: ItemEntity): boolean {
    if (!item || item.isDisappearing) return false;
    // 添加碰撞/距离检测
    const distance = Math.hypot(
      this.position.x - item.position.x,
      this.position.y - item.position.y
    );
    const pickupRadius = (this.width + item.width) / 2; // 玩家和物品半径之和
    if (distance > pickupRadius) return false;
    return this.canAcceptItem(item.tag);
  }

  /**
   * 拾取物品:放入背包(可堆叠,单格上限 50)
   * @param item 待拾取的物品实体
   */
  public pickupItem(item: ItemEntity): void {
    this.acquireItem(item.tag, item.name);
  }

  ////////////////////
  // 背包与技能相关 -->
  ////////////////////

  /**
   * 获取当前有效的背包数据(发生非法/缺失时自动修复)
   */
  public getInventory(): PlayerInventory {
    this.inventory = H_ensurePlayerInventory(this.inventory);
    return this.inventory;
  }

  /**
   * 当前生效的开火技能:取技能装配区中第一个已装配的技能
   * @returns 技能实例,未装配任何技能时返回 null
   */
  /**
   * 当前生效的开火技能:取技能装配区中第一个由"开火"触发的技能
   * @returns 技能实例,未装配开火技能时返回 null
   */
  public getActiveFireSkill(): Skill | null {
    const inventory = this.getInventory();
    for (const tag of inventory.equippedSkills) {
      if (tag === null) continue;
      const skill = H_getSkillByTag(tag);
      // 仅开火技能决定开火方式(闪现技能由空格触发,不参与)
      if (skill !== null && skill.trigger === 'fire') return skill;
    }
    return null;
  }

  /**
   * 当前生效的闪现技能:取技能装配区中第一个由"闪现"触发的技能
   * 闪避能力与闪避冷却均由该技能决定(技能内置CD计时器)
   * @returns 技能实例,未装配闪现技能时返回 null
   */
  public getEquippedDodgeSkill(): Skill | null {
    const inventory = this.getInventory();
    for (const tag of inventory.equippedSkills) {
      if (tag === null) continue;
      const skill = H_getSkillByTag(tag);
      if (skill !== null && skill.trigger === 'dodge') return skill;
    }
    return null;
  }

  /**
   * 推进技能装配区中所有技能的内置CD计时器(每帧调用),并把剩余CD写入快照字段。
   * 技能冷却按玩家实体 id 分别记录,因此多个玩家装配同一技能时互不影响。
   * 同时在此推进持续型技能(如「环射烟花」的逐发扫射)。
   */
  private updateEquippedSkillCooldowns(dt: number): void {
    const inventory = this.getInventory();
    // 快照字段可能被外部赋成非数组(异常协议数据),此处自愈以免中断主循环
    if (!Array.isArray(this.equippedSkillCooldowns)) {
      this.equippedSkillCooldowns = new Array<number>(INVENTORY_SKILL_SLOT_COUNT).fill(0);
    }
    for (let slot = 0; slot < inventory.equippedSkills.length; slot++) {
      const tag = inventory.equippedSkills[slot];
      const skill = tag === null ? null : H_getSkillByTag(tag);
      if (skill === null) {
        this.equippedSkillCooldowns[slot] = 0;
        continue;
      }
      // 推进持续型技能(如「环射烟花」的逐发扫射)
      skill.tickCast(this.id, dt);
      if (!skill.hasCooldown) {
        this.equippedSkillCooldowns[slot] = 0;
        continue;
      }
      this.equippedSkillCooldowns[slot] = skill.tickCooldown(this.id, dt);
    }
  }

  /** 清空技能装配区中所有技能的内置CD与持续施法状态(重生时调用) */
  private resetEquippedSkillCooldowns(): void {
    const inventory = this.getInventory();
    if (Array.isArray(this.equippedSkillCooldowns)) {
      this.equippedSkillCooldowns.fill(0);
    }
    for (const tag of inventory.equippedSkills) {
      if (tag === null) continue;
      const skill = H_getSkillByTag(tag);
      skill?.clearCooldown(this.id);
      skill?.clearCast(this.id);
    }
  }

  /**
   * 是否已持有该技能(背包中或已装配)
   */
  public hasSkill(skillTag: string): boolean {
    return H_inventoryHasSkill(this.getInventory(), skillTag);
  }

  /**
   * 是否已装备该技能(仅看技能装配区)
   */
  public hasEquippedSkill(skillTag: string): boolean {
    return this.getInventory().equippedSkills.includes(skillTag);
  }

  /**
   * 获得一个技能(来自技能球):加入背包并自动装配到第一个空槽
   * @param skillTag 技能标签
   * @returns 调用后玩家是否持有该技能(重复获得时返回 true,但不会重复添加)
   */
  public acquireSkill(skillTag: string): boolean {
    const inventory = this.getInventory();
    const skill = H_getSkillByTag(skillTag);
    if (skill === null) return false;
    // 已持有该技能:直接视为消耗成功,避免地面堆积重复技能球
    if (H_inventoryHasSkill(inventory, skillTag)) return true;
    if (!H_inventoryAddSkill(inventory, skill)) return false;
    // 有空槽时自动装配,让玩家立刻可以使用该技能
    H_inventoryAutoEquipSkill(inventory, skillTag);
    return true;
  }

  /**
   * 判断背包是否还能容纳指定物品
   */
  public canAcceptItem(itemTag: string): boolean {
    return H_inventoryCanAcceptItem(this.getInventory(), itemTag);
  }

  /**
   * 获得物品:放入背包(自动按 50 堆叠)
   * @returns 实际放入的数量
   */
  public acquireItem(itemTag: string, itemName: string = ''): number {
    return this.acquireItemCount(itemTag, itemName, 1);
  }

  /**
   * 获得指定数量的物品:放入背包(自动按堆叠上限堆叠)
   * @param itemTag 物品标签
   * @param itemName 物品名称(为空时使用物品定义中的名称)
   * @param count 数量
   * @returns 实际放入背包的数量(背包空间不足时会小于 count)
   */
  public acquireItemCount(itemTag: string, itemName: string, count: number): number {
    if (count <= 0) return 0;
    const inventory = this.getInventory();
    const definition = H_getItemDefinition(itemTag);
    return H_inventoryAddItem(
      inventory,
      itemTag,
      itemName || definition.name,
      count,
      definition.color,
      definition.maxStack
    );
  }

  /**
   * 取出背包与技能装配区中需要掉落的内容(仅供死亡结算使用)。
   *
   * 专研"死亡不掉落"生效时,按当前等级逐条判断物品与技能是否被保护:
   * 被保护的条目留在原格子中,未被保护的按原有规则掉落;背包整体保持其余格不变。
   * @returns 背包掉落内容
   */
  private takeInventoryForDeathDrop(): InventoryDeathDrop {
    const inventory = this.getInventory();
    const keepChance = this.getDeathKeepChance();
    const itemStacks = new Map<string, DroppedItemStack>();
    const skillTags: string[] = [];

    const keptEntries: (InventoryEntry | null)[] = new Array(inventory.entries.length).fill(null);
    for (let i = 0; i < inventory.entries.length; i++) {
      const entry = inventory.entries[i];
      if (entry === null) continue;
      // 死亡不掉落:按概率保护该条目
      if (keepChance > 0 && Math.random() < keepChance) {
        keptEntries[i] = entry;
        continue;
      }
      if (entry.kind === 'item') {
        const stack = itemStacks.get(entry.tag);
        if (stack) {
          stack.count += entry.count;
        } else {
          itemStacks.set(entry.tag, { tag: entry.tag, name: entry.name, count: entry.count });
        }
        continue;
      }
      skillTags.push(entry.tag);
    }

    const keptEquipped: (string | null)[] = new Array(inventory.equippedSkills.length).fill(null);
    for (let i = 0; i < inventory.equippedSkills.length; i++) {
      const tag = inventory.equippedSkills[i];
      if (tag === null) continue;
      if (keepChance > 0 && Math.random() < keepChance) {
        keptEquipped[i] = tag;
        continue;
      }
      skillTags.push(tag);
    }

    // 重建背包:被保护的条目保留在原格,其余格清空
    const keptInventory = H_createEmptyPlayerInventory();
    keptInventory.entries = keptEntries;
    keptInventory.equippedSkills = keptEquipped;
    this.inventory = keptInventory;

    return { items: Array.from(itemStacks.values()), skillTags };
  }

  /**
   * 使用背包中的物品(按 uid 定位)
   * 物品产生效果后消耗 1 个,数量为 0 时自动移除条目。
   * @returns 是否成功使用
   */
  public useInventoryItem(uid: string): boolean {
    if (this.isDead) return false;
    const inventory = this.getInventory();
    const entry = H_inventoryFindEntry(inventory, uid);
    if (entry === null || entry.kind !== 'item') return false;

    const definition = H_getItemDefinition(entry.tag);
    if (definition.heal > 0) {
      // 满血时不消耗物品
      if (this.health >= this.healthMax) return false;
      this.health = Math.min(this.healthMax, this.health + definition.heal);
    }
    H_inventoryRemoveEntry(inventory, uid, 1);
    return true;
  }

  /**
   * 应用来自客户端提交的背包状态(装配调整/销毁等操作)
   * 客户端提交的数据一律经过规范化校验(数量/堆叠上限/槽位长度)后再使用。
   * @param rawInventory 客户端提交的背包数据
   */
  public applyInventoryState(rawInventory: unknown): void {
    this.inventory = H_normalizePlayerInventory(rawInventory);
  }

  ////////////////////
  // <-- 背包与技能相关
  ////////////////////

  ////////////////////
  // 死亡相关 -->
  ////////////////////

  /**
   * 玩家死亡事件:统一处理玩家死亡后需要做的事情
   * 具体包含:
   * - 清空背包:背包中的物品全部取出并掉落(受专研"死亡不掉落"保护的部分保留)
   * - 清空技能:技能装配区中已装配的技能与背包中的技能条目一并取出并掉落
   * - 专研惩罚:所有专研项降低 1 级,降至 0 级则直接移除该项
   * - 清空经验:按"(等级折算总经验 + 当前经验) × 掉落系数"掉落经验球,上限 215
   * - 清空等级:游戏等级归零
   * - 清空积分:击杀积分归零
   * 说明:本函数只负责修改玩家自身状态并产出掉落清单,
   * 地面实体(掉落物/技能球/经验球)由服务端依据返回值生成。
   * @returns 死亡结算结果(掉落经验值 + 掉落物品堆叠 + 掉落技能标签 + 专研降级明细)
   */
  public onDeath(): PlayerDeathDrop {
    // 死亡时清空待选的专研选项与未展示的抽取次数(死亡后不再保留专研界面)
    this.researchPendingOptions = [];
    this.researchPendingRolls = 0;

    // 复活等待时间:X = 3 + 等级 / 3(整数,上限 30 秒)。
    // 必须在等级被清零之前按「死亡时的等级」计算,否则重生等待时间恒为基础值。
    this.deathRespawnDelay = PlayerDynamicEntity.getRespawnDelaySeconds(this.game_level);
    this.deathRespawnRemaining = this.deathRespawnDelay;
    // 死亡后不再累计地图外伤害
    this.outOfMapTickCounter = 0;

    // 死亡不掉落:按当前等级决定背包条目是否被保护(读取发生在专研降级之前)
    const inventoryDrop = this.takeInventoryForDeathDrop();

    // 死亡惩罚:所有专研项降低 1 级;降至 0 级则移除该项
    const researchDowngrades: ResearchDowngrade[] = [];
    if (Array.isArray(this.research)) {
      for (const entry of [...this.research]) {
        const from = Math.max(0, Math.floor(entry.level));
        if (from <= 0) continue;
        const to = from - 1;
        if (to <= 0) {
          const index = this.research.indexOf(entry);
          if (index >= 0) this.research.splice(index, 1);
        } else {
          entry.level = to;
          if (entry.tag === 'immovable_fortress') {
            // 降级后吸收池不应超过新等级的上限
            entry.value = Math.min(entry.value, RESEARCH_FORTRESS_ABSORB_PER_LEVEL * to);
          }
        }
        researchDowngrades.push({ tag: entry.tag, from, to });
      }
      this.refreshResearchModifiers();
    }

    // 掉落经验 = (等级折算总经验 + 当前经验) × 掉落系数(向上取整),上限 215
    const totalAccumulatedExp = PlayerDynamicEntity.getTotalAccumulatedExp(this.game_level, this.game_exp);
    const droppedExp = Math.min(
      PlayerDynamicEntity.DEATH_DROP_EXP_MAX,
      Math.ceil(totalAccumulatedExp * PlayerDynamicEntity.DEATH_DROP_COEFFICIENT)
    );
    this.game_exp = 0;

    // 清空等级与击杀积分
    this.game_level = 0;
    this.player_score = 0;

    const report: PlayerDeathDrop = {
      droppedExp,
      items: inventoryDrop.items,
      skillTags: inventoryDrop.skillTags,
      researchDowngrades
    };
    // 记录本次死亡明细,供死亡界面展示(重生时清空)
    this.lastDeathReport = report;
    return report;
  }

  ////////////////////
  // <-- 死亡相关
  ////////////////////

  /**
   * 重生玩家并重置临时战斗状态
   */
  public respawn(position: Point): void {
    this.position = { ...position };
    this.nextTarget = { ...position };
    this.targetHistory = [{ ...position }];
    this.curvePoints = [{ ...position }];
    this.currentCurveIndex = 0;
    this.health = this.healthMax;
    this.isDead = false;
    this.deathEffectTimer = 0;
    this.damageFlashTimer = 0;
    this.isMoving = false;
    this.stamina = this.staminaMax;
    this.isSprinting = false;
    this.staminaRecoveryDelayRemaining = 0;
    this.dodgeState = null;
    this.dodgeAfterimages = [];
    this.playerRule.fireCooldownNow = 0;
    // 清空上一次死亡明细(死亡界面随重生关闭)
    this.lastDeathReport = null;
    this.researchPendingRolls = 0;
    // 清空死亡等待与伤害来源记录
    this.lastDamagerName = '';
    this.deathRespawnDelay = 0;
    this.deathRespawnRemaining = 0;
    this.outOfMapTickCounter = 0;
    // 重生后技能内置CD一并清空(无敌时长已从玩家规则中移除)
    this.resetEquippedSkillCooldowns();
    // 重生是瞬移,重置拖尾状态避免把瞬移当成高速移动
    H_resetPlayerMotionTrailState(this);
    this.resetServantGrid();
    this.stop();
    this.updateCollisionBox();
  }

  /**
   * 尝试闪避
   * @param direction 闪避方向向量
   */
  public tryDodge(direction: Point): boolean {
    const len = Math.hypot(direction.x, direction.y);
    if (len === 0) return false;
    return true;
  }

  private updateDodgeAfterimages(dt: number): void {
    if (this.dodgeAfterimages.length === 0) return;
    for (const afterimage of this.dodgeAfterimages) {
      afterimage.age += dt;
    }
    this.dodgeAfterimages = this.dodgeAfterimages.filter(
      afterimage => afterimage.age < PlayerDynamicEntity.DODGE_TRAIL_DURATION
    );
  }

  private addDodgeAfterimage(): void {
    this.dodgeAfterimages.unshift({
      position: { ...this.position },
      age: 0
    });
    if (this.dodgeAfterimages.length > 5) {
      this.dodgeAfterimages.length = 5;
    }
  }

  private easeDodgeProgress(t: number): number {
    const ratio = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - ratio, 3);
  }

  private getDodgeTarget(direction: Point, staticEntities: StaticEntity[]): Point | null {
    const stepCount = 12;
    for (let i = stepCount; i >= 2; i--) {
      const distance = PlayerDynamicEntity.DODGE_DISTANCE * (i / stepCount);
      const target = {
        x: this.position.x + direction.x * distance,
        y: this.position.y + direction.y * distance
      };
      if (!this.collidesWithStatic(target, staticEntities)) {
        return target;
      }
    }
    return null;
  }

  private updateDodgeMovement(dt: number, staticEntities: StaticEntity[]): boolean {
    if (!this.dodgeState) return false;

    const state = this.dodgeState;
    state.elapsed = Math.min(state.duration, state.elapsed + dt);
    const progress = this.easeDodgeProgress(state.elapsed / state.duration);
    const nextPos = {
      x: state.start.x + (state.target.x - state.start.x) * progress,
      y: state.start.y + (state.target.y - state.start.y) * progress
    };

    if (!this.collidesWithStatic(nextPos, staticEntities)) {
      this.position = nextPos;
      this.updateCollisionBox();
      this.addDodgeAfterimage();
    } else {
      this.dodgeState = null;
      return true;
    }

    this.isMoving = true;
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;
    this.noMoveDuration = 0;
    this.noMoveLastPos = { ...this.position };
    this.crowdStuckTimer = 0;
    this.insideStaticBlockedTimer = 0;
    this.facingDirection = { ...state.direction };
    this.lastMoveDirection = { ...state.direction };

    if (state.elapsed >= state.duration) {
      this.dodgeState = null;
    }
    return true;
  }

  /**
   * 执行闪避:向指定方向进行短促冲刺。
   * 闪避能力与冷却都由玩家装配区中的"闪现技能"决定(技能内置CD计时器),
   * 不再附带无敌效果——未装备闪现技能或技能处于冷却中时均不可释放。
   * @param direction 单位方向向量（不必归一化，内部会处理）
   * @param staticEntities 静态实体列表，用于碰撞检测
   */
  public dodge(direction: Point, staticEntities: StaticEntity[]): void {
    const len = Math.hypot(direction.x, direction.y);
    if (len < 0.001) return;
    const dodgeSkill = this.getEquippedDodgeSkill();
    if (dodgeSkill === null) return; // 未装备闪现技能
    if (dodgeSkill.isOnCooldown(this.id)) return; // 技能内置CD中
    if (this.dodgeState !== null) return;

    const dir = { x: direction.x / len, y: direction.y / len };
    const targetPos = this.getDodgeTarget(dir, staticEntities);
    if (targetPos === null) return;

    this.dodgeState = {
      start: { ...this.position },
      target: targetPos,
      direction: dir,
      elapsed: 0,
      duration: PlayerDynamicEntity.DODGE_SLIDE_DURATION
    };
    this.addDodgeAfterimage();
    this.facingDirection = { ...dir };
    this.lastMoveDirection = { ...dir };

    // 释放成功后进入技能内置冷却(冷却时长由技能自身 maxCooldown 与专研"冷却"共同决定)
    dodgeSkill.setCurrentCooldown(this.id, dodgeSkill.maxCooldown * this.getCooldownMultiplier());

    // （可选）重置停滞检测等状态
    this.noMoveDuration = 0;
    this.noMoveLastPos = { ...this.position };
  }

  private drawDodgeAfterimages(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number }
  ): void {
    if (this.dodgeAfterimages.length === 0) return;

    ctx.save();
    for (let i = this.dodgeAfterimages.length - 1; i >= 0; i--) {
      const afterimage = this.dodgeAfterimages[i];
      const lifeRatio = Math.max(0, 1 - afterimage.age / PlayerDynamicEntity.DODGE_TRAIL_DURATION);
      const screenPos = worldToScreen(afterimage.position.x, afterimage.position.y);
      const alpha = 0.16 * lifeRatio * (1 - i * 0.08);
      const scale = 1 + (1 - lifeRatio) * 0.35;
      // 拖影跟随身体显示尺寸(而非碰撞体积)
      const w = this.renderWidth * scale;
      const h = this.renderHeight * scale;
      ctx.fillStyle = `rgba(92, 220, 255, ${Math.max(0, alpha)})`;
      ctx.fillRect(screenPos.x - w / 2, screenPos.y - h / 2, w, h);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, alpha * 1.4)})`;
      ctx.strokeRect(screenPos.x - w / 2, screenPos.y - h / 2, w, h);
    }
    ctx.restore();
  }

  /**
   * 绘制玩家与已连接从者的外圈轮廓
   */
  private drawServantOutline(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number }
  ): void {
    if (this.servantGrid === null) return;

    const servantCellSize = 25;
    const halfCell = servantCellSize / 2;
    const occupiedCells = new Set<string>(['7,7']);
    const queue: Array<{ row: number; col: number }> = [{ row: 7, col: 7 }];
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [dr, dc] of directions) {
        const row = current.row + dr;
        const col = current.col + dc;
        if (row < 0 || row > 14 || col < 0 || col > 14) continue;

        const cellKey = `${row},${col}`;
        if (occupiedCells.has(cellKey)) continue;

        const servant = this.servantGrid[row][col];
        if (servant.exist) {
          occupiedCells.add(cellKey);
          queue.push({ row, col });
        }
      }
    }

    const hasCell = (row: number, col: number) => occupiedCells.has(`${row},${col}`);

    ctx.save();
    ctx.strokeStyle = 'rgba(1, 217, 255, 0.45)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (const cellKey of occupiedCells) {
      const [row, col] = cellKey.split(',').map(Number);
      const center = this.rowColToWorldPosition(row, col);
      if (!center) continue;

      const left = center.x - halfCell;
      const right = center.x + halfCell;
      const top = center.y + halfCell;
      const bottom = center.y - halfCell;

      if (!hasCell(row - 1, col)) {
        const start = worldToScreen(left, top);
        const end = worldToScreen(right, top);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      }
      if (!hasCell(row + 1, col)) {
        const start = worldToScreen(left, bottom);
        const end = worldToScreen(right, bottom);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      }
      if (!hasCell(row, col - 1)) {
        const start = worldToScreen(left, top);
        const end = worldToScreen(left, bottom);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      }
      if (!hasCell(row, col + 1)) {
        const start = worldToScreen(right, top);
        const end = worldToScreen(right, bottom);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * 维护运动拖尾状态(纯视觉)。
   *
   * 速度按「固定时间窗口内的平均位移」计算,与绘制频率解耦(单机 50Hz 与
   * 多人快照 25Hz 下同一速度得到同一结果);由移速换算出的"拖尾强度"再按指数平滑,
   * 保证加速/减速时辉光与长度都是平滑过渡而非突变。拖尾方向与移动方向相反。
   */
  private updateMotionTrailState(state: PlayerMotionTrailState): void {
    const now = performance.now();
    const dt = state.lastSampleTime > 0
      ? Math.min(0.1, Math.max(0, (now - state.lastSampleTime) / 1000))
      : 0;
    state.lastSampleTime = now;

    const pos = this.position;
    if (state.windowStart === null) {
      state.windowStart = { x: pos.x, y: pos.y };
      state.windowStartTime = now;
      state.dirWindowStart = { x: pos.x, y: pos.y };
      state.dirWindowStartTime = now;
    }

    // ---- 方向:用较短的独立窗口测量,并在大角度转向时直接切换 ----
    const dirElapsed = (now - state.dirWindowStartTime) / 1000;
    if (dirElapsed >= PlayerDynamicEntity.TRAIL_DIRECTION_WINDOW) {
      const dirFrom = state.dirWindowStart ?? pos;
      const dirDx = pos.x - dirFrom.x;
      const dirDy = pos.y - dirFrom.y;
      const dirMoved = Math.hypot(dirDx, dirDy);
      state.dirWindowStart = { x: pos.x, y: pos.y };
      state.dirWindowStartTime = now;

      // 只在本窗口确实发生位移且未发生瞬移时更新方向
      if (dirMoved > 0.0001 && dirMoved <= PlayerDynamicEntity.TRAIL_TELEPORT_DISTANCE) {
        const dir = { x: dirDx / dirMoved, y: dirDy / dirMoved };
        const dot = state.direction.x * dir.x + state.direction.y * dir.y;
        if (state.strength <= 0.01 || dot <= 0) {
          // 静止后重新起步,或转角 ≥ 90°(含 180° 掉头):直接切换,避免插值经过零向量
          state.direction = dir;
        } else {
          const kDir = 1 - Math.exp(-PlayerDynamicEntity.TRAIL_DIRECTION_SMOOTH * dirElapsed);
          const mixed = {
            x: state.direction.x + (dir.x - state.direction.x) * kDir,
            y: state.direction.y + (dir.y - state.direction.y) * kDir
          };
          const mixedLen = Math.hypot(mixed.x, mixed.y);
          state.direction = mixedLen > 0.0001
            ? { x: mixed.x / mixedLen, y: mixed.y / mixedLen }
            : dir;
        }
      }
    }

    let targetStrength = state.targetStrength;
    const elapsed = (now - state.windowStartTime) / 1000;
    if (elapsed >= PlayerDynamicEntity.TRAIL_SAMPLE_WINDOW) {
      const from = state.windowStart;
      const dx = pos.x - from.x;
      const dy = pos.y - from.y;
      const moved = Math.hypot(dx, dy);
      // 结算本窗口,并以当前位置开启下一个窗口
      state.windowStart = { x: pos.x, y: pos.y };
      state.windowStartTime = now;

      if (moved <= PlayerDynamicEntity.TRAIL_TELEPORT_DISTANCE) {
        const speed = moved / elapsed;
        const range = PlayerDynamicEntity.TRAIL_FULL_SPEED - PlayerDynamicEntity.TRAIL_MIN_SPEED;
        targetStrength = Math.min(1, Math.max(0, (speed - PlayerDynamicEntity.TRAIL_MIN_SPEED) / range));
        // 目标强度持久化:未结算的帧依旧朝该目标平滑收敛
        state.targetStrength = targetStrength;
      } else {
        // 瞬移:直接淡出,不留下拖尾
        H_resetPlayerMotionTrailState(this);
        return;
      }
    }

    const k = dt > 0 ? 1 - Math.exp(-PlayerDynamicEntity.TRAIL_FADE_SMOOTH * dt) : 0;
    state.strength += (targetStrength - state.strength) * k;
    if (state.strength < 0.001) state.strength = 0;
  }

  /**
   * 绘制运动拖尾:从玩家身体中心沿移动反方向延伸的辉光条,整体渲染在身体「背后」。
   * 起点放在身体中心(而非背面边缘)并且整条拖尾裁剪到身体渲染盒之外:
   * 起点连同「垂直于移动方向的切口」都被身体盒裁掉,拖尾看起来是从身体背后冒出来的,
   * 任何移动方向(尤其斜向)都不会露出切口、也不会与半透明身体重叠而透光。
   * 长度与辉光强度都由平滑后的拖尾强度决定(与移速正相关);强度归零时完全不绘制。
   */
  private drawMotionTrail(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    state: PlayerMotionTrailState
  ): void {
    const strength = state.strength;
    if (strength <= 0.01) return;

    const dirLen = Math.hypot(state.direction.x, state.direction.y);
    if (dirLen < 0.0001) return;

    const center = worldToScreen(this.position.x, this.position.y);
    // 屏幕坐标 y 轴向下、世界坐标 y 轴向上,故方向向量的 y 分量取反
    const ux = state.direction.x / dirLen;
    const uy = -state.direction.y / dirLen;
    const length = PlayerDynamicEntity.TRAIL_MIN_LENGTH
      + (PlayerDynamicEntity.TRAIL_MAX_LENGTH - PlayerDynamicEntity.TRAIL_MIN_LENGTH) * strength;
    // 拖尾方向与移动方向相反:从身体中心沿移动反方向延伸
    const tailX = center.x - ux * length;
    const tailY = center.y - uy * length;
    const alpha = PlayerDynamicEntity.TRAIL_MAX_ALPHA * strength;
    const cell = Math.max(this.renderWidth, this.renderHeight);

    ctx.save();
    // 拖尾渲染在身体「背后」:把拖尾裁剪到身体渲染盒之外。
    // 起点(以及垂直于移动方向的切口)都落在身体盒内被裁掉——
    // 斜向移动时身体盒的角点正好落在拖尾中轴线上,若起点外移到背面边缘,
    // 切口会紧贴角点且被身体盒咬出缺口,看起来像拖尾与身体脱开了。
    // 玩家身体是半透明的,重叠处也会把辉光透出来,所以必须裁剪。
    // 外接矩形 + 身体矩形取 even-odd,得到「画布内、身体盒外」的区域。
    ctx.beginPath();
    ctx.rect(0, 0, canvasSize.width, canvasSize.height);
    ctx.rect(
      center.x - this.renderWidth / 2,
      center.y - this.renderHeight / 2,
      this.renderWidth,
      this.renderHeight
    );
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    // 头部与尾部都用方头(butt):拖尾为方形条状,符合游戏的像素/方块风格
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // 外层辉光(宽度与不透明度均随速度增强)
    const glowGrad = ctx.createLinearGradient(tailX, tailY, center.x, center.y);
    glowGrad.addColorStop(0, 'rgba(120, 220, 255, 0)');
    glowGrad.addColorStop(1, `rgba(120, 220, 255, ${(0.32 * alpha).toFixed(3)})`);
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = cell * (0.95 + 0.75 * strength);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(center.x, center.y);
    ctx.stroke();

    // 内层核心拖尾
    const coreGrad = ctx.createLinearGradient(tailX, tailY, center.x, center.y);
    coreGrad.addColorStop(0, 'rgba(215, 245, 255, 0)');
    coreGrad.addColorStop(0.55, `rgba(120, 220, 255, ${(0.35 * alpha).toFixed(3)})`);
    coreGrad.addColorStop(1, `rgba(215, 245, 255, ${(0.9 * alpha).toFixed(3)})`);
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = cell * (0.45 + 0.4 * strength);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(center.x, center.y);
    ctx.stroke();

    // 残影方块(由近及远渐隐,与闪避拖影风格统一)
    // 方块跟随移动方向旋转:斜向时若保持轴对齐,方块的角会凸出拖尾条外,轮廓出现台阶
    const ghostCount = 5;
    const ghostHalf = this.renderWidth / 2;
    const ghostAngle = Math.atan2(uy, ux);
    for (let i = 1; i <= ghostCount; i++) {
      const t = i / (ghostCount + 1);
      // 按「近侧边沿落在起点后方 length*t」定位,整块残影都在该位置之后
      const ghostCenterX = center.x - ux * (length * t + ghostHalf);
      const ghostCenterY = center.y - uy * (length * t + ghostHalf);
      ctx.save();
      ctx.globalAlpha = alpha * (1 - t) * 0.4;
      ctx.fillStyle = 'rgba(92, 220, 255, 0.4)';
      ctx.translate(ghostCenterX, ghostCenterY);
      ctx.rotate(ghostAngle);
      ctx.fillRect(-this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * 绘制实体
   * @param ctx 
   * @param worldToScreen 
   * @param canvasSize 
   * @param debugFlags 
   */
  public draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    // 绘制使用渲染尺寸(仅视觉);碰撞、拾取等逻辑仍使用 this.width / this.height
    const drawW = this.renderWidth;
    const drawH = this.renderHeight;
    const halfW = drawW / 2;
    const halfH = drawH / 2;
    const left = screenPos.x - halfW;
    const top = screenPos.y - halfH;

    //this.drawServantOutline(ctx, worldToScreen);

    // 运动拖尾(纯视觉):先于身体绘制(渲染在身体背后)并裁剪到身体盒之外,
    // 速度越快辉光越强、拖尾越长,静止时自然淡出
    const trailState = H_getPlayerMotionTrailState(this);
    this.updateMotionTrailState(trailState);
    this.drawMotionTrail(ctx, worldToScreen, canvasSize, trailState);

    // 绘制本体
    if (this.texture && this.texture.loaded) {
      ctx.drawImage(this.texture.img, left, top, drawW, drawH);
    } else {
      ctx.fillStyle = this.fillColor || '#2d7ff9a1';
      ctx.fillRect(left, top, drawW, drawH);
      ctx.strokeStyle = this.strokeColor || 'rgba(1, 217, 255, 0.45)';
      ctx.strokeRect(left, top, drawW, drawH);
    }

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, drawW, drawH);
      ctx.restore();
    }

    // 玩家名称
    if(!this.isme){
      ctx.font = '12px "Microsoft YaHei"';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.name, screenPos.x, screenPos.y + halfH + 6);
    }

    /////// 调试信息start
    if (debugFlags) {
      if (debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + halfH + 20);
      }
      const debugLines: string[] = [];//顶部的属性文本
      if(debugFlags.showHealth){
        debugLines.push(`health: ${this.health.toFixed(0)}`);
      }
      if(debugFlags.showMovementSpeed){
        debugLines.push(`speed: ${this.speed.toFixed(2)}`);
      }
      if(debugFlags.showMovementPassion){
        debugLines.push(`passion: ${(this.movementPassion * 100).toFixed(1)}%`);
      }
      if (debugLines.length > 0){// 按顺序渲染多行文本
        const lineHeight = 14;
        const baseY = screenPos.y - halfH - 28; // 最靠近头部的一行
        ctx.font = '11px Consolas, "Courier New", monospace';
        ctx.fillStyle = '#87cefa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (let i = 0; i < debugLines.length; i++) {
          ctx.fillText(debugLines[i], screenPos.x, baseY - i * lineHeight);
        }
      }
      // 恢复默认文本排版设置,避免影响其他绘制
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'transparent';
      // 碰撞盒
      if (debugFlags.showCollisionBoxes) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const box = this.collisionBox;
        const topLeft = worldToScreen(box.x, box.y + box.height); // 注意Y轴转换
        const width = box.width;
        const height = box.height;
        ctx.strokeRect(topLeft.x, topLeft.y, width, height);
        ctx.restore();
      }
      // 绘制朝向调试箭头
      if (debugFlags.showFacingDirection) {
        ctx.save();
        ctx.strokeStyle = '#1e90ff';
        ctx.fillStyle = '#1e90ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        const center = worldToScreen(this.position.x, this.position.y);
        const direction = this.facingDirection;
        const dirLen = Math.hypot(direction.x, direction.y);
        if (dirLen > 0.0001){
          const unitX = direction.x / dirLen;
          const unitY = direction.y / dirLen;
          const arrowLength = Math.max(this.width, this.height) * 0.9;
          const tipCanvas = {
            x: this.position.x + unitX * arrowLength,
            y: this.position.y + unitY * arrowLength,
          };
          const tip = worldToScreen(tipCanvas.x, tipCanvas.y);

          // 箭身
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();

          // 箭头
          const headLength = 8;
          const angle = Math.atan2(tip.y - center.y, tip.x - center.x);
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(
            tip.x - headLength * Math.cos(angle - Math.PI / 6),
            tip.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            tip.x - headLength * Math.cos(angle + Math.PI / 6),
            tip.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
    /////// 调试信息end
  }

  /**
   * 重置玩家的从者网格
   */
  private resetServantGrid(): void {
    if (this.servantGrid === null) return;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        this.servantGrid[r][c] = {
          row: r,
          col: c,
          exist: false,
          npcId: -1,
          neighbor: [-1, -1, -1, -1, -1, -1, -1, -1] as NeighborGrid
        };
      }
    }
    // 重置 Map
    if (this.servantMap) {
      this.servantMap.clear();
    }
    this.refreshSpeedByServantCount();
  }
  /**
   * 获取所有从者 ID 列表
   * @returns array
   */
  public getAllServantIds(): number[] {
    if (this.servantMap === null) return [];
    return Array.from(this.servantMap.keys());
  }

  /**
   * 查询servantGrid某个格子是否占用
   * @returns boolean 返回true则允许添加
   */
  private trySetServant(row:number,col:number,npcEntityId:number): boolean {
    if(this.servantGrid === null)return false;
    if(this.servantGrid[row][col].exist === false){
      return true;
    }else{
      return false;
    }
  }

  /**
   * 添加一个servant
   * @returns boolean 返回true则添加成功
   */
  public setServant(row: number, col: number, npcEntityId: number): boolean {
    if (this.servantGrid === null || this.servantMap === null) return false;
    if (row === 7 && col === 7) return false;
    if (!this.trySetServant(row, col, npcEntityId)) return false;

    this.servantGrid[row][col].exist = true;
    this.servantGrid[row][col].npcId = npcEntityId;
    this.servantMap.set(npcEntityId, this.servantGrid[row][col]);

    // 更新邻居关系
    this.updateNeighborsForCell(row, col);
    this.refreshSpeedByServantCount();

    return true;
  }

  /**
   * 移除一个servant
   * @returns { removedRow: number; removedCol: number } | null
   */
  public removeServant(npcEntityId:number):{removedRow:number;removedCol:number}|null{
    if (this.servantGrid === null || this.servantMap === null) return null;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (this.servantGrid[r][c].npcId === npcEntityId) {
          // 记录移除位置
          const removedRow = r, removedCol = c;
          this.servantGrid[r][c].exist = false;
          this.servantGrid[r][c].npcId = -1;
          this.servantGrid[r][c].neighbor = [-1,-1,-1,-1,-1,-1,-1,-1] as NeighborGrid;
          this.servantMap.delete(npcEntityId);

          // 更新邻居关系（只更新自身及周围即可）
          this.updateNeighborsForCell(removedRow, removedCol);
          this.refreshSpeedByServantCount();
          return {removedRow,removedCol};
        }
      }
    }
    return null;
  }

  /**
   * 从指定格子开始，找出所有与玩家断连的从者并释放它们
   * @param startRow 起始行
   * @param startCol 起始列
   * @param onReleaseNpc 释放回调，用于修改外部 NPC 对象的 ownerId/teamId
   * @returns 被释放的 npcId 列表
   */
  public releaseDisconnectedServants(
    startServant: Servant,
    onReleaseNpc?: (npcId: number) => void
  ): number[] {
    if (!this.servantGrid || !this.servantMap) return [];

    const startCell = startServant;
    if (!startCell.exist || startCell.npcId === -1) return [];

    const deadServantId = startCell.npcId;
    const disconnected: number[] = [deadServantId];

    // 死亡从者自身必须先从网格移除，否则它仍会被当成桥接节点，
    // 导致被它隔开的后续从者在连通性检查中误判为仍连接玩家。
    this.removeServant(deadServantId);

    const remainingIds = Array.from(this.servantMap.keys());
    for (const id of remainingIds) {
      const servant = this.servantMap.get(id);
      if (servant && !this.isServantConnectedToPlayer(servant)) {
        disconnected.push(id);
      }
    }

    // 释放死亡从者以及所有已经无法连到玩家中心的从者。
    for (const id of disconnected) {
      if (id !== deadServantId) {
        this.removeServant(id);
      }
      if (onReleaseNpc) {
        onReleaseNpc(id);
      }
    }

    return disconnected;
  }

  /**
   * 检查某个从者是否与玩家连通（通过 neighbor 链路可达玩家中心的邻居格子）
   * @param startServant 起始从者对象
   * @returns true 表示连通
   */
  private isServantConnectedToPlayer(startServant: Servant): boolean {
    if (!this.servantMap) return false;

    // 玩家中心格子的八个邻居坐标
    const centerNeighbors: [number, number][] = [
      [6,6], [6,7], [6,8],
      [7,6],        [7,8],
      [8,6], [8,7], [8,8]
    ];

    // BFS 队列存储 npcId
    const queue: number[] = [startServant.npcId];
    const visited = new Set<number>([startServant.npcId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentServant = this.servantMap.get(currentId);
      if (!currentServant) continue;

      // 检查当前从者是否位于玩家中心的八个邻居之一
      for (const [nr, nc] of centerNeighbors) {
        if (currentServant.row === nr && currentServant.col === nc) {
          return true;
        }
      }

      // 遍历当前从者的 neighbors 数组
      for (const neighborId of currentServant.neighbor) {
        if (neighborId !== -1 && !visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    return false;
  }

  /**
   * 通过行列查询servant
   * @returns Servant|null 返回从者信息
   */
  public selectServantByRC(row: number, col: number): Servant | null {
    if (this.servantGrid === null) return null;
    if (row < 0 || row > 14 || col < 0 || col > 14) return null;
    return this.servantGrid[row][col];
  }

  /**
   * 通过npcId查询servant
   * @returns Servant|null 返回从者信息
   */
  public selectServantByID(npcEntityId: number): Servant | null {
    if (this.servantMap === null) return null;
    return this.servantMap.get(npcEntityId) || null;
  }

  /**
   * 通过传入一个世界坐标点返回servant的row和col
   * @returns {row:number,col:number} | null
   */
  public worldPositionToRowCol(worldPosition: Point): { row: number; col: number } | null {
    const deltaX = this.position.x - worldPosition.x;
    const deltaY = worldPosition.y - this.position.y;
    const halfCell = 12.5; // 格子半长（格子边长25）

    // 计算偏移量（格子索引，范围 -7..7）
    let colOffset = Math.floor((deltaX + halfCell) / 25);
    let rowOffset = Math.floor((deltaY + halfCell) / 25);

    // 检查是否超出网格范围
    if (colOffset < -7 || colOffset > 7 || rowOffset < -7 || rowOffset > 7) {
        return null;
    }

    // 偏移量到网格索引（0..14）的映射： offset = -7 → col=14, offset=0 → col=7, offset=7 → col=0
    const col = 7 - colOffset;
    const row = 7 - rowOffset;

    if (row === 7 && col === 7) {
        return null; // 中心格子不可占用
    } else {
        return { row, col };
    }
  }

  /**
   * 通过RC获得世界坐标（格子中心点）
   * @param row 行索引 0-14
   * @param col 列索引 0-14
   * @returns 世界坐标点，无效索引返回 null
   */
  public rowColToWorldPosition(row: number, col: number): Point | null {
    if (row < 0 || row > 14 || col < 0 || col > 14) {
        return null;
    }
    // 索引到偏移量的映射：offset = 7 - index
    const offsetX = col - 7;
    const offsetY = 7 - row;
    // 每个格子边长 25 像素
    const worldX = this.position.x + offsetX * 25;
    const worldY = this.position.y + offsetY * 25;
    return { x: worldX, y: worldY };
  }

  /**
   * 获取某格子八个方向的邻居 npcId 数组（顺序：左上、上、右上、左、右、左下、下、右下）
   */
  private buildNeighborForCell(row: number, col: number): NeighborGrid {
    const neighbors: number[] = [];
    const directions = [
      [-1,-1],  [-1,0],  [-1,1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
        const cell = this.servantGrid![nr][nc];
        if (cell.exist && cell.npcId !== -1) {
          neighbors.push(cell.npcId);
        } else {
          neighbors.push(-1);
        }
      } else {
        neighbors.push(-1);
      }
    }
    // 断言长度为 8 的数组为 NeighborGrid 类型
    return neighbors as NeighborGrid;
  }

  /**
   * 更新指定格子及其周围 3x3 范围内所有格子的 neighbor 信息
   */
  private updateNeighborsForCell(row: number, col: number): void {
    if (!this.servantGrid) return;
    const minRow = Math.max(0, row - 1);
    const maxRow = Math.min(14, row + 1);
    const minCol = Math.max(0, col - 1);
    const maxCol = Math.min(14, col + 1);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        this.servantGrid[r][c].neighbor = this.buildNeighborForCell(r, c);
      }
    }
  }

  /**
   * getter and setter
   */
  public getIsme():boolean{
    return this.isme;
  }
  public setIsme():void{
    return;
  }
}

export { PlayerDynamicEntity };
