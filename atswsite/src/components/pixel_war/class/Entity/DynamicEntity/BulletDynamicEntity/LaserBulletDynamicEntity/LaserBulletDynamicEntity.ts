import {
  BulletDynamicEntity,
  H_colorWithAlpha
} from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 激光弹的可配置参数(缺省使用类默认值) */
export interface LaserBulletOptions {
  /** 激光最大长度(px),不小于 MIN_LENGTH(500) */
  length?: number;
  /** 激光前端沿射击方向的展开速度(px/s) */
  expandSpeed?: number;
  /** 阶段 3「持续发光」时长(tick,1 tick = 20ms) */
  durationTicks?: number;
  /** 基础伤害 */
  damage?: number;
  /** 辉光色(主色通过 bulletColor 传入) */
  glowColor?: string;
}

/**
 * 激光弹渲染状态(仅客户端使用)。
 *
 * 放在模块级 WeakMap 而不是实体字段上:单机(Worker)模式下 Worker 会把整个实体对象
 * 结构化克隆后由 `H_hydrateEntitySnapshot` 逐字段水合到客户端实体上,写在实体字段里的
 * "本地推进时长"会被权威端下发的值覆盖,多人 25Hz 快照下展开/渐亮动画就会一顿一顿。
 * 这里保存本地推进的已存在时长,每帧取 `max(本地推进值, 权威端下发值)`,
 * 既保证动画平滑,又不会与权威端产生漂移。
 */
type LaserRenderState = {
  /** 本地推进的已存在时长(秒) */
  elapsed: number;
  /** 上一次绘制时刻(ms) */
  lastTime: number;
};

const LASER_RENDER_STATES = new WeakMap<object, LaserRenderState>();

const H_getLaserRenderState = (owner: object): LaserRenderState => {
  let state = LASER_RENDER_STATES.get(owner);
  if (!state) {
    state = { elapsed: 0, lastTime: 0 };
    LASER_RENDER_STATES.set(owner, state);
  }
  return state;
};

/**
 * 本地渲染时钟是否随游戏一起暂停(对应调试指令 `/tick_pause`)。
 *
 * 暂停时权威端已不再推进 `laserElapsed`,但本地渲染时钟如果继续走,
 * `alphaAt()` 会一路走到渐暗结束 → 光束看起来"凭空消失",而实体其实还在
 * (命令 `/show_laser_line` 仍能画出它的判定带)。因此暂停时必须冻结本地时钟,
 * 只保留"权威端已下发值"这一下限。由客户端在暂停状态变化时调用
 * {@link H_setLaserClockPaused} 同步。
 */
let laserClockPaused = false;

/** 同步激光渲染时钟的暂停状态(客户端在暂停/恢复游戏时调用) */
const H_setLaserClockPaused = (paused: boolean): void => {
  laserClockPaused = paused;
};

/** 查询激光渲染时钟是否处于暂停状态 */
const H_isLaserClockPaused = (): boolean => laserClockPaused;

/**
 * 激光弹(线段型子弹)。
 *
 * <p>发射后从射击起点沿射击方向生成一道具有伤害的激光线段。线段本身不自行飞行,
 * 而是由"激光前端"沿射击方向以展开速度延伸,
 * 展开时间 = 激光长度 ÷ 展开速度。</p>
 *
 * <p>激光会跟随发射者(野生 NPC / 玩家 / 玩家的从者 NPC)同步移动:权威端每帧按发射者的
 * 位移增量平移整条线段,方向与长度保持不变(见 {@link followShooter})。因此发射者移动时
 * 不会再有"激光失去源头被移除"的行为,光束会像挂在炮口上一样随其一起位移。</p>
 *
 * <p>生命周期分为 5 个阶段:</p>
 * <ol start="0">
 *   <li>阶段 0/1:起点发光、激光头强光,线段自起点向前展开;</li>
 *   <li>阶段 2:线段整体渐亮(默认 0.1s);</li>
 *   <li>阶段 3:持续发光,时长 = duration_tick × 20ms(默认 50 tick);</li>
 *   <li>阶段 4:线段、辉光与激光头同时渐暗消失(默认 0.1s)。</li>
 * </ol>
 *
 * <p>命中判定与伤害由权威端处理(见 Service.updateBulletEntities 与 Java World.updateBullets):
 * 目标碰到线段即受伤——首次接触立刻造成 1 次基础伤害,持续接触每累计 20 tick 再造成
 * 基础伤害 × 2,离开线段后计时重置。线段会被围墙截断(前端碰到围墙即停止延伸)。</p>
 */
