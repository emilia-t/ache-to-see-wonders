import { BuckshotBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BuckshotBulletDynamicEntity/BuckshotBulletDynamicEntity';
import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 敌对 NPC「MagentaSwarmSw5」(品红蜂群 sw5)。
 *
 * <p>行为:高速游走、血量极低的"蜂群"型敌人 —— 只有<b>移动时</b>才会开火,
 * 每次向前方射出一束 3 发扇形霰弹(±12°),逼迫玩家在近距离开火前拉开距离。</p>
 *
 * <p>等级差异:掉落经验 exp = 2 + 2 × Level;射击间隔随等级缩短(1.2 - 0.1 × Level 秒);
 * 每级移动速度 +25(高于普通 NPC 的 +20,强化"蜂群"的机动压迫感)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
class MagentaSwarmSw5Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.17;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '品红蜂群';

  /** 主色调(品红) */
  public static readonly MAIN_COLOR = '#E0479E';
  /** 辉光/描边色 */
  public static readonly GLOW_COLOR = '#FFB3DE';

  /** 基准射击间隔(秒) */
  public static readonly ACTION_INTERVAL = 1.2;
  /** 每级缩短的射击间隔(秒) */
  public static readonly ACTION_INTERVAL_PER_LEVEL = 0.1;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 2;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 2;
  /** 每级移动速度增益(高于普通 NPC) */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 25;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 120;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 170;
  /** 每次齐射的弹丸数量 */
  public static readonly PELLETS_PER_VOLLEY: number = 3;
  /** 扇形半张角(度):弹丸以该角度均匀铺开 */
  public static readonly SPREAD_HALF_ANGLE_DEG: number = 12;

  /** 是否处于行动循环中 */
  private isActionLoopRunning = false;
  /** 射击冷却剩余(秒) */
  private actionCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'magenta_swarm_sw5');
    this.fillColor = MagentaSwarmSw5Entity.MAIN_COLOR;
    this.strokeColor = MagentaSwarmSw5Entity.GLOW_COLOR;
    this.health = MagentaSwarmSw5Entity.HEALTH_BASE;
    this.healthMax = MagentaSwarmSw5Entity.HEALTH_BASE;
    this.kill_score = MagentaSwarmSw5Entity.KILL_SCORE;
    this.game_exp = MagentaSwarmSw5Entity.BASE_GAME_EXP;
    this.mapColor = MagentaSwarmSw5Entity.MAIN_COLOR;
    this.minMoveSpeed = MagentaSwarmSw5Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = MagentaSwarmSw5Entity.MAX_MOVE_SPEED;
    this.speed = MagentaSwarmSw5Entity.MIN_MOVE_SPEED;
    this.loot = [
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:5(与其他上限 5 的 NPC 共用 6 档等级概率表) */
  public override getMaxLevel(): number {
    return 5;
  }

  /** 每级移动速度增益:蜂群 +25,略高于普通 NPC */
  protected override getMoveSpeedBonusPerLevel(): number {
    return MagentaSwarmSw5Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.game_exp = MagentaSwarmSw5Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前射击间隔(秒):随等级缩短,下限 0.3 秒 */
  private getActionInterval(): number {
    return Math.max(
      0.3,
      MagentaSwarmSw5Entity.ACTION_INTERVAL
        - MagentaSwarmSw5Entity.ACTION_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行动开始:立即齐射一次并重置冷却 */
  public override actionBefore(context: ActionLoopContext): void {
    this.isActionLoopRunning = true;
    this.action(context);
    this.actionCooldownRemaining = this.getActionInterval();
  }

  /**
   * 主循环:无主时只在移动中开火(与白像素同款节奏);成为从者后不再受移动限制。
   */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.ownerId === null) {
      if (this.isDead || !this.isMoving) {
        if (this.isActionLoopRunning) this.actionAfter(context);
        return;
      }
      if (!this.isActionLoopRunning) {
        this.actionBefore(context);
        return;
      }
      this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
      while (this.actionCooldownRemaining <= 0 && this.isMoving && !this.isDead) {
        this.action(context);
        this.actionCooldownRemaining += this.getActionInterval();
      }
      return;
    }

    if (this.isDead) {
      if (this.isActionLoopRunning) this.actionAfter(context);
      return;
    }
    if (!this.isActionLoopRunning) {
      this.actionBefore(context);
      return;
    }
    this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.actionCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += this.getActionInterval();
    }
  }

  /** 向前方射出一束 3 发扇形霰弹 */
  public override action(context: ActionLoopContext): void {
    const baseAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
    const spawnDistance = this.width * 0.6;
    const pellets = MagentaSwarmSw5Entity.PELLETS_PER_VOLLEY;
    for (let i = 0; i < pellets; i++) {
      // 以中心弹丸为对称轴,把弹丸均匀铺成扇形
      const t = pellets === 1 ? 0 : (i / (pellets - 1)) * 2 - 1; // -1 .. 1
      const angle = baseAngle + t * (MagentaSwarmSw5Entity.SPREAD_HALF_ANGLE_DEG * Math.PI / 180);
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      context.spawnBullet(
        new BuckshotBulletDynamicEntity(
          {
            x: this.position.x + direction.x * spawnDistance,
            y: this.position.y + direction.y * spawnDistance
          },
          direction,
          this.id,
          this.teamId
        )
      );
    }
  }

  /** 行动结束:清除运行标记与冷却 */
  public override actionAfter(_context: ActionLoopContext): void {
    this.isActionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  /** 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上,否则走常规游走 */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;
    if (this.ownerId !== null) {
      this.followOwner(dynamicEntity);
      return;
    }
    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  /** 从者跟随:瞬移到主人在从者网格中分配的格子中心 */
  private followOwner(dynamicEntity: DynamicEntitieList): void {
    for (const player of dynamicEntity.playerDynamicEntitys) {
      if (player.id !== this.ownerId) continue;
      const servant = player.selectServantByID(this.id);
      if (servant === null) return;
      const newPosition = player.rowColToWorldPosition(servant.row, servant.col);
      if (newPosition === null) return;
      this.position.x = newPosition.x;
      this.position.y = newPosition.y;
      this.updateCollisionBox();
      this.isMoving = false;
      this.nextTarget = { ...newPosition };
      this.targetHistory = [{ ...newPosition }];
      this.curvePoints = [{ ...newPosition }];
      this.currentCurveIndex = 0;
      return;
    }
  }

  /** 绘制:品红主体 + 四角翼片(蜂群感)+ 受伤闪烁 + 等级徽标 */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const w = this.renderWidth;
    const h = this.renderHeight;
    const left = screenPos.x - w / 2;
    const top = screenPos.y - h / 2;

    ctx.save();

    // 四角翼片:上下左右各探出一小块,呈"蜂群"外形
    ctx.fillStyle = MagentaSwarmSw5Entity.GLOW_COLOR;
    const wing = 3;
    ctx.fillRect(screenPos.x - wing / 2, top - wing, wing, wing);
    ctx.fillRect(screenPos.x - wing / 2, top + h, wing, wing);
    ctx.fillRect(left - wing, screenPos.y - wing / 2, wing, wing);
    ctx.fillRect(left + w, screenPos.y - wing / 2, wing, wing);

    // 主体
    ctx.fillStyle = this.fillColor || MagentaSwarmSw5Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || MagentaSwarmSw5Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, w, h);
    }
    ctx.restore();

    // NPC 等级徽标(/show_level)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);

    // 调试信息:tag
    if (debugFlags) {
      if (debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + (this.renderHeight/2) + 20);
      }
    }
  }
}

export { MagentaSwarmSw5Entity };
