/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
import type { 
  DataPackage,
  InstructObject,
  MapData,
  Point,
  TickTimer,
  GameConfig,
  PlayerDeathDrop
} from '@/components/pixel_war/interface/Interface';
import { 
  Instruct
} from '@/components/pixel_war/instruct/Instruct';
import {
  StaticEntity,
  CurbStaticEntity,
  CurbStaticEntity8Length,
  BulletDynamicEntity,
  DynamicEntity,
  NpcDynamicEntity,
  OrdinaryBulletDynamicEntity,
  LaserBulletDynamicEntity,
  PlayerDynamicEntity,
  WhitePixelEntity,
  WhitePixelVa2Entity,
  RedPixelEntity,
  SkyBluePixelEntity,
  PurpleShieldEntity,
  GoldenDodgeXa4Entity,
  PurpleFireworkOa18Entity,
  OnahauLoneLs1Entity,
  CoralRedTentacleT1Entity,
  AmberTurretAt7Entity,
  MagentaSwarmSw5Entity,
  TitaniumPrismTp9Entity,
  DodgeSkill,
  HealingGemItemEntity,
  GrenadeDynamicEntity,
  ExpOrbDynamicEntity,
  SkillOrbDynamicEntity,
  BulletOrbDynamicEntity
} from '@/components/pixel_war/class';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';

import gameConfig from '@/components/pixel_war/service/GameConfig';
import { H_rollNpcLevel } from '@/components/pixel_war/registry/NpcLevelTable';
import { H_resolveDamagerName } from '@/components/pixel_war/class/Entity/DynamicEntity/damageSource';

////////////////////
// 常量区-->
////////////////////
// 当前 Worker 实例,用于接收客户端指令并回传地图快照
const SERVICE: DedicatedWorkerGlobalScope = self;

const GCFG:GameConfig = gameConfig;

// 主循环计时器配置,interval 单位毫秒；tickTime 单位毫秒时间戳
const TICK_TIMER: TickTimer = {
  interval: 20,
  id: 0,
  status: 'initial',
  tick: {
    tickCount: 0,
    tickTime: performance.now()
  }
};
// 当前地图状态快照,包含动态实体、静态实体和物品实体列表
const MAP_DATA: MapData = {
  dynamicEntitie: {
    bulletDynamicEntitys: [],
    grenadeDynamicEntitys: [],
    npcDynamicEntitys: [],
    playerDynamicEntitys: [],
    expOrbDynamicEntitys: [],
    skillOrbDynamicEntitys: [],
    bulletOrbDynamicEntitys: []
  },
  staticEntities: [],
  itemEntities: []
};
// 可生成的 NPC 类列表
const SPAWNABLE_NPC_CLASSES = [
  RedPixelEntity,
  WhitePixelEntity,
  WhitePixelVa2Entity,
  SkyBluePixelEntity,
  PurpleShieldEntity,
  GoldenDodgeXa4Entity,
  PurpleFireworkOa18Entity,
  OnahauLoneLs1Entity,
  CoralRedTentacleT1Entity,
  AmberTurretAt7Entity,
  MagentaSwarmSw5Entity,
  TitaniumPrismTp9Entity
  // more
] as const;

// 可生成的 ITEM 类列表
const SPAWNABLE_ITEM_CLASSES = [
  HealingGemItemEntity
  // more
] as const;

// 预先计算每个 ITEM 的权重,并验证权重是否合法
const ITEM_WEIGHTS = SPAWNABLE_ITEM_CLASSES.map((ctor) => {
  const weight = (ctor as any).GENERATE_WEIGHT; // 读取静态属性
  if (typeof weight !== 'number' || weight <= 0 || weight > 1) {
    throw new Error(
      `Item class ${ctor.name} must have a static GENERATE_WEIGHT property in (0,1]`
    );
  }
  return { ctor, weight };
});

// 预先计算每个 NPC 的权重,并验证权重是否合法
const NPC_WEIGHTS = SPAWNABLE_NPC_CLASSES.map((ctor) => {
  const weight = (ctor as any).GENERATE_WEIGHT; // 读取静态属性
  if (typeof weight !== 'number' || weight <= 0 || weight > 1) {
    throw new Error(
      `NPC class ${ctor.name} must have a static GENERATE_WEIGHT property in (0,1]`
    );
  }
  return { ctor, weight };
});


////////////////////
//<--常量区
////////////////////




////////////////////
// 变量区-->
////////////////////
let lastTickTime = performance.now();
let npcSpawnHighTimer = GCFG.npcSpawnHighInterval;
let npcSpawnMediumTimer = GCFG.npcSpawnMediumInterval;
let npcSpawnLowTimer = GCFG.npcSpawnLowInterval;
let itemSpawnHighTimer = GCFG.itemSpawnHighInterval;
let itemSpawnMediumTimer = GCFG.itemSpawnMediumInterval;
let itemSpawnLowTimer = GCFG.itemSpawnLowInterval;
let staticEntitiesSent = false;
let gamePaused = false;      // 游戏逻辑是否暂停
let lastPauseState = false;  // 用于日志去重
////////////////////
//<--变量区
////////////////////

////////////////////
// 空间索引区 -->
////////////////////
/**
 * 简单网格索引，用于快速判断点是否与任何静态实体碰撞
 */
class StaticEntitySpatialGrid {
  private cellSize: number;// px
  private grid: Map<string, StaticEntity[]>;

  constructor(staticEntities: StaticEntity[], cellSize: number = 400) {
    this.cellSize = cellSize;//
    this.grid = new Map();
    for (const entity of staticEntities) {
      const box = entity.collisionBox;
      // 获取实体覆盖的所有格子（考虑可能跨格子）
      const minCellX = Math.floor(box.x / this.cellSize);
      const maxCellX = Math.floor((box.x + box.width) / this.cellSize);
      const minCellY = Math.floor(box.y / this.cellSize);
      const maxCellY = Math.floor((box.y + box.height) / this.cellSize);
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key)!.push(entity);
        }
      }
    }
  }

  //用于获取指定矩形区域内的所有静态实体
  public getEntitiesInRect(x: number, y: number, width: number, height: number): StaticEntity[] {
    const minCellX = Math.floor(x / this.cellSize);
    const maxCellX = Math.floor((x + width) / this.cellSize);
    const minCellY = Math.floor(y / this.cellSize);
    const maxCellY = Math.floor((y + height) / this.cellSize);
    const result: StaticEntity[] = [];
    const added = new Set<StaticEntity>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = `${cx},${cy}`;
        const entities = this.grid.get(key);
        if (entities) {
          for (const e of entities) {
            if (!added.has(e)) {
              added.add(e);
              result.push(e);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * 检查点 (x, y) 是否与任何静态实体碰撞（点在碰撞盒内即碰撞）
   */
  isPointColliding(x: number, y: number): boolean {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    // 检查自身及周围 8 个邻居格子（防止边界遗漏）
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const entities = this.grid.get(key);
        if (entities) {
          for (const se of entities) {
            const box = se.collisionBox;
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}

let staticEntitySpatialGrid: StaticEntitySpatialGrid | null = null;
////////////////////
//<-- 空间索引区
////////////////////

////////////////////
// 排序与碰撞检测区 -->
////////////////////

// 内省排序 (Introsort)
// 静态实体 id => 排名
const  staticEntitySortA = {
  index: {},
  sort: []
};

// 内省排序 (Introsort)
// 动态实体 id => 排名
const dynamicEntitySortB = {
  index: {},
  sort: []
};

// 合并两个有序数组：使用双指针归并，O(|A| + |B|)，不需要重新全量排序。
const entitySortC = {
  index: {},
  sort: []
}


////////////////////
//<-- 排序与碰撞检测区
////////////////////

////////////////////
// 其他函数 -->
////////////////////

const getNpcPlayerDynamicEntityList = (): (PlayerDynamicEntity | NpcDynamicEntity)[] => [
  ...MAP_DATA.dynamicEntitie.playerDynamicEntitys,
  ...MAP_DATA.dynamicEntitie.npcDynamicEntitys
];

const getNpcDynamicEntityList = (): NpcDynamicEntity[] => [
  ...MAP_DATA.dynamicEntitie.npcDynamicEntitys
];

const getPlayerDynamicEntityById = (entityId: number):PlayerDynamicEntity|null => {
  for(const player of MAP_DATA.dynamicEntitie.playerDynamicEntitys){
    if(player.id === entityId) return player;
  }
  return null;
};

const getNpcDynamicEntityById = (entityId: number): NpcDynamicEntity | null => {
  for (const npc of MAP_DATA.dynamicEntitie.npcDynamicEntitys) {
    if (npc.id === entityId) return npc;
  }
  return null;
};

const refreshPlayerMoveState = (moveState: Partial<typeof PlayerDynamicEntity.playerMoveState>, playerId: number) => {
  const player = getPlayerDynamicEntityById(playerId);
  if (player) {
    player.moveState.W = moveState.W === true;
    player.moveState.A = moveState.A === true;
    player.moveState.S = moveState.S === true;
    player.moveState.D = moveState.D === true;
    player.moveState.Shift = moveState.Shift === true;
  }
};

/**
 * 在地图范围内随机生成一个重生点(世界坐标)
 * 地图边界由 GCFG 的 worldSize/worldMinX/worldMaxX/worldMinY/worldMaxY 确定，
 * 并保留安全边距避免出生点落入边界围墙内部。
 */
const getRandomRespawnPoint = (): Point => {
  // 安全边距：玩家半尺寸 + 围墙厚度，保证出生点不压到边界围墙
  const margin = Math.max(PlayerDynamicEntity.WIDTH, PlayerDynamicEntity.HEIGHT) + 25;
  const minX = GCFG.worldMinX + margin;
  const maxX = GCFG.worldMaxX - margin;
  const minY = GCFG.worldMinY + margin;
  const maxY = GCFG.worldMaxY - margin;

  for (let i = 0; i < 30; i++) {
    const point: Point = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
    // 空间索引尚未建立(初始化阶段)时直接返回；否则避免与静态实体重叠
    if (!staticEntitySpatialGrid || !staticEntitySpatialGrid.isPointColliding(point.x, point.y)) {
      return point;
    }
  }

  // 兜底：返回地图中心
  return { x: 0, y: 0 };
};

const respawnPlayer = (playerId: number): void => {
  const player = getPlayerDynamicEntityById(playerId);
  if (!player) return;
  // 死亡等待时间(X = 3 + 等级 / 3,上限 30 秒)未结束时不允许复活
  if (!player.canRespawnNow()) return;
  player.respawn(getRandomRespawnPoint());
};

////////////////////
// <-- 其他函数
////////////////////

////////////////////
// 初始化函数区-->
////////////////////
const main = () => {
  startSetting();
  SERVICE.addEventListener('message', handleMessage);
  // 添加错误边界
  SERVICE.addEventListener('error', (error) => {
    console.error('Worker internal error:', error);
  });
  sendMapDataInitial(MAP_DATA);
};

const startSetting = () => {
  initMapData();
  runTickTimer();
};

const runTickTimer = () => {
  TICK_TIMER.status = 'running';
  lastTickTime = performance.now();
  TICK_TIMER.id = setInterval(() => {
    const now = performance.now();
    const deltaTime = Math.min(0.05, Math.max(0, (now - lastTickTime) / 1000));//转换为秒
    lastTickTime = now;
    TICK_TIMER.tick.tickCount++;
    TICK_TIMER.tick.tickTime = now;
    updateGame(deltaTime);
    sendMapDataUpdate();
  }, TICK_TIMER.interval) as unknown as number;
};

const initMapData = () => {
  const curbHalfside = GCFG.worldSize/2;          // 边界半长 (px)
  const tile = CurbStaticEntity8Length.TILE;       // 50
  const length = CurbStaticEntity8Length.LENGTH;   // 8
  const unit = tile * length;                      // 400 (单个长条覆盖长度)

  // 计算主体长条覆盖的起止范围：从 -curbHalfside + unit/2 到 curbHalfside - unit/2
  // 这样长条不会延伸到角部，为角部留出长度为 unit/2 的空隙 (即 200px)
  const start = -curbHalfside + unit / 2;
  const end = curbHalfside - unit / 2;

  // 1. 上边界 (方向 'up')，仅主体部分
  const topY = -curbHalfside - 25;
  for (let x = start; x <= end; x += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x, y: topY }, 'up'));
  }

  // 2. 下边界 (方向 'down')
  const bottomY = curbHalfside + 25;
  for (let x = start; x <= end; x += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x, y: bottomY }, 'down'));
  }

  // 3. 左边界 (方向 'left')
  const leftX = -curbHalfside - 25;
  for (let y = start; y <= end; y += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x: leftX, y }, 'left'));
  }

  // 4. 右边界 (方向 'right')
  const rightX = curbHalfside + 25;
  for (let y = start; y <= end; y += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x: rightX, y }, 'right'));
  }

  // 5. 四个角：用原有的 CurbStaticEntity（50×50）填补，确保无空隙且不重叠
  const corners = [
    { x: -curbHalfside - 25, y: -curbHalfside - 25 }, // 左上
    { x:  curbHalfside + 25, y: -curbHalfside - 25 }, // 右上
    { x: -curbHalfside - 25, y:  curbHalfside + 25 }, // 左下
    { x:  curbHalfside + 25, y:  curbHalfside + 25 }  // 右下
  ];
  for (const corner of corners) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity(corner));
  }

  // 构建静态实体空间索引(先于玩家创建，供随机出生点检测使用)
  staticEntitySpatialGrid = new StaticEntitySpatialGrid(MAP_DATA.staticEntities, 400);
  DynamicEntity.staticEntitySpatialGrid = staticEntitySpatialGrid;

  // 创建玩家实体(地图内随机出生)
  MAP_DATA.dynamicEntitie.playerDynamicEntitys.push(
    new PlayerDynamicEntity(getRandomRespawnPoint(), createTeamIdLength14(), 'Player', true)
  );
};
////////////////////
//<--初始化函数区
////////////////////

