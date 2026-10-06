import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import { LaserBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';
import { Ls1ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Ls1ShootSkill/Ls1ShootSkill';
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
 * - wander   :直线游走(与其他 NPC 相同的游走逻辑,但偏好直线路径)
 * - attacking:到达目标后停住,朝固定攻击方向发射一束激光并等待其消失
 * - idle     :激光消失(攻击结束),等待权威端分配新的游走目标
 */
type LoneLs1Phase = 'wander' | 'attacking' | 'idle';

/**
 * 八方向攻击方向(世界坐标 y 轴向上):
 * 东 / 南 / 西 / 北 / 东南 / 西南 / 东北 / 西北。
 */
const H_EIGHT_DIRECTIONS: readonly Point[] = [
  { x: 1, y: 0 },                              // 东
  { x: 0, y: -1 },                             // 南
  { x: -1, y: 0 },                             // 西
  { x: 0, y: 1 },                              // 北
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },       // 东南
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },      // 西南
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },        // 东北
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 }        // 西北
];

/**
 * 敌对 NPC「OnahauLoneLs1」(幽蓝孤光 ls1)。
 *
 * <p>行为循环:直线移动 → 停住并朝固定方向发射一束激光 → 激光消失(攻击结束)→ 继续移动。</p>
 * <ul>
 *   <li>攻击方向在出生时从八方向中随机选定一次,此后固定不变,不随移动方向改变;</li>
 *   <li>激光长度随等级成长:length = 1200 + Level × 200(px);</li>
 *   <li>激光持续发光时长随等级成长:duration_tick = 75 + Level × 20(tick);</li>
 *   <li>激光子弹速度固定 LASER_EXPAND_SPEED px/s,不随等级变化;</li>
 *   <li>掉落经验值 exp = 3 + Level;移动速度增益与其他敌对 NPC 相同(每级 +20);</li>
 *   <li>被击杀后概率掉落「激光束」技能球。</li>
 * </ul>
 */
