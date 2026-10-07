import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {Point, ActionLoopContext, NpcLoot, EntityDebugFlags} from '@/components/pixel_war/interface/Interface';
import type { NpcAttitude } from '@/components/pixel_war/type/Type';

export type NpcActionLoopContext = {
  deltaTime: number;
  staticEntities: StaticEntity[];
  spawnBullet: (bullet: BulletDynamicEntity) => void;
  spawnGrenade: (grenade: GrenadeDynamicEntity) => void;
};

abstract class NpcDynamicEntity extends DynamicEntity {

  public static readonly WIDTH = 25;
  public static readonly HEIGHT = 25;
  public static readonly RENDER_SIZE = 21;// 身体渲染边长(仅视觉,碰撞体积仍为 WIDTH × HEIGHT)
  public static GENERATE_WEIGHT = 1;//随机刷新的权重 (0,1]
  /**
   * NPC 类型的显示名称。
   *
   * <p>名称不会随实例变化,因此统一配置在这里(由各具体 NPC 子类覆盖),
   * 用于击杀提示等 UI 文案(例如"你被 红色像素 击倒了")。</p>
   */
  public static readonly NAME: string = '';

  /**
   * 取得本 NPC 的类型显示名称(读取子类的静态 {@link NpcDynamicEntity.NAME})。
   * 未配置时退化为实例名或 tag,保证始终有可展示的文本。
   */
  public getDisplayName(): string {
    const ctor = this.constructor as { NAME?: unknown };
    const staticName = ctor?.NAME;
    if (typeof staticName === 'string' && staticName.length > 0) return staticName;
    if (this.name) return this.name;
    return this.tag;
  }

  public ownerId: number | null;  // 拥有者ID，null表示无主
  public teamId: number | null; // 拥有者ID，null表示无队伍
  public attitude: NpcAttitude; // 友好/中立/敌对
  public pickupRange: number; // 拾取范围
  public kill_score: number; // NPC被击杀时获得的分数
  public loot: NpcLoot[]; // 战利品配置(击杀后按概率掉落),默认空数组
  public deathLootProcessed: boolean; // 死亡战利品是否已结算(防止重复掉落)
  /**
   * 主人(玩家)的射速倍率,由权威端每帧同步。
   * 从者(ownerId !== null)开火间隔按该倍率缩放,实现"从者子弹射速同步受玩家专研影响"。
   */
  public ownerFireRateMultiplier: number = 1;
  /**
   * 最后一次对本次击杀产生贡献的玩家 id(用于"幸运之星"结算战利品加成)。
   * 由权威端在子弹击杀时写入,仅服务端/Worker 使用,不参与渲染。
   */
  public lastKillerPlayerId: number | null = null;
  /**
   * NPC 等级(默认 0)。等级越高能力越强,由刷怪逻辑在创建后调用 applyNpcLevel 设置。
   * 等级影响:移动速度、子弹速度、攻击间隔、闪现冷却、生命值(紫盾)、经验值。
   */
  public level: number = 0;
  /** 首次应用等级时的基础移动速度(用于在基础值上叠加等级增益,避免重复叠加) */
  private baseMinMoveSpeed: number | null = null;
  private baseMaxMoveSpeed: number | null = null;
  private baseSpeed: number | null = null;

  constructor(
    position: Point,
    ownerId: number | null,
    teamId: number | null,
    texturePath: string,
    name: string,
    attitude: NpcAttitude,
    pickupRange: number,
    tag: string
  ) {
    super(position, NpcDynamicEntity.WIDTH, NpcDynamicEntity.HEIGHT, texturePath, name, 'npc', tag);
    // 身体显示面积缩小为 RENDER_SIZE × RENDER_SIZE,碰撞箱保持 WIDTH × HEIGHT
    this.renderWidth = NpcDynamicEntity.RENDER_SIZE;
    this.renderHeight = NpcDynamicEntity.RENDER_SIZE;
    this.attitude = attitude;
    this.pickupRange = pickupRange;
    this.ownerId = ownerId;
    this.teamId = teamId;
    this.kill_score = 1;
    this.game_exp = 2;// NPC 默认携带的游戏经验值
    this.loot = [];// 默认不掉落任何战利品
    this.deathLootProcessed = false;
  }

  public abstract actionLoop(context: ActionLoopContext): void;
  public abstract action(context: ActionLoopContext): void;
  public abstract actionBefore(context: ActionLoopContext): void;
  public abstract actionAfter(context: ActionLoopContext): void;