////////////////////
// 游戏逻辑区-->
////////////////////

/**
 * 创建动态更新数据包（不含静态实体）
 */
const createDynamicItemUpdateDataPackage = (): DataPackage => {
  // 构建动态更新专用的数据结构，避免携带 staticEntities
  const dynamicItemMapData = {
    dynamicEntitie: MAP_DATA.dynamicEntitie,
    itemEntities: MAP_DATA.itemEntities,
    staticEntities: []
  };
  return {
    tick: { ...TICK_TIMER.tick },
    data: {
      instructs: [Instruct.I_MapDataDynamicItemUpdate(dynamicItemMapData)]
    }
  };
};


const createTeamIdLength14 = (): number => {
  let num = Math.floor(Math.random() * 9) + 1;
  for (let i = 0; i < 13; i++) {
    num = num * 10 + Math.floor(Math.random() * 10);
  }
  return num;
};

const spawnPlayerBullet = (target: Point, playerId: number) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys.find(player => player.id === playerId);
  if (!playerEntity || playerEntity.isDead) return;
  if (playerEntity.playerRule.fireCooldownNow > 0) return;

  const dx = target.x - playerEntity.position.x;
  const dy = target.y - playerEntity.position.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return;
// 开火消耗 1 发子弹:子弹不足时无法开火(子弹由「子弹球」补充)
  if (!playerEntity.consumeBullet(1)) return;

  
  const direction = { x: dx / len, y: dy / len };
  const spawnDistance = playerEntity.width * 0.6;
  const bulletColor = playerEntity.playerRule.bulletColor;

  // 技能装配区中存在技能时,按技能方式开火(如"斜向双弹");否则使用默认单发
  const activeSkill = playerEntity.getActiveFireSkill();
  if (activeSkill !== null) {
    // 记录施法者,供技能回调生成子弹
    const ownerId = playerEntity.id;
    const teamId = playerEntity.teamId;
    activeSkill.cast({
      position: { ...playerEntity.position },
      direction,
      ownerId,
      teamId,
      bulletColor,
      spawnDistance,
      spawnBullet: (position: Point, dir: Point, color: string) => {
        MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(
          new OrdinaryBulletDynamicEntity(position, dir, ownerId, teamId, '', color)
        );
      },
      // 激光生成回调:供「激光束」等线段型技能使用
      spawnLaserBullet: (position: Point, dir: Point, color: string, options) => {
        const laser = new LaserBulletDynamicEntity(position, dir, ownerId, teamId, '', color, options);
        // 记录发射者当前坐标:供权威端每帧计算位移增量,使激光跟随发射者同步移动
        laser.laserShooterPosition = { x: playerEntity.position.x, y: playerEntity.position.y };
        MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(laser);
      }
    });
    // 开火冷却取「基础开火冷却 / 技能冷却(受专研降低) / 技能持续施法时长」的最大值,
    // 保证持续型技能(如环射烟花的逐发扫射)在扫射结束前不会被下一次开火打断
    playerEntity.playerRule.fireCooldownNow = Math.max(
      playerEntity.playerRule.fireCooldownMax,
      activeSkill.cooldown * playerEntity.getCooldownMultiplier(),
      activeSkill.getCastDuration()
    );
    return;
  }

  MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(
    new OrdinaryBulletDynamicEntity(
      {
        x: playerEntity.position.x + direction.x * spawnDistance,
        y: playerEntity.position.y + direction.y * spawnDistance,
      },
      direction,
      playerEntity.id,
      playerEntity.teamId,
      '',
      bulletColor
    )
  );
  playerEntity.playerRule.fireCooldownNow=playerEntity.playerRule.fireCooldownMax;
};

const updateItemEntityLifetimes = (deltaTime: number): boolean => {
  if (MAP_DATA.itemEntities.length === 0) return false;
  const oldLength = MAP_DATA.itemEntities.length;
  for (const item of MAP_DATA.itemEntities) {
    item.updateLifetime(deltaTime);
  }
  MAP_DATA.itemEntities = MAP_DATA.itemEntities.filter(item => !item.isReadyToRemove());
  return MAP_DATA.itemEntities.length !== oldLength;
};

// 说明:地面物品(ItemEntity)的拾取已并入统一拾取管线 updatePickups ——
// 它与经验球/技能球/子弹球实现同一套契约(getAbsorbRange / getPickupRange /
// canBeAbsorbedBy / attractTowardPlayer / absorbByPlayer),只是吸引范围为 0(不磁吸)。

const spawnBulletDynamicEntity = (bullet: BulletDynamicEntity) => {
  MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(bullet);
};

/**
 * 激光弹的持续接触计时:子弹 id -> (目标实体 id -> 已累计接触 tick 数)。
 *
 * 仅在权威端(单人的 Worker / 多人的 Java 服务端)使用,不参与渲染与协议。
 * 目标离开线段后对应条目会被清除,从而"再次接触时重新触发首次接触伤害"。
 */
const laserContactTicks = new Map<number, Map<number, number>>();

/**
 * 珊瑚红触手 NPC 的持续接触计时:NPC id -> (玩家 id -> 已累计接触 tick 数)。
 *
 * 与激光弹的持续接触计时同构(见 {@link laserContactTicks}),仅在权威端(单人的 Worker /
 * 多人的 Java 服务端)使用,不参与渲染与协议。玩家离开触手线段后对应条目会被清除,
 * 从而"再次接触时重新触发首次接触伤害"。
 */
const coralRedTentacleContactTicks = new Map<number, Map<number, number>>();

/** 点到线段的最短距离(线段退化为点时即点到点距离) */
const H_pointToSegmentDistance = (px: number, py: number, start: Point, end: Point): number => {
  const segX = end.x - start.x;
  const segY = end.y - start.y;
  const segLengthSq = segX * segX + segY * segY;
  if (segLengthSq < 1e-6) return Math.hypot(px - start.x, py - start.y);
  let t = ((px - start.x) * segX + (py - start.y) * segY) / segLengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (start.x + segX * t), py - (start.y + segY * t));
};

/**
 * 对目标施加一次子弹伤害,并结算击杀归属(玩家积分 / 幸运之星的击杀者记录)。
 * 普通子弹与激光弹共用,避免两处重复。
 */