class LaserBulletDynamicEntity extends BulletDynamicEntity {
  /** 激光长度下限(px):自定义长度不得小于该值 */
  public static readonly MIN_LENGTH = 500;
  /** 默认最大长度(px) */
  public static readonly DEFAULT_LENGTH = 1200;
  /** 默认展开速度(px/s) */
  public static readonly DEFAULT_EXPAND_SPEED = 6000;
  /** 默认持续发光时长(tick) */
  public static readonly DEFAULT_DURATION_TICKS = 50;
  /** 单个游戏刻的秒数(1 tick = 20ms) */
  public static readonly TICK_SECONDS = 0.02;
  /** 阶段 2 渐亮时长(秒) */
  public static readonly FADE_IN_SECONDS = 0.1;
  /** 阶段 4 渐暗时长(秒) */
  public static readonly FADE_OUT_SECONDS = 0.1;
  /** 尾部衰减长度(px):距末端该距离内颜色逐渐透明,最末端完全透明 */
  public static readonly TAIL_FADE_LENGTH = 100;
  /** 光束判定半宽(px):线段厚度的一半,用于命中判定 */
  public static readonly HIT_HALF_WIDTH = 4;
  /** 持续接触结算间隔(tick):每累计该刻数造成一次持续伤害 */
  public static readonly CONTACT_TICK_INTERVAL = 20;
  /** 持续伤害倍率:持续伤害 = 基础伤害 × 该值 */
  public static readonly CONTACT_DAMAGE_MULTIPLIER = 2;

  /** 默认主色(激光弹基色;命名避开基类同名静态常量 DEFAULT_COLOR) */
  public static readonly DEFAULT_LASER_COLOR = '#C2F0FF';
  /** 默认辉光色 */
  public static readonly DEFAULT_LASER_GLOW_COLOR = '#E6F6FA';

  /** 调试(`/show_laser_line`)显示攻击范围时的判定带颜色 */
  public static readonly DEBUG_HIT_RANGE_COLOR = 'rgba(255, 64, 220, 0.22)';
  /** 调试显示攻击范围时的中轴虚线颜色 */
  public static readonly DEBUG_AXIS_COLOR = 'rgba(255, 170, 240, 0.9)';
  /** 调试显示攻击范围时的端点标记颜色 */
  public static readonly DEBUG_MARK_COLOR = 'rgba(255, 220, 250, 0.95)';
  /** 调试显示攻击范围时的标注文字颜色 */
  public static readonly DEBUG_TEXT_COLOR = '#ffb3f0';

  /** 主体外层辉光宽度(px) */
  private static readonly BODY_GLOW_WIDTH = 22;
  /** 主体内层辉光宽度(px) */
  private static readonly BODY_CORE_GLOW_WIDTH = 12;
  /** 中心线段宽度(px) */
  private static readonly CORE_WIDTH = 4;
  /** 中心线段辉光半径(px) */
  private static readonly CORE_SHADOW_BLUR = 14;
  /** 激光头强光半径(px) */
  private static readonly HEAD_RADIUS = 30;
  /** 展开阶段(阶段 1)的整体透明度:此时尚未渐亮 */
  private static readonly EXPAND_ALPHA = 0.55;