  /**
   * 当前是否允许被玩家吸附为从者(吸附逻辑的唯一门禁)。
   *
   * <p>默认允许;子类可覆写以拒绝,例如象牙游荡者被激怒时不接受任何玩家的吸附。</p>
   */
  public canBeAbsorbedAsServant(): boolean {
    return true;
  }

  /**
   * 行为循环的时间推进量。
   *
   * 无主 NPC 返回原 dt;玩家从者的开火节奏按其主人的射速倍率加速
   * (倍率 > 1 时冷却流逝更快 → 开火更频繁),实现从者射速与玩家专研同步。
   */
  protected getActionDelta(dt: number): number {
    if (this.ownerId === null) return dt;
    const multiplier = Number.isFinite(this.ownerFireRateMultiplier) && this.ownerFireRateMultiplier > 0
      ? this.ownerFireRateMultiplier
      : 1;
    return dt * multiplier;
  }

  ////////////////////
  // 等级 -->
  ////////////////////

  /** 等级上限(子类覆盖;同时决定刷怪时使用的等级概率表) */
  public getMaxLevel(): number {
    return 5;
  }

  /** 每级移动速度增益(px/s,子类覆盖:红像素为 40,其余为 20) */
  protected getMoveSpeedBonusPerLevel(): number {
    return 20;
  }

  /** 每级子弹速度增益(px/s) */
  public getBulletSpeedBonus(): number {
    return this.level * 60;
  }

  /** 本 NPC 发射子弹时的速度(基础子弹速度 + 等级增益) */
  protected getBulletMoveSpeed(): number {
    return BulletDynamicEntity.MOVE_SPEED + this.getBulletSpeedBonus();
  }

  /**
   * 应用 NPC 等级:设置等级并重算与等级相关的属性。
   *
   * 由刷怪逻辑在创建实体后调用;构造阶段等级恒为 0(即各公式的基准值)。
   * 重复调用是幂等的(移动速度始终基于首次调用的基础值重新计算)。
   */
  public applyNpcLevel(level: number): void {
    const clamped = Math.max(0, Math.min(this.getMaxLevel(), Math.floor(level)));
    this.level = clamped;
    this.applyMoveSpeedBonus();
    this.onNpcLevelApplied();
  }

  /** 在基础移动速度上叠加 等级 × 每级增益 */
  private applyMoveSpeedBonus(): void {
    if (this.baseMinMoveSpeed === null) {
      this.baseMinMoveSpeed = this.minMoveSpeed;
      this.baseMaxMoveSpeed = this.maxMoveSpeed;
      this.baseSpeed = this.speed;
    }
    const bonus = this.getMoveSpeedBonusPerLevel() * this.level;
    this.minMoveSpeed = this.baseMinMoveSpeed + bonus;
    this.maxMoveSpeed = (this.baseMaxMoveSpeed ?? this.maxMoveSpeed) + bonus;
    this.speed = (this.baseSpeed ?? this.speed) + bonus;
  }

  /** 等级变化时重算等级相关属性(生命/经验/攻击间隔等),由子类覆盖 */
  protected onNpcLevelApplied(): void {
    // 默认无额外等级属性
  }

  /**
   * 绘制 NPC 等级徽标(仅当调试标志 showLevel 开启时)。
   * 由各 NPC 的 draw() 末尾调用。
   */
  protected drawNpcLevelBadge(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    debugFlags?: EntityDebugFlags
  ): void {
    if (!debugFlags?.showLevel) return;
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const text = `Lv.${this.level}`;

    ctx.save();
    ctx.font = 'bold 11px Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const boxWidth = ctx.measureText(text).width + 8;
    const boxHeight = 14;
    const boxX = screenPos.x - boxWidth / 2;
    const boxY = screenPos.y - this.renderHeight / 2 - boxHeight - 4;

    ctx.fillStyle = this.level > 0 ? 'rgba(24, 14, 4, 0.78)' : 'rgba(6, 14, 26, 0.72)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = this.level > 0 ? 'rgba(255, 207, 77, 0.85)' : 'rgba(0, 229, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);
    ctx.fillStyle = this.level > 0 ? '#ffe6a3' : '#8ff0ff';
    ctx.fillText(text, screenPos.x, boxY + boxHeight / 2 + 0.5);
    ctx.restore();
  }

  ////////////////////
  // <-- 等级
  ////////////////////
}

export { NpcDynamicEntity };