const H_applyBulletDamage = (
  attackerOwnerId: number | null,
  attackerTeamId: number | null,
  entity: PlayerDynamicEntity | NpcDynamicEntity,
  damage: number
): void => {
  const wasAlive = !entity.isDead;
  // 记录伤害来源(用于死亡界面「你被 xxx 击倒了」)
  if (entity instanceof PlayerDynamicEntity) {
    const damagerName = H_resolveDamagerName(MAP_DATA.dynamicEntitie, attackerOwnerId);
    if (damagerName) entity.lastDamagerName = damagerName;
  }
  entity.applyDamage(damage);
  if (wasAlive && entity.isDead && entity instanceof NpcDynamicEntity && attackerOwnerId !== null) {
    const owner = getPlayerDynamicEntityById(attackerOwnerId);
    if (owner) {
      owner.player_score += entity.kill_score;
      entity.lastKillerPlayerId = owner.id;
    }
    if (attackerTeamId !== null) {
      // 玩家的从者 NPC 击杀的其他 NPC 也计入玩家的击杀分数中
      const npc = getNpcDynamicEntityById(attackerOwnerId);
      if (npc && npc.ownerId !== null) {
        const player = getPlayerDynamicEntityById(npc.ownerId);
        if (player) {
          player.player_score += entity.kill_score;
          entity.lastKillerPlayerId = player.id;
        }
      }
    }
  }
};

/**
 * 查找一束激光的发射者(玩家或 NPC,含玩家的从者 NPC)。
 *
 * 激光的 ownerId 在生成时写入:
 * <ul>
 *   <li>玩家技能「激光束」→ 玩家 id;</li>
 *   <li>幽蓝孤光(野生) → 该 NPC id;</li>
 *   <li>幽蓝孤光(从者) → 该从者 NPC 自己的 id(而非主人 id)。</li>
 * </ul>
 *
 * @returns 发射者实体;发射者不存在(已被击杀清理/断线)时返回 null
 */
const H_findLaserShooter = (
  laser: LaserBulletDynamicEntity
): PlayerDynamicEntity | NpcDynamicEntity | null => {
  if (laser.ownerId === null) return null;
  return getNpcDynamicEntityById(laser.ownerId) ?? getPlayerDynamicEntityById(laser.ownerId);
};

/**
 * 激光弹命中结算(线段型子弹)。
 *
 * <ul>
 *   <li>目标碰到线段即视为受伤(线段本身可同时命中多个目标,激光不会因命中消失);</li>
 *   <li>首次接触立即造成 1 次基础伤害;</li>
 *   <li>持续接触每累计 CONTACT_TICK_INTERVAL(20) 刻,再造成 基础伤害 × 2;</li>
 *   <li>目标离开线段后计时重置,再次接触时重新触发首次接触伤害。</li>
 * </ul>
 *
 * @returns 本帧是否发生过命中(供上层判断需要重绘/广播)
 */
const updateLaserBulletHits = (bullet: LaserBulletDynamicEntity): boolean => {
  const segment = bullet.getLaserSegment();
  const halfWidth = LaserBulletDynamicEntity.HIT_HALF_WIDTH;
  let perTarget = laserContactTicks.get(bullet.id);
  const touched = new Set<number>();
  let hitAny = false;

  for (const entity of getNpcPlayerDynamicEntityList()) {
    if (entity.isDead) continue;
    if (bullet.ownerId === entity.id) continue; // 避免自残
    if (bullet.teamId !== null && bullet.teamId === entity.teamId) continue; // 避免误伤队友
    // 敌对 NPC 发射的激光(teamId === null)不与其他敌对 NPC(teamId === null)碰撞
    if (bullet.teamId === null && entity instanceof NpcDynamicEntity && entity.teamId === null) continue;

    const distance = H_pointToSegmentDistance(
      entity.position.x,
      entity.position.y,
      segment.start,
      segment.end
    );
    const hitRadius = entity.width * 0.45 + halfWidth;
    if (distance > hitRadius) continue;

    touched.add(entity.id);
    if (perTarget === undefined) {
      perTarget = new Map<number, number>();
      laserContactTicks.set(bullet.id, perTarget);
    }

    const ticks = perTarget.get(entity.id);
    if (ticks === undefined) {
      // 首次接触:立即造成 1 次基础伤害
      perTarget.set(entity.id, 0);
      H_applyBulletDamage(bullet.ownerId, bullet.teamId, entity, bullet.damage);
      hitAny = true;
      continue;
    }

    const next = ticks + 1;
    if (next >= LaserBulletDynamicEntity.CONTACT_TICK_INTERVAL) {
      perTarget.set(entity.id, 0);
      H_applyBulletDamage(
        bullet.ownerId,
        bullet.teamId,
        entity,
        bullet.damage * LaserBulletDynamicEntity.CONTACT_DAMAGE_MULTIPLIER
      );
      hitAny = true;
    } else {
      perTarget.set(entity.id, next);
    }
  }

  // 离开线段的目标重置计时
  if (perTarget !== undefined) {
    for (const id of Array.from(perTarget.keys())) {
      if (!touched.has(id)) perTarget.delete(id);
    }
  }
  return hitAny;
};

/**
 * 珊瑚红触手(CoralRedTentacleT1Entity)的触手命中结算。
 *
 * <p>触手不是独立实体,而是 NPC 自身的一条线段:起点 = 本体中心(故随本体移动),
 * 方向以本体为中心顺时针旋转(角度由 tentacleTicks 派生)、长度随等级成长。</p>
 *
 * <ul>
 *   <li>玩家目标:触碰线段即受伤(触手不会因命中消失);</li>
 *   <li>NPC 目标:仅当该触手已被玩家吸附为从者时才会攻击 —— 野生触手只打玩家,
 *       避免野生 NPC 之间互相残杀;从者触手可攻击其他野生 NPC 与其他玩家的从者;</li>
 *   <li>首次接触立即造成 1 点伤害;</li>
 *   <li>持续接触每累计 TENTACLE_CONTACT_TICK_INTERVAL(10) 刻再造成 1 点伤害;</li>
 *   <li>离开线段后计时重置,再次接触时重新触发首次接触伤害;</li>
 *   <li>该 NPC 被吸附为从者时不对主人造成伤害(同队玩家/从者同样不受伤)。</li>
 * </ul>
 */
const updateCoralRedTentacleHits = (): void => {
  const npcList = MAP_DATA.dynamicEntitie.npcDynamicEntitys;

  // 清理已消失 NPC 的持续接触计时,避免长期运行下残留无用条目
  if (coralRedTentacleContactTicks.size > 0) {
    const aliveIds = new Set(npcList.map((npc) => npc.id));
    for (const id of Array.from(coralRedTentacleContactTicks.keys())) {
      if (!aliveIds.has(id)) coralRedTentacleContactTicks.delete(id);
    }
  }

  for (const npc of npcList) {
    if (!(npc instanceof CoralRedTentacleT1Entity)) continue;
    if (npc.isDead) {
      coralRedTentacleContactTicks.delete(npc.id);
      continue;
    }

    const segment = npc.getTentacleSegment();
    const hitRadius = CoralRedTentacleT1Entity.TENTACLE_HALF_WIDTH;
    let perTarget = coralRedTentacleContactTicks.get(npc.id);
    const touched = new Set<number>();

    // 玩家目标:触碰线段即受伤
    for (const player of MAP_DATA.dynamicEntitie.playerDynamicEntitys) {
      if (player.isDead) continue;
      // 从者特例:被吸附为从者后不能伤害主人
      if (npc.ownerId !== null && npc.ownerId === player.id) continue;
      // 不误伤同队玩家(从者的 teamId 会被同步为主人的队伍)
      if (npc.teamId !== null && npc.teamId === player.teamId) continue;

      perTarget = H_applyTentacleContact(npc, player, perTarget, segment, touched);
    }

    // NPC 目标:仅从者状态的触手攻击 NPC(野生触手保持"只打玩家")
    if (npc.ownerId !== null) {
      for (const other of npcList) {
        if (other === npc || other.isDead) continue;
        // 不误伤同队 NPC(同主人的其他从者 teamId 相同)
        if (npc.teamId !== null && other.teamId !== null && npc.teamId === other.teamId) continue;
        // 同一主人的其他从者同样不受伤(兜底:个别实体的 teamId 可能尚未同步)
        if (other.ownerId !== null && other.ownerId === npc.ownerId) continue;

        perTarget = H_applyTentacleContact(npc, other, perTarget, segment, touched);
      }
    }

    // 离开线段的目标重置计时
    if (perTarget !== undefined) {
      for (const id of Array.from(perTarget.keys())) {
        if (!touched.has(id)) perTarget.delete(id);
      }
    }
  }
};

/**
 * 结算触手与某个目标的单次接触:命中则累加接触刻数,并在首次接触 / 每累计
 * TENTACLE_CONTACT_TICK_INTERVAL 刻施加一次伤害。
 *
 * @returns 更新后的持续接触计时表(首次命中时才创建)
 */
const H_applyTentacleContact = (
  tentacleNpc: CoralRedTentacleT1Entity,
  target: PlayerDynamicEntity | NpcDynamicEntity,
  perTarget: Map<number, number> | undefined,
  segment: { start: Point; end: Point },
  touched: Set<number>
): Map<number, number> | undefined => {
  const distance = H_pointToSegmentDistance(
    target.position.x,
    target.position.y,
    segment.start,
    segment.end
  );
  if (distance > target.width * 0.45 + CoralRedTentacleT1Entity.TENTACLE_HALF_WIDTH) {
    return perTarget;
  }

  touched.add(target.id);
  let table = perTarget;
  if (table === undefined) {
    table = new Map<number, number>();
    coralRedTentacleContactTicks.set(tentacleNpc.id, table);
  }

  const ticks = table.get(target.id);
  if (ticks === undefined) {
    // 首次接触:立即造成 1 次伤害
    table.set(target.id, 0);
    H_applyBulletDamage(tentacleNpc.id, tentacleNpc.teamId, target, CoralRedTentacleT1Entity.TENTACLE_DAMAGE);
    return table;
  }

  const next = ticks + 1;
  if (next >= CoralRedTentacleT1Entity.TENTACLE_CONTACT_TICK_INTERVAL) {
    table.set(target.id, 0);
    H_applyBulletDamage(tentacleNpc.id, tentacleNpc.teamId, target, CoralRedTentacleT1Entity.TENTACLE_DAMAGE);
  } else {
    table.set(target.id, next);
  }
  return table;
};

const spawnGrenadeDynamicEntity = (grenade: GrenadeDynamicEntity) => {
  MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.push(grenade);
};

const removeFinishedDeadDynamicEntities = (): boolean => {
  const oldNpcLength = MAP_DATA.dynamicEntitie.npcDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.npcDynamicEntitys = MAP_DATA.dynamicEntitie.npcDynamicEntitys.filter(entity => !entity.isDeathEffectFinished());
  // 注意：不移除死亡玩家实体，保留其快照以便玩家重生（respawnPlayer 需要按 ID 找回玩家）
  return oldNpcLength !== MAP_DATA.dynamicEntitie.npcDynamicEntitys.length;
};

const updateBulletEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length === 0) return false;

  let changed = false;

  const dynamicEntityList = getNpcPlayerDynamicEntityList().filter(e => !e.isDead);

  // 构建空间哈希以降低子弹与实体的碰撞检测复杂度
  const CELL_SIZE = 64;
  const cellKey = (cx: number, cy: number) => `${cx},${cy}`;
  const spatial = new Map<string, (PlayerDynamicEntity | NpcDynamicEntity)[]>();
  for (const e of dynamicEntityList) {
    const cx = Math.floor(e.position.x / CELL_SIZE);
    const cy = Math.floor(e.position.y / CELL_SIZE);
    const key = cellKey(cx, cy);
    const arr = spatial.get(key);
    if (arr) arr.push(e as PlayerDynamicEntity | NpcDynamicEntity);
    else spatial.set(key, [e as PlayerDynamicEntity | NpcDynamicEntity]);
  }

  for (const bullet of MAP_DATA.dynamicEntitie.bulletDynamicEntitys) {
    bullet.update(deltaTime, MAP_DATA.staticEntities);
    if (bullet.shouldRemove) {
      changed = true;
      continue;
    }

    // 激光弹为线段型子弹:命中/持续伤害走独立分支,且不会因命中而消失
    if (bullet instanceof LaserBulletDynamicEntity) {
      // 激光跟随发射者同步移动:按发射者的位移增量平移整条线段(方向与长度不变);
      // 发射者不存在时保持最后位置,直到激光自然寿命结束
      const shooter = H_findLaserShooter(bullet);
      if (shooter !== null) bullet.followShooter(shooter.position);
      if (updateLaserBulletHits(bullet)) changed = true;
      continue;
    }

    const bx = Math.floor(bullet.position.x / CELL_SIZE);
    const by = Math.floor(bullet.position.y / CELL_SIZE);
    const candidates: (PlayerDynamicEntity | NpcDynamicEntity)[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = spatial.get(cellKey(bx + dx, by + dy));
        if (list) candidates.push(...list);
      }
    }

    for (const entity of candidates) {
      if (entity.isDead) continue;
      if (bullet.ownerId === entity.id) continue; // 避免自残
      if(bullet.teamId!==null){if (bullet.teamId === entity.teamId) continue;} // 避免误伤队友
      // 敌对 NPC 发射的子弹(teamId===null)不再与敌对 NPC(teamId===null)进行碰撞检测，直接穿透
      if (bullet.teamId === null && entity instanceof NpcDynamicEntity && entity.teamId === null) continue;

      const hitDistance = Math.hypot(
        entity.position.x - bullet.position.x,
        entity.position.y - bullet.position.y
      );
      const hitRadius = entity.width * 0.45 + bullet.width * 0.5;

      if (hitDistance <= hitRadius) {// 受击
        H_applyBulletDamage(bullet.ownerId, bullet.teamId, entity, bullet.damage);
        bullet.shouldRemove = true;
        changed = true;
        break;
      }
    }
  }

  const oldLength = MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.bulletDynamicEntitys = MAP_DATA.dynamicEntitie.bulletDynamicEntitys.filter(bullet => !bullet.shouldRemove);

  // 清理已消失激光弹的持续接触计时,避免长期运行下残留无用条目
  if (laserContactTicks.size > 0) {
    const aliveIds = new Set(MAP_DATA.dynamicEntitie.bulletDynamicEntitys.map((b) => b.id));
    for (const id of Array.from(laserContactTicks.keys())) {
      if (!aliveIds.has(id)) laserContactTicks.delete(id);
    }
  }
  return changed || oldLength !== MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length;
};


const updateGrenadeEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.length === 0) return false;

  let changed = false;
  for (const grenade of MAP_DATA.dynamicEntitie.grenadeDynamicEntitys) {
    grenade.update(deltaTime, MAP_DATA.staticEntities,MAP_DATA.dynamicEntitie,GCFG);
  }

  const oldLength = MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.grenadeDynamicEntitys = MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.filter(grenade => !grenade.isDead);
  return changed || oldLength !== MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.length;
};

/**
 * 将总经验值拆分为若干经验球(按11档位贪心拆分,与《我的世界》一致)
 * @param totalValue 总经验值
 */
const splitExpValueIntoOrbs = (totalValue: number): number[] => {
  const values: number[] = [];
  let remaining = totalValue;
  while (remaining > 0) {
    let split = false;
    for (const tier of ExpOrbDynamicEntity.VALUE_TIERS) {
      if (remaining >= tier) {
        values.push(tier);
        remaining -= tier;
        split = true;
        break;
      }
    }
    if (!split) break;// 防御:理论上不会发生
  }
  return values;
};

/**
 * 在指定位置随机爆出总经验值为 totalValue 的经验球
 * @param position 死亡位置
 * @param totalValue 掉落的总经验值
 */
const spawnExpOrbs = (position: Point, totalValue: number): void => {
  if (totalValue <= 0) return;
  const values = splitExpValueIntoOrbs(totalValue);
  for (const value of values) {
    // 在死亡位置周围随机偏移爆出
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 36;
    const orb = new ExpOrbDynamicEntity({
      x: position.x + Math.cos(angle) * dist,
      y: position.y + Math.sin(angle) * dist,
    }, value);
    // 给一个随机的初始冲量(方向随机,速度 60~160)
    const burstAngle = Math.random() * Math.PI * 2;
    const burstSpeed = 60 + Math.random() * 100;
    orb.motionVelocity = {
      x: Math.cos(burstAngle) * burstSpeed,
      y: Math.sin(burstAngle) * burstSpeed,
    };
    MAP_DATA.dynamicEntitie.expOrbDynamicEntitys.push(orb);
  }
};

/**
 * 玩家死亡时,其所有从者跟随死亡
 * @param player 已死亡的玩家
 */
const killPlayerServantsOnPlayerDeath = (player: PlayerDynamicEntity): void => {
  const servantIds = player.getAllServantIds();
  for (const npcId of servantIds) {
    // 从玩家网格中移除该从者(更新邻居关系与移动速度)
    player.removeServant(npcId);
    const npc = getNpcDynamicEntityById(npcId);
    if (npc && !npc.isDead) {
      // 释放归属并令从者跟随玩家死亡
      npc.ownerId = null;
      npc.teamId = null;
      npc.health = 0;
      npc.triggerDeath();
    }
  }
};

/**
 * 结算死亡实体的经验掉落
 * - NPC:掉落经验 = ceil(game_exp × 60%),其余作为死亡惩罚扣除。
 * - 玩家:统一走 PlayerDynamicEntity.onDeath()(掉落物品/技能、专研全部降 1 级、
 *   经验按“等级折算总经验 + 当前经验”的 60% 掉落且上限 215),掉落物落在地面。
 * 同时,玩家死亡时其所有从者跟随死亡。
 */
const handleEntityDeathExpOrbs = (): void => {
  for (const entity of getNpcPlayerDynamicEntityList()) {
    if (!entity.isDead) continue;
    if (entity.deathExpProcessed) continue;
    entity.deathExpProcessed = true;

    if (entity instanceof PlayerDynamicEntity) {
      // 玩家死亡时,其所有从者跟随死亡
      killPlayerServantsOnPlayerDeath(entity);
      // 玩家死亡结算(物品/技能/专研惩罚/经验掉落)
      const drop = entity.onDeath();
      spawnPlayerDeathDrops(entity.position, drop);
      if (drop.droppedExp > 0) {
        spawnExpOrbs(entity.position, drop.droppedExp);
      }
      continue;
    }

    // NPC:掉落经验 = ceil(game_exp × 60%),其余作为死亡惩罚扣除
    const dropExp = Math.ceil(entity.game_exp * 0.6);
    entity.game_exp = 0;
    if (dropExp > 0) {
      spawnExpOrbs(entity.position, dropExp);
    }
  }
};

/** 死亡掉落物落点:在中心位置周围随机散布 */
const randomDropPosition = (origin: Point): Point => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 8 + Math.random() * 30;
  return { x: origin.x + Math.cos(angle) * dist, y: origin.y + Math.sin(angle) * dist };
};

/** 玩家死亡掉落:物品按堆叠落地,技能落成技能球 */
const spawnPlayerDeathDrops = (position: Point, drop: PlayerDeathDrop): void => {
  for (const stack of drop.items) {
    const item = new HealingGemItemEntity(randomDropPosition(position), stack.name, stack.tag);
    item.count = Math.max(1, Math.floor(stack.count));
    MAP_DATA.itemEntities.push(item);
  }
  for (const skillTag of drop.skillTags) {
    spawnSkillOrb(position, skillTag);
  }
};

/**
 * 掉落物(经验球 / 技能球 / 子弹球 / 地面物品)的统一拾取契约。
 *
 * <p>四者提供同一套接口,因此可以由同一条「以掉落物为中心」的拾取管线统一处理:</p>
 * <ul>
 *   <li>{@code getAbsorbRange()} 吸引范围(px):物品为 0,表示不磁吸;</li>
 *   <li>{@code getPickupRange(player)} 拾取范围(px):可依赖玩家体积(物品用"接触半径");</li>
 *   <li>{@code canBeAbsorbedBy(player)} 玩家当前能否接受(子弹满 / 背包满时为 false);</li>
 *   <li>{@code attractTowardPlayer(player, dt)} 牵引一帧(物品为空实现);</li>
 *   <li>{@code absorbByPlayer(player)} 结算吸收(支持部分吸收);</li>
 *   <li>{@code isAbsorbed()} 是否已被拾取。</li>
 * </ul>
 */
type PickupableDynamicEntity =
  | ExpOrbDynamicEntity
  | SkillOrbDynamicEntity
  | BulletOrbDynamicEntity
  | ItemEntity;

/**
 * 玩家空间哈希的单元格边长(px)。
 *
 * <p>必须 ≥ 所有掉落物的最大影响半径(当前为子弹球的 ATTRACT_RANGE = 200),
 * 这样「以掉落物为中心取 3×3 邻域」必定覆盖其影响范围。</p>
 */
const H_PICKUP_PLAYER_CELL_SIZE = 256;

/** 玩家空间哈希:单元格键 → 该单元格内的玩家列表 */
type PlayerSpatialGrid = Map<number, PlayerDynamicEntity[]>;

/** 把单元格坐标打包成唯一整数键(cx/cy 均为小区间内的整数,不会冲突) */
const H_packPlayerCell = (cx: number, cy: number): number => cx * 100003 + cy;

