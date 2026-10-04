import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import { OrdinaryBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
import { Oa18ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Oa18ShootSkill/Oa18ShootSkill';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 行为阶段
 * - wander  :随机游走(与其他 NPC 相同的游走逻辑)
 * - shooting:到达目标后停住,按固定节奏环形扫射
 * - idle    :一轮扫射结束,等待权威端分配新的游走目标(避免原地无限连发)
 */
type FireworkPhase = 'wander' | 'shooting' | 'idle';

/**
 * 敌对 NPC「PurpleFireworkOa18」(紫色烟花 oa18)。
 *
 * <p>行为循环:随机游走 → 停住并放射子弹 → 随机游走(循环)。</p>
 * <ul>
 *   <li>停住后以正西为起点、顺时针每 20° 射出一发普通子弹,每 5 游戏刻一发,共 18 发
 *       (恰好扫满 360° 一圈);</li>
 *   <li>等级越高:环射节奏越快(每发间隔 5 - Level 刻)、移动速度越快(每级 +20);</li>
 *   <li>无拖尾;子弹颜色固定为自身的 #E6D7FF;</li>
 *   <li>被击杀后概率掉落「环射烟花」技能球。</li>
 * </ul>
 */
class PurpleFireworkOa18Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.21;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '紫色烟花';

  /** 主色调 */
  public static readonly MAIN_COLOR = '#C6A4F2';
  /** 辉光色调 */
  public static readonly GLOW_COLOR = '#D6B5FF';
  /** 子弹颜色 */
  public static readonly BULLET_COLOR = '#E6D7FF';

  /** 每发子弹之间的游戏刻间隔(等级 0 的基准值) */
  private static readonly SHOT_TICK_INTERVAL = 5;
  /** 每提高 1 级缩短的刻间隔(射速随等级提升) */
  private static readonly SHOT_TICK_INTERVAL_PER_LEVEL = 1;
  /** 刻间隔下限(避免高等级下瞬发) */
  private static readonly SHOT_TICK_INTERVAL_MIN = 2;
  /** 一轮扫射的子弹总数(18 × 20° = 360°) */
  private static readonly SHOT_COUNT = Oa18ShootSkill.SHOT_COUNT;
  /** 起始角度(角度制):正西 */
  private static readonly START_ANGLE_DEG = Oa18ShootSkill.START_ANGLE_DEG;
  /** 相邻两发的夹角(角度制,顺时针) */
  private static readonly ANGLE_STEP_DEG = Oa18ShootSkill.ANGLE_STEP_DEG;
  /** 每级移动速度增益(px/s) */
  private static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 基础掉落经验值(等级不改变该值) */
  private static readonly BASE_GAME_EXP = 6;
  /** 击杀获得的分数 */
  private static readonly KILL_SCORE = 2;
  /** 掉落技能球的概率 */
  private static readonly LOOT_ODDS = 0.05;
  /** idle 阶段的安全超时(游戏刻):长时间未获得新目标时允许再次扫射,避免永久停摆 */
  private static readonly IDLE_TIMEOUT_TICKS = 100;

  /** 当前行为阶段 */
  private phase: FireworkPhase = 'wander';
  /** 当前扫射的子弹序号(0 ~ SHOT_COUNT) */
  private shotsFired = 0;
  /** 距下一发子弹还需等待的游戏刻数 */
  private shotTickCounter = 0;
  /** 当前瞄准角度(角度制,每发递减 ANGLE_STEP_DEG 实现顺时针旋转) */
  private currentAngleDeg = PurpleFireworkOa18Entity.START_ANGLE_DEG;
  /** idle 阶段已等待的游戏刻数 */
  private idleTickCounter = 0;

  constructor(
    position: Point,
    ownerId: number | null,
    teamId: number | null
  ) {
    super(position, ownerId, teamId, '', '', 0, 'purple_firework_oa18');
    this.fillColor = PurpleFireworkOa18Entity.MAIN_COLOR;
    this.strokeColor = PurpleFireworkOa18Entity.GLOW_COLOR;
    this.health = 1;
    this.healthMax = 1;
    this.kill_score = PurpleFireworkOa18Entity.KILL_SCORE;
    this.game_exp = PurpleFireworkOa18Entity.BASE_GAME_EXP;
    this.mapColor = PurpleFireworkOa18Entity.MAIN_COLOR;
    // 战利品:击杀后概率掉落其持有的「环射烟花」技能球
    this.loot = [
      { type: 'skillOrb', tag: Oa18ShootSkill.TAG, odds: PurpleFireworkOa18Entity.LOOT_ODDS }
    ];
  }

  public tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  public pickupItem(_item: ItemEntity): void {
    // 紫色烟花不拾取任何物品
  }

  /** 等级上限:2(与其他上限 2 的 NPC 共用 3 档等级概率表) */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益:20(移动速度随等级提升) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return PurpleFireworkOa18Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算等级相关属性:经验值固定为基础值,仅射速/移速随等级变化 */
  protected override onNpcLevelApplied(): void {
    this.game_exp = PurpleFireworkOa18Entity.BASE_GAME_EXP;
  }

  /** 当前每发子弹的刻间隔:等级越高越短(射速越快) */
  private getShotTickInterval(): number {
    return Math.max(
      PurpleFireworkOa18Entity.SHOT_TICK_INTERVAL_MIN,
      PurpleFireworkOa18Entity.SHOT_TICK_INTERVAL
        - PurpleFireworkOa18Entity.SHOT_TICK_INTERVAL_PER_LEVEL * this.level
    );
  }

  /**
   * 每帧更新:
   * 1. 被玩家吸附时锁定在主人的从者网格格子上(与白像素一致);
   * 2. 无主时走常规游走逻辑,到达目标停住后由 updateStayDuration 切换到环形扫射。
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.ownerId !== null) {
      // 从者:瞬移到主人分配的格子中心,不自行游走(也不会发动环射,见 actionLoop)。
      // 同时重置行为阶段:从者可能因网格断连而被释放回野生状态(不会被杀死),
      // 若不重置会永久卡在“扫射中”(既不移动也不开火)。
      this.resetToWander();
      for (const player of dynamicEntity.playerDynamicEntitys) {
        if (player.id !== this.ownerId) continue;
        const servant = player.selectServantByID(this.id);
        if (servant === null) continue;
        const newPosition = player.rowColToWorldPosition(servant.row, servant.col);
        if (newPosition === null) continue;
        this.position.x = newPosition.x;
        this.position.y = newPosition.y;
        this.updateCollisionBox();
        this.isMoving = false;
        this.nextTarget = { ...newPosition };
        this.targetHistory = [{ ...newPosition }];
        this.curvePoints = [{ ...newPosition }];
        this.currentCurveIndex = 0;
      }
      return;
    }

    super.update(dt, staticEntities, dynamicEntity, gameConfig);

    if (this.isDead) return;
  }

  /**
   * 到达游走目标停住后进入环形扫射阶段;扫射结束后等待新的游走目标。
   * (在权威端每帧的 updateStayDuration 时机被调用,因此可直接观察 isMoving)
   */
  public override updateStayDuration(dt: number): void {
    if (this.isDead || this.ownerId !== null) return;

    if (this.phase === 'wander') {
      if (!this.isMoving) {
        this.startShooting();
      }
      return;
    }

    if (this.phase === 'idle') {
      // 已获得新的游走目标 → 回到游走阶段;超时保护避免永久停摆
      this.idleTickCounter += 1;
      if (this.isMoving || this.idleTickCounter >= PurpleFireworkOa18Entity.IDLE_TIMEOUT_TICKS) {
        this.phase = 'wander';
        this.idleTickCounter = 0;
      }
      return;
    }

    // 扫射阶段:保持驻足(不参与随机驻足计时)
  }

  /**
   * 扫射期间不重新分配游走目标,保证一轮 18 发完整打出。
   */
  public override canGetNewWanderTarget(dt: number, staticEntities: StaticEntity[]): boolean {
    if (this.phase === 'shooting') return false;
    return super.canGetNewWanderTarget(dt, staticEntities);
  }

  /**
   * 扫射期间停住是"有意为之"而非卡住,不触发长时间未位移的重新寻路。
   */
  public override updateNoMovementWatchdog(_dt: number): boolean {
    if (this.phase === 'shooting') return false;
    return super.updateNoMovementWatchdog(_dt);
  }

  /** 进入环形扫射阶段:停止移动并重置扫射状态 */
  private startShooting(): void {
    this.phase = 'shooting';
    this.shotsFired = 0;
    this.shotTickCounter = 0;
    this.currentAngleDeg = PurpleFireworkOa18Entity.START_ANGLE_DEG;
    this.stayDurationRemaining = 0;
    this.idleTickCounter = 0;
    this.stop();
  }

  /** 回到游走阶段并清空扫射/等待状态 */
  private resetToWander(): void {
    this.phase = 'wander';
    this.shotsFired = 0;
    this.shotTickCounter = 0;
    this.currentAngleDeg = PurpleFireworkOa18Entity.START_ANGLE_DEG;
    this.idleTickCounter = 0;
  }

  /** 结束一轮扫射:转入 idle,等待权威端分配新的游走目标 */
  private finishShooting(): void {
    this.phase = 'idle';
    this.shotsFired = 0;
    this.shotTickCounter = 0;
    this.currentAngleDeg = PurpleFireworkOa18Entity.START_ANGLE_DEG;
    this.idleTickCounter = 0;
    this.stayDurationRemaining = 0;
  }

  ////////////////////
  // 攻击 -->
  ////////////////////

  /**
   * 行为循环:仅负责"按刻节奏推进环形扫射"。
   * 每 5 游戏刻(随等级缩短)发射一发;从者不发动该攻击。
   */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    // 从者不发动环形扫射(避免从者持续刷出一整圈子弹)
    if (this.ownerId !== null) return;
    if (this.phase !== 'shooting') return;

    this.shotTickCounter += 1;
    if (this.shotTickCounter < this.getShotTickInterval()) return;

    this.shotTickCounter = 0;
    this.action(context);
    this.shotsFired += 1;
    if (this.shotsFired >= PurpleFireworkOa18Entity.SHOT_COUNT) {
      this.finishShooting();
    }
  }

  /** 行为前置:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 行为后置:无动作 */
  public override actionAfter(_context: ActionLoopContext): void {
    // 无动作
  }

  /**
   * 发射一发普通子弹,并把瞄准角度顺时针旋转 20°。
   * 初始角度为正西(180°),18 发后恰好回到起点。
   */
  public override action(context: ActionLoopContext): void {
    if (this.isDead || !context) return;

    const angleRad = (this.currentAngleDeg * Math.PI) / 180;
    const direction: Point = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
    const spawnDistance = this.width * 0.6;
    context.spawnBullet(
      new OrdinaryBulletDynamicEntity(
        {
          x: this.position.x + direction.x * spawnDistance,
          y: this.position.y + direction.y * spawnDistance
        },
        direction,
        this.id,
        this.teamId,
        '',
        PurpleFireworkOa18Entity.BULLET_COLOR,
        this.getBulletMoveSpeed()
      )
    );

    // 顺时针旋转(世界坐标 y 轴向上,角度递减即顺时针)
    this.currentAngleDeg -= PurpleFireworkOa18Entity.ANGLE_STEP_DEG;
  }

  ////////////////////
  // <-- 攻击
  ////////////////////

  /**
   * 绘制实体:辉光(辉光色调) + 主体(主色调) + 受伤闪烁。
   * 该 NPC 无拖尾。
   */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    // 绘制使用渲染尺寸(仅视觉);碰撞与战斗判定仍使用 this.width / this.height
    const drawW = this.renderWidth;
    const drawH = this.renderHeight;
    const halfW = drawW / 2;
    const halfH = drawH / 2;
    const left = screenPos.x - halfW;
    const top = screenPos.y - halfH;

    ctx.save();

    // 辉光:身体外围的柔和光晕(辉光色调,由内向外逐层变淡)
    for (let layer = 1; layer <= 3; layer++) {
      const glowSize = drawW * (1 + layer * 0.24);
      ctx.globalAlpha = 0.14 / layer;
      ctx.fillStyle = PurpleFireworkOa18Entity.GLOW_COLOR;
      ctx.fillRect(screenPos.x - glowSize / 2, screenPos.y - glowSize / 2, glowSize, glowSize);
    }
    ctx.globalAlpha = 1;

    // 主体
    ctx.fillStyle = this.fillColor || PurpleFireworkOa18Entity.MAIN_COLOR;
    ctx.fillRect(left, top, drawW, drawH);
    ctx.strokeStyle = this.strokeColor || PurpleFireworkOa18Entity.GLOW_COLOR;
    ctx.strokeRect(left, top, drawW, drawH);

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, drawW, drawH);
      ctx.restore();
    }

    ctx.restore();

    // 等级徽标(调试开关 showLevel 开启时)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);
  }
}

export { PurpleFireworkOa18Entity };