class OnahauLoneLs1Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.14;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '幽蓝孤光';

  /** 主色调 */
  public static readonly MAIN_COLOR = '#91e4ff';
  /** 辉光色调(同时作为描边色) */
  public static readonly GLOW_COLOR = '#e1f8ff';
  /** 激光主色 */
  public static readonly LASER_COLOR = '#C2F0FF';
  /** 激光辉光色 */
  public static readonly LASER_GLOW_COLOR = '#E6F6FA';
  /** 激光展开速度(px/s):不随等级变化 */
  public static readonly LASER_EXPAND_SPEED = 20000;
  /** 激光长度基准(px,等级 0) */
  private static readonly LASER_LENGTH_BASE = 1200;
  /** 每级增加的激光长度(px) */
  private static readonly LASER_LENGTH_PER_LEVEL = 200;
  /** 激光持续发光时长基准(tick,等级 0) */
  private static readonly LASER_DURATION_TICKS_BASE = 75;
  /** 每级增加的激光持续发光时长(tick) */
  private static readonly LASER_DURATION_TICKS_PER_LEVEL = 20;
  /** 基础掉落经验值 */
  private static readonly BASE_GAME_EXP = 3;
  /** 击杀获得的分数 */
  private static readonly KILL_SCORE = 3;
  /** 掉落技能球的概率 */
  private static readonly LOOT_ODDS = 0.2;
  /** idle 阶段的安全超时(游戏刻):长时间未获得新目标时允许再次攻击,避免永久停摆 */
  private static readonly IDLE_TIMEOUT_TICKS = 100;
  /** 从者攻击间隔基准(秒) */
  private static readonly SERVANT_ATTACK_INTERVAL_BASE = 6;
  /** 每提高 1 级缩短的从者攻击间隔(秒) */
  private static readonly SERVANT_ATTACK_INTERVAL_PER_LEVEL = 0.4;
  /** 从者攻击间隔下限(秒):n 至少为 4 */
  private static readonly SERVANT_ATTACK_INTERVAL_MIN = 4;

  /** 固定攻击方向(出生时随机选定八方向之一,此后不变) */
  private readonly attackDirection: Point;
  /** 当前行为阶段 */
  private phase: LoneLs1Phase = 'wander';
  /** 本次攻击剩余时长(秒):从发射激光到激光完全消失 */
  private attackRemaining = 0;
  /** 本次攻击是否已发射激光 */
  private laserFired = false;
  /** idle 阶段已等待的游戏刻数 */
  private idleTickCounter = 0;
  /** 从者:距下一轮激光攻击的剩余秒数(<= 0 时发射一束激光) */
  private servantAttackCooldown = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'onahau_lone_ls1');
    this.fillColor = OnahauLoneLs1Entity.MAIN_COLOR;
    this.strokeColor = OnahauLoneLs1Entity.GLOW_COLOR;
    this.health = 1;
    this.healthMax = 1;
    this.kill_score = OnahauLoneLs1Entity.KILL_SCORE;
    this.game_exp = OnahauLoneLs1Entity.BASE_GAME_EXP;
    this.mapColor = OnahauLoneLs1Entity.MAIN_COLOR;
    // 出生时随机选定一个八方向作为固定攻击方向
    this.attackDirection = { ...H_EIGHT_DIRECTIONS[Math.floor(Math.random() * H_EIGHT_DIRECTIONS.length)] };
    // 战利品:击杀后概率掉落其持有的「激光束」技能球
    this.loot = [
      { type: 'skillOrb', tag: Ls1ShootSkill.TAG, odds: OnahauLoneLs1Entity.LOOT_ODDS }
    ];
  }

  public tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  public pickupItem(_item: ItemEntity): void {
    // 幽蓝孤光不拾取任何物品
  }

  /** 等级上限:5(与其他上限 5 的 NPC 共用 6 档等级概率表) */
  public override getMaxLevel(): number {
    return 5;
  }

  /** 等级变化时重算等级相关属性:经验值随等级提升 */
  protected override onNpcLevelApplied(): void {
    this.game_exp = OnahauLoneLs1Entity.BASE_GAME_EXP + this.level;
  }

  /** 当前等级的激光长度(px):length = 1200 + Level × 200 */
  private getLaserLength(): number {
    return OnahauLoneLs1Entity.LASER_LENGTH_BASE
      + OnahauLoneLs1Entity.LASER_LENGTH_PER_LEVEL * this.level;
  }

  /** 当前等级的激光持续发光时长(tick):duration_tick = 75 + Level × 20 */
  private getLaserDurationTicks(): number {
    return OnahauLoneLs1Entity.LASER_DURATION_TICKS_BASE
      + OnahauLoneLs1Entity.LASER_DURATION_TICKS_PER_LEVEL * this.level;
  }

  /** 一次攻击的总时长(秒) = 激光展开 + 渐亮 + 持续发光 + 渐暗 */
  private getAttackDurationSeconds(): number {
    const expandSeconds = this.getLaserLength() / OnahauLoneLs1Entity.LASER_EXPAND_SPEED;
    const holdSeconds = this.getLaserDurationTicks() * LaserBulletDynamicEntity.TICK_SECONDS;
    return expandSeconds
      + LaserBulletDynamicEntity.FADE_IN_SECONDS
      + holdSeconds
      + LaserBulletDynamicEntity.FADE_OUT_SECONDS;
  }

  /** 直线行走:强制以直线路径前往目标 */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    return super.setTarget(target, staticEntities, { preferStraight: true });
  }

  /**
   * 每帧更新:
   * 1. 被玩家吸附时锁定在主人的从者网格格子上(与白像素一致);
   * 2. 无主时走常规游走逻辑,到达目标停住后由 updateStayDuration 切换到攻击阶段。
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;

    if (this.ownerId !== null) {
      // 从者:瞬移到主人分配的格子中心,不自行游走也不发动激光。
      // 同时重置行为阶段:从者可能因网格断连而被释放回野生状态(不会被杀死),
      // 若不重置会永久卡在"攻击中"(既不移动也不开火)。
      this.resetToWander();
      this.followOwner(dynamicEntity);
      return;
    }

    super.update(dt, staticEntities, dynamicEntity, gameConfig);

    // 朝向始终锁定为固定攻击方向:
    // 一方面语义上"炮口一直指着攻击方向",另一方面朝向会随快照下发给客户端,
    // 使多人模式下客户端也能画出正确的炮口标记(客户端拿不到 attackDirection)。
    this.facingDirection = { ...this.attackDirection };
  }

  /**
   * 到达游走目标停住后进入攻击阶段;攻击结束(激光消失)后等待新的游走目标。
   * (在权威端每帧的 updateStayDuration 时机被调用,因此可直接观察 isMoving)
   */
  public override updateStayDuration(dt: number): void {
    if (this.isDead || this.ownerId !== null) return;

    if (this.phase === 'wander') {
      if (!this.isMoving) {
        this.startAttacking();
      }
      return;
    }

    if (this.phase === 'attacking') {
      // 保持驻足,等待激光走完整个生命周期(展开 → 渐亮 → 持续发光 → 渐暗)
      this.attackRemaining -= dt;
      if (this.attackRemaining <= 0) {
        this.phase = 'idle';
        this.idleTickCounter = 0;
      }
      return;
    }

    // idle:已获得新的游走目标 → 回到游走阶段;超时保护避免永久停摆
    this.idleTickCounter += 1;
    if (this.isMoving || this.idleTickCounter >= OnahauLoneLs1Entity.IDLE_TIMEOUT_TICKS) {
      this.phase = 'wander';
      this.idleTickCounter = 0;
    }
  }

  /** 攻击期间不重新分配游走目标,保证激光完整走完生命周期;从者同样不参与游走 */
  public override canGetNewWanderTarget(dt: number, staticEntities: StaticEntity[]): boolean {
    if (this.ownerId !== null) return false;
    if (this.phase !== 'wander') return false;
    return super.canGetNewWanderTarget(dt, staticEntities);
  }

  /** 攻击期间停住是"有意为之"而非卡住,不触发长时间未位移的重新寻路;从者同样不参与 */
  public override updateNoMovementWatchdog(_dt: number): boolean {
    if (this.ownerId !== null) return false;
    if (this.phase !== 'wander') return false;
    return super.updateNoMovementWatchdog(_dt);
  }

  /** 进入攻击阶段:停止移动并重置攻击状态(激光在紧随其后的 actionLoop 中发射) */
  private startAttacking(): void {
    this.phase = 'attacking';
    this.laserFired = false;
    this.attackRemaining = this.getAttackDurationSeconds();
    this.idleTickCounter = 0;
    this.stayDurationRemaining = 0;
    this.stop();
  }

  /** 回到游走阶段并清空攻击/等待状态 */
  private resetToWander(): void {
    this.phase = 'wander';
    this.laserFired = false;
    this.attackRemaining = 0;
    this.idleTickCounter = 0;
  }

  ////////////////////
  // 攻击 -->
  ////////////////////

  /**
   * 行为循环:
   * - 无主时进入攻击阶段后朝固定攻击方向发射一束激光(一次攻击只发射一束);
   * - 从者(被玩家吸附)每隔 n 秒(6 - Level × 0.4,最小 4 秒)发射一束同样的激光。
   */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;

    // 从者:不再自行游走,改为按固定时间间隔发射激光
    if (this.ownerId !== null) {
      this.servantActionLoop(context);
      return;
    }

    if (this.phase !== 'attacking' || this.laserFired) return;
    if (!context) return;

    this.laserFired = true;
    this.spawnLaser(context);
  }

  /**
   * 从者攻击朝固定攻击方向发射一束激光。
   *
   * <p>从者被锁定在主人的从者网格上,因此其激光总是从当前格子中心射出;
   * 一旦从者随玩家移动而瞬移,先前发射的激光会因"失去源头"被权威端移除
   * (见 Service.updateBulletEntities / World.updateBullets),不会留在原地。</p>
   *
   * 攻击节奏按主人的射速倍率缩放(getActionDelta),与其它从者一致。
   */
  private servantActionLoop(context: ActionLoopContext): void {
    if (!context) return;

    this.servantAttackCooldown -= this.getActionDelta(context.deltaTime);
    if (this.servantAttackCooldown > 0) return;

    this.servantAttackCooldown = this.getServantAttackIntervalSeconds();
    this.spawnLaser(context);
  }

  /** 从者攻击间隔(秒)*/
  private getServantAttackIntervalSeconds(): number {
    return Math.max(
      OnahauLoneLs1Entity.SERVANT_ATTACK_INTERVAL_MIN,
      OnahauLoneLs1Entity.SERVANT_ATTACK_INTERVAL_BASE
        - OnahauLoneLs1Entity.SERVANT_ATTACK_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行为前置:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 行为后置:无动作 */
  public override actionAfter(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 行为:发射激光(由 actionLoop 调用,保持 NpcDynamicEntity 的抽象约定) */
  public override action(context: ActionLoopContext): void {
    this.spawnLaser(context);
  }

  /** 朝固定攻击方向发射一束激光弹 */
  private spawnLaser(context: ActionLoopContext): void {
    if (this.isDead || !context) return;
    const direction = this.attackDirection;
    const spawnDistance = this.width * 0.6;
    const laser = new LaserBulletDynamicEntity(
      {
        x: this.position.x + direction.x * spawnDistance,
        y: this.position.y + direction.y * spawnDistance
      },
      { x: direction.x, y: direction.y },
      this.id,
      this.teamId,
      '',
      OnahauLoneLs1Entity.LASER_COLOR,
      {
        length: this.getLaserLength(),
        expandSpeed: OnahauLoneLs1Entity.LASER_EXPAND_SPEED,
        durationTicks: this.getLaserDurationTicks(),
        glowColor: OnahauLoneLs1Entity.LASER_GLOW_COLOR
      }
    );
    // 记录发射位置:权威端据此判断发射者是否已经移动(被推动/瞬移/重新游走),
    // 从而移除失去源头的激光
    laser.laserAnchor = { x: this.position.x, y: this.position.y };
    context.spawnBullet(laser);
  }

  ////////////////////
  // <-- 攻击
  ////////////////////

  /** 从者跟随:瞬移到主人在从者网格中分配的格子中心 */
  private followOwner(dynamicEntity: DynamicEntitieList): void {
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
      return;
    }
  }

  /**
   * 绘制实体:辉光(辉光色调) + 主体(主色调) + 攻击方向炮口标记 + 受伤闪烁。
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
    const left = screenPos.x - drawW / 2;
    const top = screenPos.y - drawH / 2;

    ctx.save();

    // 辉光:身体外围的柔和光晕(由内向外逐层变淡)
    for (let layer = 1; layer <= 3; layer++) {
      const glowSize = drawW * (1 + layer * 0.24);
      ctx.globalAlpha = 0.14 / layer;
      ctx.fillStyle = OnahauLoneLs1Entity.GLOW_COLOR;
      ctx.fillRect(screenPos.x - glowSize / 2, screenPos.y - glowSize / 2, glowSize, glowSize);
    }
    ctx.globalAlpha = 1;

    // 主体
    ctx.fillStyle = this.fillColor || OnahauLoneLs1Entity.MAIN_COLOR;
    ctx.fillRect(left, top, drawW, drawH);
    ctx.strokeStyle = this.strokeColor || OnahauLoneLs1Entity.GLOW_COLOR;
    ctx.strokeRect(left, top, drawW, drawH);

    // 攻击方向炮口标记(朝向即固定攻击方向,故多人下也正确)
    const markOffset = drawW * 0.42;
    const markSize = Math.max(2, drawW * 0.14);
    ctx.fillStyle = OnahauLoneLs1Entity.LASER_COLOR;
    ctx.fillRect(
      screenPos.x + this.facingDirection.x * markOffset - markSize / 2,
      screenPos.y - this.facingDirection.y * markOffset - markSize / 2,
      markSize,
      markSize
    );

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

    // 调试:预览其镭射攻击范围(固定攻击方向 + 当前等级的激光长度)
    if (debugFlags?.showLaserLine) {
      this.drawDebugLaserRange(ctx, worldToScreen);
    }

    // 等级徽标(调试开关 showLevel 开启时)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);
  }

  /**
   * 预览用的攻击方向。
   *
   * 必须取 facingDirection 而不是 attackDirection:多人模式下 attackDirection 由权威端
   * 本地随机生成、**不下发给客户端**,客户端实体构造时也会自行随机一个,用它预览会指向与
   * 实际激光完全无关的方向。facingDirection 随快照下发,且无主时被权威端每帧锁定为
   * attackDirection(从者期间保留最后一次的值),因此它是客户端唯一可靠的代理;
   * 这与炮口标记 `draw()` 的取值保持一致。
   */
  private getDebugAttackDirection(): Point | null {
    const facing = this.facingDirection;
    const facingLength = Math.hypot(facing?.x ?? 0, facing?.y ?? 0);
    if (facingLength > 0.0001) {
      return { x: facing.x / facingLength, y: facing.y / facingLength };
    }
    const attack = this.attackDirection;
    const attackLength = Math.hypot(attack.x, attack.y);
    if (attackLength > 0.0001) {
      return { x: attack.x / attackLength, y: attack.y / attackLength };
    }
    return null;
  }

  /**
   * 调试绘制:预览该 NPC 的镭射攻击范围(攻击方向 + 当前等级的激光长度)。
   *
   * 由调试指令 `/show_laser_line` 打开;起点、方向、长度均与实际发射的激光完全一致
   * (起点取 spawnLaser 的同一条表达式,故可与真实光束重叠),因此可在激光发射前
   * 就能看到它的攻击覆盖范围(被吸附为从者后同样适用)。
   */
  private drawDebugLaserRange(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number }
  ): void {
    const dir = this.getDebugAttackDirection();
    if (!dir) return;
    const length = this.getLaserLength();
    // 与实际发射完全一致:激光从"身体前沿"射出(spawnLaser 中的 spawnDistance)
    const spawnDistance = this.width * 0.6;
    const originWorldX = this.position.x + dir.x * spawnDistance;
    const originWorldY = this.position.y + dir.y * spawnDistance;
    const origin = worldToScreen(originWorldX, originWorldY);
    const tip = worldToScreen(
      originWorldX + dir.x * length,
      originWorldY + dir.y * length
    );

    ctx.save();

    // 判定带(与激光实体的命中宽度一致)
    ctx.strokeStyle = LaserBulletDynamicEntity.DEBUG_HIT_RANGE_COLOR;
    ctx.lineWidth = LaserBulletDynamicEntity.HIT_HALF_WIDTH * 2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // 中轴虚线(标示固定攻击方向)
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = LaserBulletDynamicEntity.DEBUG_AXIS_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 长度标注
    const midX = (origin.x + tip.x) / 2;
    const midY = (origin.y + tip.y) / 2;
    const label = `laser ${Math.round(length)} px`;
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(midX - textWidth / 2 - 3, midY - 17, textWidth + 6, 15);
    ctx.fillStyle = LaserBulletDynamicEntity.DEBUG_TEXT_COLOR;
    ctx.fillText(label, midX, midY - 4);

    // 起点十字标记
    ctx.strokeStyle = LaserBulletDynamicEntity.DEBUG_MARK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x - 6, origin.y);
    ctx.lineTo(origin.x + 6, origin.y);
    ctx.moveTo(origin.x, origin.y - 6);
    ctx.lineTo(origin.x, origin.y + 6);
    ctx.stroke();

    ctx.restore();
  }
}

export { OnahauLoneLs1Entity };