/** 构建「玩家空间哈希」(跳过死亡玩家),供拾取管线快速查询邻近玩家 */
const H_buildPlayerGrid = (players: PlayerDynamicEntity[]): PlayerSpatialGrid => {
  const grid: PlayerSpatialGrid = new Map();
  for (const player of players) {
    if (player.isDead) continue;
    const cx = Math.floor(player.position.x / H_PICKUP_PLAYER_CELL_SIZE);
    const cy = Math.floor(player.position.y / H_PICKUP_PLAYER_CELL_SIZE);
    const key = H_packPlayerCell(cx, cy);
    const bucket = grid.get(key);
    if (bucket) bucket.push(player);
    else grid.set(key, [player]);
  }
  return grid;
};

/** 收集 (x,y) 周围 3×3 单元格内的玩家,写入 out(复用数组,避免每帧分配) */
const H_queryNearbyPlayers = (
  grid: PlayerSpatialGrid,
  x: number,
  y: number,
  out: PlayerDynamicEntity[]
): void => {
  out.length = 0;
  const cx = Math.floor(x / H_PICKUP_PLAYER_CELL_SIZE);
  const cy = Math.floor(y / H_PICKUP_PLAYER_CELL_SIZE);
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const bucket = grid.get(H_packPlayerCell(gx, gy));
      if (bucket) {
        for (const player of bucket) out.push(player);
      }
    }
  }
};

/**
 * 掉落物拾取(统一管线):经验球 / 技能球 / 子弹球 / 地面物品共用。
 *
 * <p><b>性能</b>:距离比较全部改用<b>平方距离</b>(不再调用 Math.hypot→sqrt);
 * 并以「玩家空间哈希」把候选玩家限制在掉落物周围 3×3 单元格内,
 * 避免旧实现 O(玩家数 × 掉落物数) 的全量两两距离计算。</p>
 *
 * <p><b>公平</b>:循环以<b>掉落物为中心</b> —— 每个掉落物只由「影响范围内<b>最近的合格玩家</b>」
 * 牵引并拾取,因此多人抢夺时由距离决定归属(而非玩家数组顺序),也不再需要 claimed 去重集合。</p>
 *
 * <p>流程:掉落物 → 邻域内最近的合格玩家 → 牵引一帧 → 进入拾取距离则结算吸收。
 * 掉落物自身仍不寻找玩家(只做「存在时长 + 惯性滑行」),搜索权在玩家侧。</p>
 */
const updatePickups = (deltaTime: number): void => {
  const players = MAP_DATA.dynamicEntitie.playerDynamicEntitys;
  if (players.length === 0) return;

  const pickupableLists: PickupableDynamicEntity[][] = [
    MAP_DATA.dynamicEntitie.expOrbDynamicEntitys,
    MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys,
    MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys,
    MAP_DATA.itemEntities
  ];
  if (pickupableLists.every((list) => list.length === 0)) return;

  const playerGrid = H_buildPlayerGrid(players);
  const nearby: PlayerDynamicEntity[] = [];

  for (const list of pickupableLists) {
    for (const pickup of list) {
      if (pickup.isAbsorbed()) continue;

      H_queryNearbyPlayers(playerGrid, pickup.position.x, pickup.position.y, nearby);

      // 选「影响范围内最近的合格玩家」
      let best: PlayerDynamicEntity | null = null;
      let bestDistSq = Infinity;
      for (const player of nearby) {
        if (!pickup.canBeAbsorbedBy(player)) continue;
        const dx = player.position.x - pickup.position.x;
        const dy = player.position.y - pickup.position.y;
        const distSq = dx * dx + dy * dy;
        // 影响范围 = max(吸引范围, 拾取范围):物品吸引范围为 0,只在其「接触半径」内被选中
        const influence = Math.max(pickup.getAbsorbRange(), pickup.getPickupRange(player));
        if (distSq > influence * influence) continue;
        if (distSq < bestDistSq) {
          best = player;
          bestDistSq = distSq;
        }
      }
      if (best === null) continue;

      // 牵引一帧后再判定(与旧行为一致:避免因少吸一帧而延迟拾取)
      pickup.attractTowardPlayer(best, deltaTime);
      const dx = best.position.x - pickup.position.x;
      const dy = best.position.y - pickup.position.y;
      const pickupRange = pickup.getPickupRange(best);
      if (dx * dx + dy * dy <= pickupRange * pickupRange) pickup.absorbByPlayer(best);
    }
  }
};

// 说明:经验球 / 技能球 / 子弹球 / 地面物品的拾取已统一到 updatePickups(见上)。

/**
 * 更新经验球实体(存在时长 / 惯性滑行)
 * 吸取由玩家侧主动发起,见 updatePickups。
 */
const updateExpOrbDynamicEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.expOrbDynamicEntitys.length === 0) return false;
  for (const orb of MAP_DATA.dynamicEntitie.expOrbDynamicEntitys) {
    orb.update(deltaTime, MAP_DATA.staticEntities, MAP_DATA.dynamicEntitie, GCFG);
  }
  const oldLength = MAP_DATA.dynamicEntitie.expOrbDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.expOrbDynamicEntitys = MAP_DATA.dynamicEntitie.expOrbDynamicEntitys.filter(orb => !orb.isPickedUp);
  return oldLength !== MAP_DATA.dynamicEntitie.expOrbDynamicEntitys.length;
};

/**
 * 在指定位置爆出一个技能球
 * @param position 掉落位置(通常为 NPC 死亡位置 / 丢弃落点)
 * @param skillTag 技能标签
 * @param spread   是否随机散布并给一个爆出冲量。
 *                 NPC 死亡掉落用 true(有"爆出"手感);
 *                 **背包拖拽丢弃必须用 false** —— 否则随机偏移可能把球扔回技能球的吸引范围内,
 *                 导致"刚丢出去就被立刻吸回来"。
 */
const spawnSkillOrb = (position: Point, skillTag: string, spread: boolean = true): void => {
  let spawnX = position.x;
  let spawnY = position.y;
  if (spread) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 26;
    spawnX += Math.cos(angle) * dist;
    spawnY += Math.sin(angle) * dist;
  }
  const orb = new SkillOrbDynamicEntity({ x: spawnX, y: spawnY }, skillTag);
  if (spread) {
    // 给一个随机的初始冲量,制造"爆出"的手感
    const burstAngle = Math.random() * Math.PI * 2;
    const burstSpeed = 50 + Math.random() * 90;
    orb.motionVelocity = {
      x: Math.cos(burstAngle) * burstSpeed,
      y: Math.sin(burstAngle) * burstSpeed
    };
  }
  MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys.push(orb);
};

/**
 * 结算 NPC 死亡时的战利品掉落
 * 依据 NPC 的 loot 配置逐条按概率掉落:
 * - type === 'skillOrb' 时掉落一颗对应技能的技能球;
 * - type === 'bulletOrb' 时掉落一颗子弹球(会发射子弹的 NPC 均有配置);
 * - 每个 NPC 只结算一次(deathLootProcessed)
 * - 仅无主的敌对/中立 NPC 掉落,玩家自己的从者与超远端销毁的 NPC 不产出战利品
 */
const handleNpcDeathLoot = (): void => {
  for (const npc of getNpcDynamicEntityList()) {
    if (!npc.isDead) continue;
    if (npc.deathLootProcessed) continue;
    npc.deathLootProcessed = true;

    if (npc.ownerId !== null) continue;// 玩家从者不产出战利品
    if (!Array.isArray(npc.loot) || npc.loot.length === 0) continue;

    // 专研"幸运之星":按击杀者(或其从者主人)的等级提升逐条掉落概率
    const killer = npc.lastKillerPlayerId !== null
      ? getPlayerDynamicEntityById(npc.lastKillerPlayerId)
      : null;
    const luckyBonus = killer ? killer.getLuckyStarBonus() : 0;

    for (const loot of npc.loot) {
      const odds = Math.max(0, Math.min(1, Number(loot.odds) + luckyBonus));
      if (!(Math.random() < odds)) continue;
      if (loot.type === 'skillOrb') {
        spawnSkillOrb(npc.position, loot.tag);
      } else if (loot.type === 'bulletOrb') {
        spawnBulletOrb(npc.position);
      }
    }
  }
};

/**
 * 更新技能球实体(存在时长 / 惯性滑行)
 * 吸取由玩家侧主动发起,见 updatePickups。
 */
const updateSkillOrbDynamicEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys.length === 0) return false;
  for (const orb of MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys) {
    orb.update(deltaTime, MAP_DATA.staticEntities, MAP_DATA.dynamicEntitie, GCFG);
  }
  const oldLength = MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys = MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys.filter(orb => !orb.isPickedUp);
  return oldLength !== MAP_DATA.dynamicEntitie.skillOrbDynamicEntitys.length;
};

/**
 * 在指定位置爆出一颗子弹球
 * @param position 掉落位置(通常为 NPC 死亡位置)
 * @param value 承载的子弹数(默认 1 发)
 */
const spawnBulletOrb = (
  position: Point,
  value: number = BulletOrbDynamicEntity.DEFAULT_VALUE
): void => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * 26;
  const orb = new BulletOrbDynamicEntity(
    {
      x: position.x + Math.cos(angle) * dist,
      y: position.y + Math.sin(angle) * dist
    },
    value
  );
  // 给一个随机的初始冲量,制造"爆出"的手感
  const burstAngle = Math.random() * Math.PI * 2;
  const burstSpeed = 50 + Math.random() * 90;
  orb.motionVelocity = {
    x: Math.cos(burstAngle) * burstSpeed,
    y: Math.sin(burstAngle) * burstSpeed
  };
  MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys.push(orb);
};

/**
 * 更新子弹球实体(存在时长 / 惯性滑行)
 * 吸取由玩家侧主动发起,见 updatePickups。
 */
const updateBulletOrbDynamicEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys.length === 0) return false;
  for (const orb of MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys) {
    orb.update(deltaTime, MAP_DATA.staticEntities, MAP_DATA.dynamicEntitie, GCFG);
  }
  const oldLength = MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys = MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys.filter(orb => !orb.isPickedUp);
  return oldLength !== MAP_DATA.dynamicEntitie.bulletOrbDynamicEntitys.length;
};