  /**
   * 激光最大长度(px,已按围墙截断)。
   * 由权威端在起点位置变化(首次生成 / 跟随发射者移动)时按静态实体(围墙)重新截断;
   * 多人模式下随快照下发。
   */
  public laserMaxLength: number;
  /** 激光前端展开速度(px/s) */
  public laserExpandSpeed: number;
  /** 阶段 3 持续发光时长(秒) */
  public laserHoldSeconds: number;
  /** 已存在时长(秒),由权威端每帧推进并随快照下发 */
  public laserElapsed = 0;
  /** 辉光色 */
  public laserGlowColor: string;
  /**
   * 发射者上一帧的位置(玩家与 NPC 发射时都会写入,由权威端在生成后立即赋值)。
   *
   * 权威端据此计算发射者的位移增量,让激光跟随发射者同步移动(见 {@link followShooter})。
   * 该字段只在权威端使用,不随协议下发;客户端拿到的激光位置直接来自快照。
   */
  public laserShooterPosition: Point | null = null;
  /** 发射时配置的原始激光长度(px,未按围墙截断):移动后重新截断时以其为上限 */
  private readonly laserConfiguredLength: number;
  /** 上一次按围墙截断长度时激光所处的位置(位置未变化则无需重复射线检测) */
  private laserClampOrigin: Point | null = null;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    bulletColor: string = '',
    options: LaserBulletOptions = {}
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'laser_bullet');

    const configuredLength = Number.isFinite(options.length)
      ? (options.length as number)
      : LaserBulletDynamicEntity.DEFAULT_LENGTH;
    this.laserConfiguredLength = Math.max(LaserBulletDynamicEntity.MIN_LENGTH, configuredLength);
    this.laserMaxLength = this.laserConfiguredLength;
    this.laserExpandSpeed = Number.isFinite(options.expandSpeed) && (options.expandSpeed as number) > 0
      ? (options.expandSpeed as number)
      : LaserBulletDynamicEntity.DEFAULT_EXPAND_SPEED;
    const ticks = Number.isFinite(options.durationTicks) && (options.durationTicks as number) > 0
      ? (options.durationTicks as number)
      : LaserBulletDynamicEntity.DEFAULT_DURATION_TICKS;
    this.laserHoldSeconds = ticks * LaserBulletDynamicEntity.TICK_SECONDS;
    this.laserGlowColor = options.glowColor || LaserBulletDynamicEntity.DEFAULT_LASER_GLOW_COLOR;

    this.bulletColor = bulletColor || LaserBulletDynamicEntity.DEFAULT_LASER_COLOR;
    this.fillColor = this.bulletColor;
    this.damage = Number.isFinite(options.damage)
      ? (options.damage as number)
      : BulletDynamicEntity.DEFAULT_DAMAGE;
    // 激光本体不自行飞行(初始位置在射击起点,之后仅随发射者平移),由"前端延伸"表达射速。
    // 速度字段仍存放"单位方向 × 展开速度":既与普通子弹的语义一致,
    // 也让客户端能直接由快照的 velocity 推导出射击方向。
    const dirLength = Math.hypot(direction.x, direction.y);
    const unitX = dirLength < 0.0001 ? 1 : direction.x / dirLength;
    const unitY = dirLength < 0.0001 ? 0 : direction.y / dirLength;
    this.facingDirection = { x: unitX, y: unitY };
    this.lastMoveDirection = { x: unitX, y: unitY };
    this.velocity = { x: unitX * this.laserExpandSpeed, y: unitY * this.laserExpandSpeed };
    this.speed = this.laserExpandSpeed;
    this.minMoveSpeed = this.laserExpandSpeed;
    this.maxMoveSpeed = this.laserExpandSpeed;
    this.isMoving = false;
    this.health = 1;
    this.healthMax = 1;
  }

  /** 激光前端展开所需时间(秒) = 长度 ÷ 展开速度 */
  public getExpandSeconds(): number {
    const speed = this.laserExpandSpeed > 0
      ? this.laserExpandSpeed
      : LaserBulletDynamicEntity.DEFAULT_EXPAND_SPEED;
    return this.laserMaxLength / speed;
  }

  /** 激光总存活时长(秒) = 展开 + 渐亮 + 持续发光 + 渐暗 */
  public getTotalLifetimeSeconds(): number {
    return this.getExpandSeconds()
      + LaserBulletDynamicEntity.FADE_IN_SECONDS
      + this.laserHoldSeconds
      + LaserBulletDynamicEntity.FADE_OUT_SECONDS;
  }

  /** 单位射击方向(由速度方向推得;速度为零时回退到朝向) */
  public getUnitDirection(): Point {
    let dx = this.velocity.x;
    let dy = this.velocity.y;
    let len = Math.hypot(dx, dy);
    if (len < 0.0001) {
      dx = this.facingDirection.x;
      dy = this.facingDirection.y;
      len = Math.hypot(dx, dy);
    }
    if (len < 0.0001) return { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  /** 指定时刻的激光长度(px):展开阶段按进度插值,展开完成后为最大长度 */
  public lengthAt(elapsed: number): number {
    const expandSeconds = this.getExpandSeconds();
    if (!(expandSeconds > 0)) return this.laserMaxLength;
    return this.laserMaxLength * Math.max(0, Math.min(1, elapsed / expandSeconds));
  }

  /** 指定时刻的整体透明度:展开阶段较暗 → 渐亮 → 满亮 → 渐暗(阶段 4 结束为 0) */
  public alphaAt(elapsed: number): number {
    const brightStart = this.getExpandSeconds();
    const brightEnd = brightStart + LaserBulletDynamicEntity.FADE_IN_SECONDS;
    const holdEnd = brightEnd + this.laserHoldSeconds;
    const fadeEnd = holdEnd + LaserBulletDynamicEntity.FADE_OUT_SECONDS;

    if (elapsed <= brightStart) return LaserBulletDynamicEntity.EXPAND_ALPHA;
    if (elapsed <= brightEnd) {
      const t = LaserBulletDynamicEntity.FADE_IN_SECONDS > 0
        ? (elapsed - brightStart) / LaserBulletDynamicEntity.FADE_IN_SECONDS
        : 1;
      return LaserBulletDynamicEntity.EXPAND_ALPHA
        + (1 - LaserBulletDynamicEntity.EXPAND_ALPHA) * t;
    }
    if (elapsed <= holdEnd) return 1;
    if (elapsed >= fadeEnd) return 0;
    return Math.max(0, 1 - (elapsed - holdEnd) / LaserBulletDynamicEntity.FADE_OUT_SECONDS);
  }

  /** 当前激光线段(起点 → 前端),供权威端做命中判定 */
  public getLaserSegment(): { start: Point; end: Point } {
    const dir = this.getUnitDirection();
    const length = this.lengthAt(this.laserElapsed);
    return {
      start: { x: this.position.x, y: this.position.y },
      end: {
        x: this.position.x + dir.x * length,
        y: this.position.y + dir.y * length
      }
    };
  }

  /**
   * 让激光跟随发射者同步移动:按发射者相对上一帧的位移增量,整体平移这条激光线段。
   *
   * 只做平移、不改变方向与长度,因此光束始终"挂在发射者的炮口上"。发射者不存在
   * (已被清理/断线)时不做任何处理,激光保持最后位置直到自然寿命结束。
   *
   * @param shooterPosition 发射者当前帧的位置
   */
  public followShooter(shooterPosition: Point): void {
    const last = this.laserShooterPosition;
    if (last === null) {
      this.laserShooterPosition = { x: shooterPosition.x, y: shooterPosition.y };
      return;
    }
    const dx = shooterPosition.x - last.x;
    const dy = shooterPosition.y - last.y;
    if (dx === 0 && dy === 0) return;
    this.position.x += dx;
    this.position.y += dy;
    this.updateCollisionBox();
    last.x = shooterPosition.x;
    last.y = shooterPosition.y;
  }

  /**
   * 每帧推进:起点位置变化时重新把激光长度按围墙截断,之后仅累计存在时长。
   * 激光本体不自行飞行,因此完全覆盖基类"直线飞行 + 撞墙即移除"的逻辑。
   */
  public override update(dt: number, staticEntities: StaticEntity[]): void {
    if (this.shouldRemove) return;

    this.clampLengthToWalls(staticEntities);

    this.laserElapsed += dt;
    if (this.laserElapsed >= this.getTotalLifetimeSeconds()) {
      this.shouldRemove = true;
    }
  }

  /**
   * 按围墙重新截断激光长度(仅在起点位置变化时真正执行射线检测)。
   * 始终以"发射时配置的原始长度"为上限,因此发射者离开围墙后光束可以重新伸长。
   */
  private clampLengthToWalls(staticEntities: StaticEntity[]): void {
    const clampOrigin = this.laserClampOrigin;
    if (
      clampOrigin !== null &&
      clampOrigin.x === this.position.x &&
      clampOrigin.y === this.position.y
    ) {
      return;
    }
    this.laserClampOrigin = { x: this.position.x, y: this.position.y };
    const wallLimit = this.raycastStaticDistance(this.laserConfiguredLength, staticEntities);
    this.laserMaxLength = Math.max(0, Math.min(this.laserConfiguredLength, wallLimit));
  }

  /** 无位移看门狗对激光无意义(位置固定) */
  public override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }

  /**
   * 视口裁剪:激光是长线段,只用起点判断会漏画"起点在视野外、线段伸入视野"的情况。
   * 这里沿线段取样多点,只要有一点落在(按 margin 扩展后的)画布内即视为可见。
   */
  public override isInViewport(
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    margin = 0
  ): boolean {
    const length = this.lengthAt(this.laserElapsed);
    if (length <= 0.5) {
      return super.isInViewport(worldToScreen, canvasSize, margin);
    }
    const dir = this.getUnitDirection();
    // 每约 300px 取样一次,兼顾准确度与开销
    const samples = Math.max(2, Math.ceil(length / 300));
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const screen = worldToScreen(
        this.position.x + dir.x * length * t,
        this.position.y + dir.y * length * t
      );
      if (
        screen.x >= -margin && screen.x <= canvasSize.width + margin &&
        screen.y >= -margin && screen.y <= canvasSize.height + margin
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * 沿射击方向做射线与静态实体(围墙)的相交测试,返回第一个命中点的距离。
   * 未命中、或命中点在起点之前(起点已在墙内)时返回 maxLength。
   */
  private raycastStaticDistance(maxLength: number, staticEntities: StaticEntity[]): number {
    if (!(maxLength > 0) || staticEntities.length === 0) return maxLength;
    const dir = this.getUnitDirection();
    const originX = this.position.x;
    const originY = this.position.y;
    let nearest = maxLength;

    for (const staticEntity of staticEntities) {
      const box = staticEntity.collisionBox;
      let tMin = 0;
      let tMax = nearest;

      // X 轴 slab
      if (Math.abs(dir.x) < 1e-6) {
        if (originX <= box.x || originX >= box.x + box.width) continue;
      } else {
        let t1 = (box.x - originX) / dir.x;
        let t2 = (box.x + box.width - originX) / dir.x;
        if (t1 > t2) {
          const swap = t1;
          t1 = t2;
          t2 = swap;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
      }

      // Y 轴 slab
      if (Math.abs(dir.y) < 1e-6) {
        if (originY <= box.y || originY >= box.y + box.height) continue;
      } else {
        let t1 = (box.y - originY) / dir.y;
        let t2 = (box.y + box.height - originY) / dir.y;
        if (t1 > t2) {
          const swap = t1;
          t1 = t2;
          t2 = swap;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
      }

      // 命中:交点在射线上,且位于起点前方
      if (tMin <= tMax && tMin > 0 && tMin < nearest) {
        nearest = tMin;
      }
    }
    return nearest;
  }

  /**
   * 绘制激光:主体辉光 + 中心线段 + 激光头强光,末端 100px 渐透明。
   * 已存在时长取"本地推进值"与"权威端下发值"的较大者,保证多人模式下动画平滑。
   *
   * 当调试开关 {@link EntityDebugFlags.showLaserLine}(`/show_laser_line`)开启时,
   * 额外叠加一层"命中判定范围"可视化。
   */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const render = H_getLaserRenderState(this);
    const now = performance.now();
    const frameDt = render.lastTime > 0 ? Math.min(0.1, (now - render.lastTime) / 1000) : 0;
    render.lastTime = now;
    // 暂停时冻结本地时钟:权威端已停止推进 laserElapsed,本地再继续走会让光束"凭空"渐暗消失
    render.elapsed = laserClockPaused
      ? Math.max(render.elapsed, this.laserElapsed)
      : Math.max(render.elapsed + frameDt, this.laserElapsed);

    const elapsed = render.elapsed;
    const length = this.lengthAt(elapsed);
    const beamAlpha = this.alphaAt(elapsed);

    if (length > 0.5 && beamAlpha > 0.01) {
      this.drawBeamVisual(ctx, worldToScreen, elapsed, length, beamAlpha);
    }

    // 调试:画在本体之上,且渐暗消失阶段也照常显示
    if (debugFlags?.showLaserLine) {
      this.drawDebugHitRange(ctx, worldToScreen, length);
    }
  }

  /** 绘制激光本体视觉(主体外层/内层辉光 + 中心线段 + 激光头强光) */
  private drawBeamVisual(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    elapsed: number,
    length: number,
    beamAlpha: number
  ): void {
    const dir = this.getUnitDirection();
    const origin = worldToScreen(this.position.x, this.position.y);
    const tip = worldToScreen(
      this.position.x + dir.x * length,
      this.position.y + dir.y * length
    );
    const screenLength = Math.hypot(tip.x - origin.x, tip.y - origin.y);
    if (screenLength <= 0.5) return;

    const color = this.bulletColor || LaserBulletDynamicEntity.DEFAULT_LASER_COLOR;
    const glowColor = this.laserGlowColor || LaserBulletDynamicEntity.DEFAULT_LASER_GLOW_COLOR;

    // 沿光束方向的渐变:主体保持亮度,距末端 TAIL_FADE_LENGTH 起渐透明,最末端完全透明
    const fadeStart = Math.max(0, 1 - LaserBulletDynamicEntity.TAIL_FADE_LENGTH / screenLength);
    const makeBeamGradient = (beamColor: string, alpha: number) => {
      const gradient = ctx.createLinearGradient(origin.x, origin.y, tip.x, tip.y);
      gradient.addColorStop(0, H_colorWithAlpha(beamColor, alpha));
      if (fadeStart > 0.002 && fadeStart < 0.998) {
        gradient.addColorStop(fadeStart, H_colorWithAlpha(beamColor, alpha));
        gradient.addColorStop(1, H_colorWithAlpha(beamColor, 0));
      } else {
        gradient.addColorStop(1, H_colorWithAlpha(beamColor, alpha * 0.2));
      }
      return gradient;
    };

    const strokeBeam = (strokeStyle: string | CanvasGradient, lineWidth: number) => {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap = 'round';
    // 叠加混合:在深色场景中呈现霓虹辉光
    ctx.globalCompositeOperation = 'lighter';

    // 主体外层辉光
    strokeBeam(
      makeBeamGradient(color, 0.2 * beamAlpha),
      LaserBulletDynamicEntity.BODY_GLOW_WIDTH
    );
    // 主体内层辉光(辉光色,更窄更亮)
    strokeBeam(
      makeBeamGradient(glowColor, 0.42 * beamAlpha),
      LaserBulletDynamicEntity.BODY_CORE_GLOW_WIDTH
    );
    // 中心线段(主色调 + 辉光)
    ctx.shadowColor = H_colorWithAlpha(glowColor, 0.9 * beamAlpha);
    ctx.shadowBlur = LaserBulletDynamicEntity.CORE_SHADOW_BLUR;
    strokeBeam(
      makeBeamGradient(color, 0.95 * beamAlpha),
      LaserBulletDynamicEntity.CORE_WIDTH
    );
    ctx.shadowBlur = 0;

    // 激光头(起点)强光:径向渐变 + 随时间轻微脉动
    const pulse = 0.86 + 0.14 * Math.sin(elapsed * 26);
    const headRadius = Math.max(
      1,
      LaserBulletDynamicEntity.HEAD_RADIUS * pulse * Math.max(0.35, beamAlpha)
    );
    const headGradient = ctx.createRadialGradient(
      origin.x, origin.y, 0,
      origin.x, origin.y, headRadius
    );
    headGradient.addColorStop(0, H_colorWithAlpha(glowColor, 0.85 * beamAlpha));
    headGradient.addColorStop(0.35, H_colorWithAlpha(color, 0.4 * beamAlpha));
    headGradient.addColorStop(1, H_colorWithAlpha(color, 0));
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, headRadius, 0, Math.PI * 2);
    ctx.fill();
    // 头部高亮核
    ctx.fillStyle = H_colorWithAlpha('#ffffff', 0.7 * beamAlpha);
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, Math.max(1, headRadius * 0.2), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 调试绘制:把激光的"攻击范围"可视化——沿光束的命中判定带(宽度 = 2 × HIT_HALF_WIDTH)
   * + 中轴虚线 + 两端标记 + 当前/最大长度标注。
   *
   * 命中判定为「点到线段距离 ≤ 目标半径 + HIT_HALF_WIDTH」,因此本判定带即激光自身的有效攻击宽度
   * (实际命中半径还要加上目标自身的碰撞半径)。
   */
  private drawDebugHitRange(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    length: number
  ): void {
    if (length <= 0.5) return;
    const dir = this.getUnitDirection();
    const origin = worldToScreen(this.position.x, this.position.y);
    const tip = worldToScreen(
      this.position.x + dir.x * length,
      this.position.y + dir.y * length
    );
    const halfWidth = LaserBulletDynamicEntity.HIT_HALF_WIDTH;

    ctx.save();

    // 判定带(与实际命中宽度一致)
    ctx.strokeStyle = LaserBulletDynamicEntity.DEBUG_HIT_RANGE_COLOR;
    ctx.lineWidth = halfWidth * 2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // 中轴虚线(标示线段本身)
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = LaserBulletDynamicEntity.DEBUG_AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 两端十字标记
    ctx.strokeStyle = LaserBulletDynamicEntity.DEBUG_MARK_COLOR;
    ctx.lineWidth = 1.5;
    const drawCross = (x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      ctx.stroke();
    };
    drawCross(origin.x, origin.y, 6);
    drawCross(tip.x, tip.y, 6);

    // 长度标注(当前 / 最大)
    const midX = (origin.x + tip.x) / 2;
    const midY = (origin.y + tip.y) / 2;
    const label = `${Math.round(length)} / ${Math.round(this.laserMaxLength)} px`;
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(midX - textWidth / 2 - 3, midY - 17, textWidth + 6, 15);
    ctx.fillStyle = LaserBulletDynamicEntity.DEBUG_TEXT_COLOR;
    ctx.fillText(label, midX, midY - 4);

    ctx.restore();
  }
}

export { LaserBulletDynamicEntity, H_setLaserClockPaused, H_isLaserClockPaused };
