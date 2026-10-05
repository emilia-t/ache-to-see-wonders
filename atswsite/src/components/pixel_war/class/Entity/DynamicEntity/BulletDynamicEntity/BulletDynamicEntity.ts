import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { BulletRangeType, BulletTag } from '@/components/pixel_war/type/Type';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 解析 CSS 颜色(#rgb / #rrggbb / rgb() / rgba())为 RGB 分量
 * 解析失败返回 null,由调用方回退到安全默认值。
 */
const H_parseCssColor = (color: string): { r: number; g: number; b: number } | null => {
  const value = color.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const match = value.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
};

/**
 * 将任意 CSS 颜色转换为带指定透明度的 rgba 字符串
 * 用于发光与拖尾的径向/线性渐变(颜色与子弹基色一致,仅改变透明度)。
 *
 * 同时导出给激光弹使用(激光的渐变同样需要按颜色+透明度构造)。
 */
const H_colorWithAlpha = (color: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const rgb = H_parseCssColor(color);
  if (!rgb) return `rgba(255, 255, 255, ${a})`;
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})`;
};

/**
 * 将 CSS 颜色向白色混合(amount = 0 保持原色,1 为纯白)。
 * 用于"拖尾越长颜色越浅";解析失败时返回原色,保证不影响渲染。
 */
const H_lightenColor = (color: string, amount: number): string => {
  const t = Math.max(0, Math.min(1, amount));
  if (t <= 0) return color;
  const rgb = H_parseCssColor(color);
  if (!rgb) return color;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * t);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
};

abstract class BulletDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 8;
  public static readonly HEIGHT = 8;
  //public static readonly MOVE_SPEED = 780;// 子弹速度
  public static readonly MOVE_SPEED = 320;
  public static readonly DEFAULT_DAMAGE = 1;
  //public static readonly MAX_LIFETIME = 1.8;// 最大存在时间,单位秒
  public static readonly MAX_LIFETIME = 5.6;
  public static readonly DEFAULT_COLOR = 'rgba(255, 255, 50, 0.9)';// 子弹默认基色(弹体/拖尾/发光共用)
  public static readonly BODY_WIDTH = BulletDynamicEntity.HEIGHT;// 弹体宽度(垂直运动方向),与碰撞体积同宽,避免视觉过细
  public static readonly TRAIL_LENGTH_RATIO = 5;// 拖尾长度 = 弹体长度 × 该比例
  public static readonly TRAIL_MIN_LENGTH = 26;// 拖尾最短长度,单位px
  public static readonly TRAIL_WIDTH_RATIO = 1;// 拖尾宽度 = 弹体宽度 × 该比例(与弹体等宽,恒定不渐尖)
  /**
   * 拖尾长度随射速缩放的倍率上下限(基准射速 = MOVE_SPEED,此时倍率恒为 1)。
   * 射速越快 → 倍率越大 → 拖尾越长;超出 1 的部分同时决定拖尾的变淡/变浅程度。
   */
  public static readonly TRAIL_SPEED_SCALE_MIN = 0.5;
  public static readonly TRAIL_SPEED_SCALE_MAX = 2.5;
  /** 拖尾因变长而不透明度衰减的强度:长度每超出基准 1 倍,叠加段透明度按 (1 + 该值 × 倍数) 递减 */
  public static readonly TRAIL_LENGTH_FADE_RATIO = 0.55;
  /** 拖尾因变长而向白色混合的强度:长度每超出基准 1 倍,颜色向白色混合该比例 */
  public static readonly TRAIL_LENGTH_LIGHTEN_RATIO = 0.45;
  public static readonly GLOW_CORE_ALPHA = 0.5;// 发光中心透明度(靠近弹体中心最亮)
  public static readonly GLOW_MID_ALPHA = 0.2;// 发光中段透明度

  private lifetimeRemaining: number;

  protected velocity: Point;

  public ownerId: number | null;
  public teamId: number | null;
  public shouldRemove: boolean;
  public rangeType: BulletRangeType;// 子弹射程类型（短/长）
  public damage: number;
  public bulletColor: string;// 子弹基色,决定弹体、拖尾与发光颜色

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    rangeType: BulletRangeType,
    name: string = '',
    damage: number = BulletDynamicEntity.DEFAULT_DAMAGE,
    tag: BulletTag,
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, BulletDynamicEntity.WIDTH, BulletDynamicEntity.HEIGHT, '', name, 'bullet', tag);
    this.rangeType = rangeType;
    this.bulletColor = BulletDynamicEntity.DEFAULT_COLOR;
    this.fillColor = this.bulletColor;
    // 子弹速度可由调用方自定义(如 NPC 等级加成),非法值回退到默认速度
    const speed = Number.isFinite(moveSpeed) && moveSpeed > 0
      ? moveSpeed
      : BulletDynamicEntity.MOVE_SPEED;
    this.minMoveSpeed = speed;
    this.maxMoveSpeed = speed;
    this.speed = speed;
    this.wanderRange = 0;
    this.perceptionRange = 0;
    this.health = 1;
    this.healthMax = 1;
    this.movementPassion = 1;
    this.velocity = {
      x: direction.x * speed,
      y: direction.y * speed,
    };
    this.ownerId = ownerId;
    this.teamId = teamId;
    this.lifetimeRemaining = BulletDynamicEntity.MAX_LIFETIME;
    this.shouldRemove = false;
    this.isMoving = true;
    this.facingDirection = { ...direction };
    this.lastMoveDirection = { ...direction };
    this.damage = damage;
  }

  /**
   * 获取子弹在屏幕坐标系中的旋转角度
   */
  protected getScreenRotationAngle(): number {
    return Math.atan2(-this.velocity.y, this.velocity.x);
  }

  /**
   * 拖尾长度相对基准射速(MOVE_SPEED)的缩放倍率。
   *
   * 射速越快 → 倍率越大 → 拖尾越长;基准射速下恒为 1(拖尾长度与旧版本完全一致)。
   */
  protected getTrailSpeedScale(): number {
    const base = BulletDynamicEntity.MOVE_SPEED;
    const speed = Number.isFinite(this.speed) && this.speed > 0 ? this.speed : base;
    const raw = speed / base;
    return Math.min(
      BulletDynamicEntity.TRAIL_SPEED_SCALE_MAX,
      Math.max(BulletDynamicEntity.TRAIL_SPEED_SCALE_MIN, raw)
    );
  }

  /**
   * 绘制子弹通用视觉:拖尾 + 发光 + 弹体
   * 1. 拖尾:沿运动反方向的条状矩形(恒定宽度,不渐尖),尾端完全透明、靠近弹体最亮
   *    - 长度与射速正相关(基准射速下与旧版本一致,见 getTrailSpeedScale)
   *    - 拖尾越长颜色越淡:不透明度随长度倍率递减,颜色同时向白色混合
   * 2. 发光:以弹体中心为圆心的径向渐变圆,直径 = 弹体长度 × 2,颜色同子弹基色,靠近中心最亮
   * 3. 弹体:以碰撞盒中心为中心的矩形
   * 拖尾与发光使用叠加混合(lighter),在深色场景中呈现霓虹辉光效果。
   * @param ctx 画布上下文
   * @param worldToScreen 世界坐标转屏幕坐标
   * @param bodyLength 弹体长度(沿运动方向),单位px
   * @param bodyWidth 弹体宽度(垂直运动方向),单位px
   */
  protected drawBulletVisual(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    bodyLength: number,
    bodyWidth: number
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const color = this.bulletColor || BulletDynamicEntity.DEFAULT_COLOR;
    const halfLength = bodyLength / 2;
    const halfWidth = bodyWidth / 2;
    // 拖尾长度:基础长度(随弹体长度等比变化,并有限下限)再乘以射速倍率
    const trailSpeedScale = this.getTrailSpeedScale();
    const baseTrailLength = Math.max(
      BulletDynamicEntity.TRAIL_MIN_LENGTH,
      bodyLength * BulletDynamicEntity.TRAIL_LENGTH_RATIO
    );
    const trailLength = baseTrailLength * trailSpeedScale;
    // 拖尾越长越淡:超出基准射速的倍率越大,不透明度越低、颜色越浅(向白色混合)
    const extraScale = Math.max(0, trailSpeedScale - 1);
    const trailFade = 1 / (1 + BulletDynamicEntity.TRAIL_LENGTH_FADE_RATIO * extraScale);
    const trailColor = H_lightenColor(
      color,
      BulletDynamicEntity.TRAIL_LENGTH_LIGHTEN_RATIO * extraScale
    );
    const trailHeadX = -halfLength;
    const trailTailX = trailHeadX - trailLength;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.getScreenRotationAngle());
    // 拖尾与发光叠加混合,形成霓虹辉光
    ctx.globalCompositeOperation = 'lighter';

    // ---- 拖尾:恒定宽度的条状矩形,尾端透明、靠近弹体最亮 ----
    const trailThickness = Math.max(1.5, bodyWidth * BulletDynamicEntity.TRAIL_WIDTH_RATIO);
    const trailGradient = ctx.createLinearGradient(trailTailX, 0, trailHeadX, 0);
    trailGradient.addColorStop(0, H_colorWithAlpha(trailColor, 0));
    trailGradient.addColorStop(0.5, H_colorWithAlpha(trailColor, 0.16 * trailFade));
    trailGradient.addColorStop(1, H_colorWithAlpha(trailColor, 0.65 * trailFade));
    ctx.fillStyle = trailGradient;
    ctx.fillRect(trailTailX, -trailThickness / 2, trailLength, trailThickness);

    // ---- 发光:直径 = 弹体长度 × 2,靠近中心最亮 ----
    const glowRadius = bodyLength;
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    glowGradient.addColorStop(0, H_colorWithAlpha(color, BulletDynamicEntity.GLOW_CORE_ALPHA));
    glowGradient.addColorStop(0.35, H_colorWithAlpha(color, BulletDynamicEntity.GLOW_MID_ALPHA));
    glowGradient.addColorStop(1, H_colorWithAlpha(color, 0));
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // ---- 弹体 ----
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.fillRect(-halfLength, -halfWidth, bodyLength, bodyWidth);

    ctx.restore();
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

  public override update(dt: number, staticEntities: StaticEntity[]) {
    if (this.shouldRemove) return;

    this.lifetimeRemaining = Math.max(0, this.lifetimeRemaining - dt);
    if (this.lifetimeRemaining <= 0) {
      this.shouldRemove = true;
      return;
    }

    const nextPos = {
      x: this.position.x + this.velocity.x * dt,
      y: this.position.y + this.velocity.y * dt,
    };

    if (this.collidesWithStatic(nextPos, staticEntities)) {
      this.shouldRemove = true;
      return;
    }

    this.position = nextPos;
    this.updateCollisionBox();
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;
  }

  public override updateCrowdStuckState(_dt: number) {}

  public override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }

  public override updateStayDuration(_dt: number) {}

  public override canGetNewWanderTarget(_dt: number, _staticEntities: StaticEntity[]) {
    return false;
  }
}

export { BulletDynamicEntity, H_colorWithAlpha };