/**
 * 计算丢弃物的落点:从玩家位置沿 direction 抛出 distance px。
 * 落点与静态实体(围墙)冲突时沿同一方向逐步收缩;始终找不到可用点时退回玩家位置。
 */
const H_resolveInventoryDropPosition = (
  player: PlayerDynamicEntity,
  direction: Point,
  distance: number
): Point => {
  const len = Math.hypot(direction?.x ?? 0, direction?.y ?? 0);
  const dir = len < 0.0001 ? { x: 1, y: 0 } : { x: direction.x / len, y: direction.y / len };
  const maxDistance = Math.max(0, Number.isFinite(distance) ? Number(distance) : 0);
  const steps = 12;
  for (let i = steps; i >= 0; i--) {
    const d = maxDistance * (i / steps);
    const candidate = { x: player.position.x + dir.x * d, y: player.position.y + dir.y * d };
    if (!staticEntitySpatialGrid || !staticEntitySpatialGrid.isPointColliding(candidate.x, candidate.y)) {
      return candidate;
    }
  }
  return { ...player.position };
};

/**
 * 处理客户端"拖拽丢弃"请求:按给定方向与距离把条目抛到地面。
 *
 * 客户端已在本地背包中移除该条目并另行提交 inventory_update,
 * 因此这里只负责生成地面实体(技能 → 技能球,物品 → 地面物品)。
 */
const dropInventoryEntry = (
  player: PlayerDynamicEntity,
  drop: {
    kind: 'item' | 'skill';
    tag: string;
    name: string;
    color: string;
    count: number;
    direction: Point;
    distance: number;
  }
): void => {
  if (!drop || typeof drop.tag !== 'string' || drop.tag.length === 0) return;
  const position = H_resolveInventoryDropPosition(
    player,
    drop.direction ?? { x: 1, y: 0 },
    drop.distance ?? 0
  );
  if (drop.kind === 'skill') {
    // 丢弃的技能球用精确落点(不随机散布、无爆出冲量),保证不会被立刻吸回
    spawnSkillOrb(position, drop.tag, false);
    return;
  }
  const item = new HealingGemItemEntity(position, drop.name || '', drop.tag);
  item.count = Math.max(1, Math.floor(Number(drop.count) || 1));
  MAP_DATA.itemEntities.push(item);
};


const setRandomTargetForNpc = (entity: NpcDynamicEntity): boolean => {

  if(entity.ownerId !== null){
    return false;
  }

  const radius = Math.max(1, entity.wanderRange);
  const center = entity.position;
  let attempts = 0;
  const maxAttempts = GCFG.setRandomTargetMaxAttempts;

  while (attempts < maxAttempts) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * Math.sqrt(Math.random());
    const target: Point = {
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    };

    // 使用空间索引快速检测碰撞
    if (staticEntitySpatialGrid && !staticEntitySpatialGrid.isPointColliding(target.x, target.y)) {
      if (entity.setTarget(target, MAP_DATA.staticEntities)) {
        return true;
      }
    }
    attempts++;
  }

  return entity.tryFallbackTarget(MAP_DATA.staticEntities);
};

/**
 * 处理玩家的从者死亡的函数
 * @param npcEntity 
 */
const resolvePlayerServantDead = (npcEntity: NpcDynamicEntity): void => {
  if (npcEntity.isDead && npcEntity.ownerId !== null) {
    for (const player of MAP_DATA.dynamicEntitie.playerDynamicEntitys) {
      if (npcEntity.ownerId === player.id) {
        //  先获取死亡从者的信息（此时仍存在于 servantMap 中）
        const deadServant = player.selectServantByID(npcEntity.id);
        if (deadServant === null) return;

        //  找出所有因该从者断开连接的从者（包括死亡从者自身）
        const disconnectedIds = player.releaseDisconnectedServants(deadServant, (npcId) => {
          const npc = MAP_DATA.dynamicEntitie.npcDynamicEntitys.find(n => n.id === npcId);
          if (npc) {
            npc.ownerId = null;
            npc.teamId = null;
          }
        });

        //  批量移除所有断连的从者（包括死亡从者）
        for (const id of disconnectedIds) {
          player.removeServant(id);
        }
        break;
      }
    }
  }
};

/**
 * 动态实体的碰撞处理
 * 包含碰撞检测
 * @returns 
 */
const resolveDynamicEntityCollisions = () => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList().filter(entity => !entity.isDead);
  if (dynamicEntityList.length < 2) return;

  const CELL_SIZE = 64; // 空间哈希格子大小,可根据实体平均尺寸调整 CELL单元格
  const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

  for (let iter = 0; iter < 1; iter++) {// 动态实体碰撞分离的迭代次数,单位次
    // 构建空间哈希(基于实体位置),把实体放入其所在格子
    const spatial = new Map<string, DynamicEntity[]>();// 空间哈系地图
    for (const e of dynamicEntityList) {
      const cx = Math.floor(e.position.x / CELL_SIZE);
      const cy = Math.floor(e.position.y / CELL_SIZE);
      const key = cellKey(cx, cy);
      const arr = spatial.get(key);
      if (arr) arr.push(e);
      else spatial.set(key, [e]);
    }

    // 对每个实体,只与相邻格子的实体比较,避免全表 O(n^2)
    for (const entityA of dynamicEntityList) {
      const ax = Math.floor(entityA.position.x / CELL_SIZE);
      const ay = Math.floor(entityA.position.y / CELL_SIZE);

      // 收集周围 3x3 格子的候选实体
      const candidates: DynamicEntity[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = spatial.get(cellKey(ax + dx, ay + dy));
          if (list) candidates.push(...list);
        }
      }

      for (const entityB of candidates) {
        // 只处理一次(按 id 避免重复),并忽略自身与死亡实体
        if (entityB.id <= entityA.id) continue;
        if (entityB.isDead) continue;

        // player <-> npc 吸附逻辑
        if (
          (entityA instanceof PlayerDynamicEntity && entityB instanceof NpcDynamicEntity) ||
          (entityB instanceof PlayerDynamicEntity && entityA instanceof NpcDynamicEntity)
        ) {
          const player = entityA instanceof PlayerDynamicEntity ? entityA : (entityB as PlayerDynamicEntity);
          const npc = entityA instanceof NpcDynamicEntity ? (entityA as NpcDynamicEntity) : (entityB as NpcDynamicEntity);

          if (npc.ownerId !== null) continue; // 已有归属
          if (player.selectServantByID(npc.id) !== null) continue; // 重复

          const boxA = player.collisionBox;
          const boxB = npc.collisionBox;
          const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
          const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const RC = player.worldPositionToRowCol(npc.position);
          if (RC === null) continue;
          const servant = player.selectServantByRC(RC.row, RC.col);
          if (servant === null || servant.exist === true) continue;
          if (!player.setServant(RC.row, RC.col, npc.id)) continue;

          // 设置归属
          npc.ownerId = player.id;
          npc.teamId = player.teamId;

          continue;
        }

        // 如果某方是已归属的 npc,尝试由 owner 收纳另一个 npc(保持原逻辑)
        if (entityA instanceof NpcDynamicEntity && entityA.ownerId !== null && entityB instanceof NpcDynamicEntity) {
          const owner = getPlayerDynamicEntityById(entityA.ownerId);
          if (owner !== null) {
            if (owner.selectServantByID(entityB.id) !== null) continue;
            const boxA = entityA.collisionBox;
            const boxB = entityB.collisionBox;
            const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
            const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const RC = owner.worldPositionToRowCol(entityB.position);
            if (RC === null) continue;
            const servant = owner.selectServantByRC(RC.row, RC.col);
            if (servant === null || servant.exist === true) continue;
            if (!owner.setServant(RC.row, RC.col, entityB.id)) continue;

            entityB.ownerId = owner.id;
            entityB.teamId = owner.teamId;
          }
          continue;
        }

        if (entityB instanceof NpcDynamicEntity && entityB.ownerId !== null && entityA instanceof NpcDynamicEntity) {
          const owner = getPlayerDynamicEntityById(entityB.ownerId);
          if (owner !== null) {
            if (owner.selectServantByID(entityA.id) !== null) continue;
            const boxA = entityB.collisionBox;
            const boxB = entityA.collisionBox;
            const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
            const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const RC = owner.worldPositionToRowCol(entityA.position);
            if (RC === null) continue;
            const servant = owner.selectServantByRC(RC.row, RC.col);
            if (servant === null || servant.exist === true) continue;
            if (!owner.setServant(RC.row, RC.col, entityA.id)) continue;

            entityA.ownerId = owner.id;
            entityA.teamId = owner.teamId;
          }
          continue;
        }

        // 独立 npc <-> npc 碰撞分离(位移)
        // 只处理 NpcDynamicEntity 与 NpcDynamicEntity 之间的分离
        if (entityA instanceof NpcDynamicEntity && entityB instanceof NpcDynamicEntity) {
          const boxA = entityA.collisionBox;
          const boxB = entityB.collisionBox;
          const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
          const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          if (overlapX < overlapY) {
            const pushX = overlapX / 2 + 0.1;
            const direction = entityA.position.x <= entityB.position.x ? -1 : 1;
            entityA.position.x += direction * pushX;
            entityB.position.x -= direction * pushX;
          } else {
            const pushY = overlapY / 2 + 0.1;
            const direction = entityA.position.y <= entityB.position.y ? -1 : 1;
            entityA.position.y += direction * pushY;  
            entityB.position.y -= direction * pushY;
          }

          entityA.updateCollisionBox();
          entityB.updateCollisionBox();
        }
      }
    }
  }
};

/**
 * 计算 NPC 与所有玩家之间的最小距离(px)
 * @param npc NPC 实体
 * @returns 与最近玩家的距离，无存活玩家时返回 Infinity
 */
const getNpcMinDistanceToPlayers = (npc: NpcDynamicEntity): number => {
  let minDist = Infinity;
  for (const player of MAP_DATA.dynamicEntitie.playerDynamicEntitys) {
    const dist = Math.hypot(npc.position.x - player.position.x, npc.position.y - player.position.y);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
};

const updateDynamicEntities = (deltaTime: number) => {
  // 预计算本帧需要冻结(远端)或销毁(超远端)的 NPC，降低服务端计算负载
  const frozenNpcIds = new Set<number>();
  const despawnNpcIds = new Set<number>();
  for (const npc of MAP_DATA.dynamicEntitie.npcDynamicEntitys) {
    if (npc.isDead) continue;
    const minDist = getNpcMinDistanceToPlayers(npc);
    if (minDist > GCFG.npcDespawnDistance) {
      despawnNpcIds.add(npc.id);
    } else if (minDist > GCFG.npcSpawnLowRadius) {
      frozenNpcIds.add(npc.id);
    }
  }

  for (const entity of getNpcPlayerDynamicEntityList()) {
    if (entity instanceof NpcDynamicEntity && despawnNpcIds.has(entity.id)) {
      // 超远端 NPC 销毁：直接击杀，且不掉落经验，避免生成多余实体
      entity.game_exp = 0;
      entity.health = 0;
      entity.triggerDeath();
      entity.deathLootProcessed = true;// 超远端销毁不产出战利品
      resolvePlayerServantDead(entity);
      continue;
    }

    if (entity instanceof NpcDynamicEntity && frozenNpcIds.has(entity.id)) {
      // 远端 NPC 冻结：停止移动并暂停事件循环
      if (entity.isMoving) {
        entity.stop();
      }
      entity.updateDamageEffect(deltaTime);
      entity.updateDeathEffect(deltaTime);
      continue;
    }

    entity.update(deltaTime, MAP_DATA.staticEntities, MAP_DATA.dynamicEntitie, GCFG);
    entity.updateDamageEffect(deltaTime);
    entity.updateDeathEffect(deltaTime);
    // 死亡等待时间与地图外伤害:死亡期间 update() 会直接返回,必须在这里单独推进
    if (entity instanceof PlayerDynamicEntity) {
      entity.updateDeathAndOutOfMapState(deltaTime, GCFG);
    }
    if(entity instanceof NpcDynamicEntity){
      resolvePlayerServantDead(entity);
    }
  }

  // 同步从者射速倍率(主人的专研"射速"):从者开火节奏随之加快
  for (const npc of MAP_DATA.dynamicEntitie.npcDynamicEntitys) {
    if (npc.ownerId === null) {
      npc.ownerFireRateMultiplier = 1;
      continue;
    }
    const owner = getPlayerDynamicEntityById(npc.ownerId);
    npc.ownerFireRateMultiplier = owner ? owner.getFireRateMultiplier() : 1;
  }

  // 先结算本帧死亡实体的经验掉落(部分实体如红像素自爆会立即完成死亡特效并可能被清理)
  handleEntityDeathExpOrbs();
  // 再结算战利品掉落(必须在清理死亡实体之前,否则刚死亡的 NPC 会被移除导致掉落丢失)
  handleNpcDeathLoot();
  removeFinishedDeadDynamicEntities();
  resolveDynamicEntityCollisions();

  const actionLoopContext = {
    deltaTime,
    staticEntities: MAP_DATA.staticEntities,
    npcEntities: MAP_DATA.dynamicEntitie.npcDynamicEntitys,
    playerEntities: MAP_DATA.dynamicEntitie.playerDynamicEntitys,
    spawnBullet: spawnBulletDynamicEntity,
    spawnGrenade: spawnGrenadeDynamicEntity
  };

  for (const entity of getNpcDynamicEntityList()) {
    // 冻结或已销毁的 NPC 暂停事件循环与游走逻辑
    if (frozenNpcIds.has(entity.id) || despawnNpcIds.has(entity.id)) {
      continue;
    }

    entity.updateCrowdStuckState(deltaTime);
    entity.updateStayDuration(deltaTime);
    entity.updateStaticCompressionEffects(deltaTime, MAP_DATA.staticEntities);

    if (entity.updateNoMovementWatchdog(deltaTime)) {
      setRandomTargetForNpc(entity);
      continue;
    }

    if (entity.canGetNewWanderTarget(deltaTime, MAP_DATA.staticEntities)) {
      setRandomTargetForNpc(entity);
    }

    entity.actionLoop(actionLoopContext);
  }
};

/**
 * 在指定环形范围内随机生成一个点
 * 半径使用世界坐标 px,随机面积在环内均匀分布
 */
const getRandomPointInRing = (center: Point, minRadius: number, maxRadius: number): Point => {
  const angle = Math.random() * Math.PI * 2;
  const minSquare = minRadius * minRadius;
  const maxSquare = maxRadius * maxRadius;
  const radius = Math.sqrt(minSquare + Math.random() * (maxSquare - minSquare));
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
};

const canSpawnNpcOrItemAt = (position: Point, spawnItem: boolean, spawnNpc: boolean): boolean => {
  if (!spawnItem && !spawnNpc) return false;
  if (position.x <= GCFG.worldMinX || position.x >= GCFG.worldMaxX || position.y <= GCFG.worldMinY || position.y >= GCFG.worldMaxY)return false;
  const halfW = WhitePixelEntity.WIDTH / 2;
  const halfH = WhitePixelEntity.HEIGHT / 2;
  const spawnBox = {
    x: position.x - halfW,
    y: position.y - halfH,
    width: WhitePixelEntity.WIDTH,
    height: WhitePixelEntity.HEIGHT,
  };

  // 使用空间索引快速判断是否与静态实体重叠
  // 需要检查生成实体的整个矩形区域是否与任何静态实体碰撞
  // 简单实现：检查矩形四个角点是否在静态实体内（更精确可遍历格子）
  if (staticEntitySpatialGrid) {
    // 检查包围盒四个顶点以及中心（保守检测）
    const pointsToCheck = [
      { x: spawnBox.x, y: spawnBox.y },
      { x: spawnBox.x + spawnBox.width, y: spawnBox.y },
      { x: spawnBox.x, y: spawnBox.y + spawnBox.height },
      { x: spawnBox.x + spawnBox.width, y: spawnBox.y + spawnBox.height },
      { x: spawnBox.x + spawnBox.width / 2, y: spawnBox.y + spawnBox.height / 2 }
    ];
    for (const p of pointsToCheck) {
      if (staticEntitySpatialGrid.isPointColliding(p.x, p.y)) return false;
    }
    return true;
  } else {
    // fallback 遍历
    for (const staticEntity of MAP_DATA.staticEntities) {
      const box = staticEntity.collisionBox;
      const separated =
        spawnBox.x + spawnBox.width <= box.x ||
        spawnBox.x >= box.x + box.width ||
        spawnBox.y + spawnBox.height <= box.y ||
        spawnBox.y >= box.y + box.height;
      if (!separated) return false;
    }
  }

  // 动态实体碰撞检测
  for (const entity of getNpcPlayerDynamicEntityList()) {
    if (entity.isDead) continue;
    const maxPadding = Math.max(GCFG.npcSpawnPadding, GCFG.itemSpawnPadding);
    const padding = (spawnItem && spawnNpc) ? maxPadding : (spawnItem ? GCFG.itemSpawnPadding : GCFG.npcSpawnPadding);
    const minDistance =
      Math.max(WhitePixelEntity.WIDTH, WhitePixelEntity.HEIGHT) / 2 +
      Math.max(entity.width, entity.height) / 2 +
      padding;
    if (Math.hypot(position.x - entity.position.x, position.y - entity.position.y) < minDistance) {
      return false;
    }
  }

  return true;
};

/**
 * 尝试在玩家周围生成 ITEM
 * @param playerEntity
 * @param minRadius
 * @param maxRadius
 * @returns
 */
const spawnItemInRingAroundPlayer = (
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
): boolean => {
  for (let i = 0; i < GCFG.itemSpawnMaxAttempts; i++) {
    const position = getRandomPointInRing(playerEntity.position, minRadius, maxRadius);
    if (!canSpawnNpcOrItemAt(position, true, false)) continue;

    // 根据权重随机选择一个 ITEM 类型(同时受 itemSpawnTotalProbability 影响)
    const ItemCtor = selectRandomItemCtor();
    if (ItemCtor === null){break;} // 本次不生成

    const item = new ItemCtor(position);
    MAP_DATA.itemEntities.push(item);
    return true;
  }
  return false;
};

/**
 * 尝试在玩家周围生成NPC
 * @param playerEntity 
 * @param minRadius 
 * @param maxRadius 
 * @returns 
 */
const spawnNpcInRingAroundPlayer = (
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
): boolean => {
  for (let i = 0; i < GCFG.npcSpawnMaxAttempts; i++) {
    const position = getRandomPointInRing(playerEntity.position, minRadius, maxRadius);
    if (!canSpawnNpcOrItemAt(position, false, true)) continue;

    // 根据权重随机选择一个 NPC 类型
    const NpcCtor = selectRandomNpcCtor();
    if(NpcCtor === null){break;}
    const npc = new NpcCtor(position,null,null);
    // 按等级概率表随机等级(等级越高能力越强;默认等级 0)
    npc.applyNpcLevel(H_rollNpcLevel(npc.getMaxLevel()));
    npc.setTarget(position, MAP_DATA.staticEntities, { preferStraight: true });
    MAP_DATA.dynamicEntitie.npcDynamicEntitys.push(npc);
    return true;
  }
  return false;
};

/**
 * 根据静态权重随机选择一个 NPC 构造函数
 * 权重越高,被选中的概率越大
 * 该机制还会受到游戏配置的影响例如npcSpawnTotalProbability
 */
const selectRandomNpcCtor = (): (
  | (new (position: Point, ownerId: number | null, teamId: number | null) => NpcDynamicEntity)
  | null
) => {
  // ---- 前置机制:总概率判断 ----
  const totalProbability = Math.max(0, Math.min(1, GCFG.npcSpawnTotalProbability));
  if (Math.random() >= totalProbability) {
    return null; // 本次不生成
  }

  // ---- 原有的权重轮盘赌 ----
  const totalWeight = NPC_WEIGHTS.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  for (const { ctor, weight } of NPC_WEIGHTS) {
    if (random < weight) return ctor;
    random -= weight;
  }
  // fallback
  return NPC_WEIGHTS[0].ctor;
};

/**
 * 根据静态权重随机选择一个 ITEM 构造函数
 * 权重越高,被选中的概率越大
 * 该机制还会受到游戏配置的影响,例如 itemSpawnTotalProbability
 */
const selectRandomItemCtor = (): (
  | (new (position: Point) => HealingGemItemEntity)
  | null
) => {
  // ---- 前置机制:总概率判断 ----
  const totalProbability = Math.max(0, Math.min(1, GCFG.itemSpawnTotalProbability));
  if (Math.random() >= totalProbability) {
    return null; // 本次不生成
  }

  // ---- 原有的权重轮盘赌 ----
  const totalWeight = ITEM_WEIGHTS.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  for (const { ctor, weight } of ITEM_WEIGHTS) {
    if (random < weight) return ctor;
    random -= weight;
  }
  // fallback
  return ITEM_WEIGHTS[0].ctor;
};

/**
 * npc刷怪计时器
 * @param timer 
 * @param deltaTime 
 * @param interval 
 * @param playerEntity 
 * @param minRadius 
 * @param maxRadius 
 * @returns 
 */
const updateNpcSpawnTimer = (
  timer: number,
  deltaTime: number,
  interval: number,
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
) => {
  let nextTimer = timer - deltaTime;//global
  //deltaTime >= nextTimer
  while (nextTimer <= 0 && MAP_DATA.dynamicEntitie.npcDynamicEntitys.length < GCFG.npcSpawnMaxCountSinglePlayer) {
    spawnNpcInRingAroundPlayer(playerEntity, minRadius, maxRadius);
    nextTimer += interval;
  }
  return nextTimer;
};

const updateItemSpawnTimer = (
  timer: number,
  deltaTime: number,
  interval: number,
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
) => {
  let nextTimer = timer - deltaTime;
  while (nextTimer <= 0 && MAP_DATA.itemEntities.length < GCFG.itemSpawnMaxCountSinglePlayer) {
    spawnItemInRingAroundPlayer(playerEntity, minRadius, maxRadius);
    nextTimer += interval;
  }
  return nextTimer;
};

/**
 * 玩家周围随机刷新 NPC
 * 0-200px 为禁刷区,200-400px 为高频区,400-800px 为中频区,800-1600px 为低频区
 */
const generateNpcAroundPlayerSingle = (deltaTime: number) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys[0];
  if (!playerEntity || playerEntity.isDead) return;
  if (MAP_DATA.dynamicEntitie.npcDynamicEntitys.length >= GCFG.npcSpawnMaxCountSinglePlayer) return;

  npcSpawnHighTimer = updateNpcSpawnTimer(
    npcSpawnHighTimer,
    deltaTime,
    GCFG.npcSpawnHighInterval,
    playerEntity,
    GCFG.npcSpawnNoSpawnRadius,
    GCFG.npcSpawnHighRadius
  );
  npcSpawnMediumTimer = updateNpcSpawnTimer(
    npcSpawnMediumTimer,
    deltaTime,
    GCFG.npcSpawnMediumInterval,
    playerEntity,
    GCFG.npcSpawnHighRadius,
    GCFG.npcSpawnMediumRadius
  );
  npcSpawnLowTimer = updateNpcSpawnTimer(
    npcSpawnLowTimer,
    deltaTime,
    GCFG.npcSpawnLowInterval,
    playerEntity,
    GCFG.npcSpawnMediumRadius,
    GCFG.npcSpawnLowRadius
  );
};



/**
 * 玩家周围随机刷新 物品
 * 0-200px 为禁刷区,200-400px 为高频区,400-800px 为中频区,800-1600px 为低频区
 */
const generateItemAroundPlayerSingle = (deltaTime: number) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys[0];
  if (!playerEntity || playerEntity.isDead) return;
  if (MAP_DATA.itemEntities.length >= GCFG.itemSpawnMaxCountSinglePlayer) return;

  itemSpawnHighTimer = updateItemSpawnTimer(
    itemSpawnHighTimer,
    deltaTime,
    GCFG.itemSpawnHighInterval,
    playerEntity,
    GCFG.itemSpawnNoSpawnRadius,
    GCFG.itemSpawnHighRadius
  );
  itemSpawnMediumTimer = updateItemSpawnTimer(
    itemSpawnMediumTimer,
    deltaTime,
    GCFG.itemSpawnMediumInterval,
    playerEntity,
    GCFG.itemSpawnHighRadius,
    GCFG.itemSpawnMediumRadius
  );
  itemSpawnLowTimer = updateItemSpawnTimer(
    itemSpawnLowTimer,
    deltaTime,
    GCFG.itemSpawnLowInterval,
    playerEntity,
    GCFG.itemSpawnMediumRadius,
    GCFG.itemSpawnLowRadius
  );
  
};

const updateGame = (deltaTime: number) => {
  if (gamePaused) return;
  updateItemEntityLifetimes(deltaTime);
  updateDynamicEntities(deltaTime);
  updateCoralRedTentacleHits();          // 珊瑚红触手:线段型攻击的持续伤害结算(需在实体位移之后)
  updateBulletEntities(deltaTime);
  updateGrenadeEntities(deltaTime);
  handleEntityDeathExpOrbs();            // 结算死亡掉落经验球(须在清理死亡实体之前)
  handleNpcDeathLoot();                   // 结算死亡战利品掉落(技能球/子弹球)
  updateExpOrbDynamicEntities(deltaTime); // 更新经验球(存在时长/惯性滑行)
  updateSkillOrbDynamicEntities(deltaTime); // 更新技能球(存在时长/惯性滑行)
  updateBulletOrbDynamicEntities(deltaTime); // 更新子弹球(存在时长/惯性滑行)
  updatePickups(deltaTime);                // 统一拾取:Orb 磁吸 + 地面物品接触拾取
  generateNpcAroundPlayerSingle(deltaTime);
  generateItemAroundPlayerSingle(deltaTime);
  removeFinishedDeadDynamicEntities();
};
////////////////////
//<--游戏逻辑区
////////////////////

////////////////////
// 事件处理区-->
////////////////////
const handleMessage = (message: MessageEvent) => {
  const dpkg = message.data as DataPackage;
  const instructs = dpkg?.data?.instructs || [];
  for (const instruct of instructs) {
    handleInstruct(instruct);
  }
};

const handleInstruct = (instruct: InstructObject) => {
  switch (instruct.type) {
    case 'player_move_input': {
      if(gamePaused){break;}
      // 死亡期间禁用移动指令(死亡时清空移动状态,避免重生后残留按键导致自动移动)
      const movePlayer = getPlayerDynamicEntityById(instruct.data.playerId as number);
      if (movePlayer && movePlayer.isDead) {
        movePlayer.moveState.W = false;
        movePlayer.moveState.A = false;
        movePlayer.moveState.S = false;
        movePlayer.moveState.D = false;
        movePlayer.moveState.Shift = false;
        break;
      }
      refreshPlayerMoveState(
        instruct.data.moveState,
        instruct.data.playerId
      );
      break;
    }

    case 'player_fire_input': {
      if(gamePaused){break;}
      spawnPlayerBullet(
        instruct.data.target as Point,
        instruct.data.playerId as number
      );
      break;
    }

    case 'player_dodge_input': {
      if (gamePaused) break;
      const playerEntity = getPlayerDynamicEntityById(instruct.data.playerId as number);
      // 必须装备闪现技能后才能使用闪现(空格)能力
      if (playerEntity && !playerEntity.isDead && playerEntity.hasEquippedSkill(DodgeSkill.TAG)) {
        playerEntity.dodge(instruct.data.direction as Point, MAP_DATA.staticEntities);
      }
      break;
    }

    case 'player_respawn': {
      respawnPlayer(instruct.data.playerId as number);
      break;
    }

    case 'tick_pause': {
      const { paused } = instruct.data as { paused?: boolean };
      if (paused !== undefined) {
        gamePaused = paused;
      } else {
        gamePaused = !gamePaused;  // 无参数时切换状态
      }
      console.log(`[Service] Game ${gamePaused ? 'paused' : 'resumed'}`);
      break;
    }

    case 'inventory_update': {
      // 客户端提交最新的背包状态(装配调整/卸下/销毁),以服务端玩家实体为准进行覆盖
      // 死亡期间忽略该指令,防止死亡时绕过限制改动背包(与多人服务端行为保持一致)
      const playerEntity = getPlayerDynamicEntityById(instruct.data.playerId as number);
      if (playerEntity && !playerEntity.isDead) {
        playerEntity.applyInventoryState(instruct.data.inventory);
      }
      break;
    }

    case 'inventory_use_item': {
      if (gamePaused) break;
      const playerEntity = getPlayerDynamicEntityById(instruct.data.playerId as number);
      if (playerEntity && !playerEntity.isDead) {
        playerEntity.useInventoryItem(instruct.data.uid as string);
      }
      break;
    }

    case 'inventory_drop': {
      // 客户端拖拽丢弃:背包条目已在客户端本地移除并随 inventory_update 提交,
      // 这里只负责按给定方向与距离在地面生成掉落物
      if (gamePaused) break;
      const playerEntity = getPlayerDynamicEntityById(instruct.data.playerId as number);
      if (playerEntity && !playerEntity.isDead) {
        dropInventoryEntry(playerEntity, instruct.data as unknown as Parameters<typeof dropInventoryEntry>[1]);
      }
      break;
    }

    case 'research_choose': {
      // 玩家从专研界面中选择了一项研究,由服务端权威结算
      const playerEntity = getPlayerDynamicEntityById(instruct.data.playerId as number);
      if (playerEntity && !playerEntity.isDead) {
        playerEntity.chooseResearch(instruct.data.tag as string);
      }
      break;
    }

    default: {
      console.warn('Service received unknown instruct type:', instruct.type, instruct);
      break;
    }
  }
};
////////////////////
//<--事件处理区
////////////////////

////////////////////
// 通信处理区-->
////////////////////
const sendDataPackage = (dataPackage: DataPackage) => {
  SERVICE.postMessage(dataPackage);
};

const createDataPackage = (instructs: InstructObject[]): DataPackage => ({
  tick: { ...TICK_TIMER.tick },
  data: { instructs }
});

/**
 * 全量发送（仅在初始化时调用）
 */
const sendMapDataInitial = (mapData: MapData) => {
  try {
    const dataPackage = createDataPackage([Instruct.I_MapDataInitial(mapData)]);
    sendDataPackage(dataPackage);
    staticEntitiesSent = true;  // 标记已发送静态实体
    console.log('MapData initial sent successfully');
  } catch (error) {
    console.error('Failed to send initial map data:', error);
  }
};

/**
 * 发送地图增量更新（仅动态部分）
 */
const sendMapDataUpdate = () => {
  if (!staticEntitiesSent) {
    // 理论上初始化时已发送全量，此处作为兜底
    sendMapDataInitial(MAP_DATA);
    staticEntitiesSent = true;
    return;
  }

  try {
    const dataPackage = createDynamicItemUpdateDataPackage();
    sendDataPackage(dataPackage);
  } catch (error) {
    console.error('Failed to send dynamic map update:', error);
  }
};
////////////////////
//<--通信处理区
////////////////////

main();
