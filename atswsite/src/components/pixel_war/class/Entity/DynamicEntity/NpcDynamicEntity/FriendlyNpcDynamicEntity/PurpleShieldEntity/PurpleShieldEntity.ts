import { FriendlyNpcDynamicEntity } from '@/components/pixel_war/class';
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
 * 友好 NPC「PurpleShield」(紫色护盾)
 * - 基础生命值 4 点;生成权重 0.08(测试期间可临时提高至 0.99)
 * - 出生时身边环绕 4 个 5px × 5px 的蓝色渐变透明防护小方块并持续旋转;
 *   每损失 1 点生命值减少 1 个,数量与当前剩余生命值一一对应
 *   该方块仅为视觉特效,不参与碰撞,无碰撞体积
 * - 以螺旋轨迹向各个方向游走:每次需要新的游走目标时,改为取螺旋轨迹上的下一个路点
 */
class PurpleShieldEntity extends FriendlyNpcDynamicEntity {
  /** 生成权重(需落在 (0,1] 区间) */
  public static GENERATE_WEIGHT = 0.08;

  /** 基础/最大生命值(= 出生时的防护小方块数量) */
  public static readonly HEALTH_MAX = 4;

  /** 防护小方块边长(px) */
  public static readonly SHIELD_BLOCK_SIZE = 5;
  /** 防护小方块环绕半径(px) */
  public static readonly SHIELD_ORBIT_RADIUS = 16;
  /** 防护小方块环绕角速度(弧度/秒) */
  public static readonly SHIELD_ORBIT_SPEED = 2.4;
  /** 防护小方块内缘颜色(亮蓝) */
  private static readonly SHIELD_COLOR_INNER = 'rgba(160, 220, 255, 0.95)';
  /** 防护小方块外缘颜色(半透明蓝) */
  private static readonly SHIELD_COLOR_OUTER = 'rgba(80, 140, 255, 0.45)';
  /** 防护小方块光晕颜色 */
  private static readonly SHIELD_GLOW_COLOR = 'rgba(120, 180, 255, 0.85)';

  /** 螺旋游走:相邻路点的角度增量(弧度) */
  private static readonly SPIRAL_STEP_ANGLE = Math.PI * 0.25;
  /** 螺旋游走:路点半径每步的增量(px),使螺旋由内向外展开 */
  private static readonly SPIRAL_RADIUS_GROWTH = 6;
  /** 螺旋游走:螺旋最小半径(px) */
  private static readonly SPIRAL_MIN_RADIUS = 45;
  /** 螺旋游走:螺旋最大半径(px),达到后以当前位置重新展开 */
  private static readonly SPIRAL_MAX_RADIUS = 230;

  /** 螺旋中心(世界坐标) */
  private spiralCenter: Point;
  /** 螺旋当前角度(弧度) */
  private spiralAngle: number;
  /** 螺旋当前半径(px) */
  private spiralRadius: number;
  /** 防护小方块当前环绕角度(弧度) */
  private shieldOrbitAngle = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', 'PurpleShield', 0, 'purple_shield');
    this.fillColor = '#8a5cf6';    // 紫色主体
    this.strokeColor = '#c9b3ff';  // 亮紫描边
    this.health = PurpleShieldEntity.HEALTH_MAX;
    this.healthMax = PurpleShieldEntity.HEALTH_MAX;
    this.kill_score = 2;           // 击杀该 NPC 获得的分数
    this.game_exp = 4;             // 携带的游戏经验值
    this.mapColor = '#8a5cf6';     // 地图上的颜色表示
    this.loot = [];                // 友好 NPC 不掉落任何战利品
    this.spiralCenter = { ...position };
    this.spiralAngle = Math.random() * Math.PI * 2;
    this.spiralRadius = PurpleShieldEntity.SPIRAL_MIN_RADIUS;
  }

  public tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  public pickupItem(_item: ItemEntity): void {
    // 友好 NPC 不拾取任何物品
  }

  /** 无任何攻击行为 */
  public override actionLoop(_context: ActionLoopContext): void {}
  public override action(_context: ActionLoopContext): void {}
  public override actionBefore(_context: ActionLoopContext): void {}
  public override actionAfter(_context: ActionLoopContext): void {}

  /**
   * 每帧更新:
   * 1. 推进防护小方块的环绕角度(纯视觉)
   * 2. 被玩家吸附时跟随主人
   * 3. 否则按螺旋轨迹继续游走
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    this.shieldOrbitAngle += dt * PurpleShieldEntity.SHIELD_ORBIT_SPEED;

    if (this.ownerId !== null) {
      this.followOwner(dynamicEntity);
      return;
    }

    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  /**
   * 螺旋游走:忽略外部下发的随机游走目标,改为取螺旋轨迹上的下一个路点。
   * 这样即便服务端仍是"随机游走"的驱动方式,轨迹也始终呈螺旋形。
   */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    // 螺旋需要平滑曲线,统一按非"直线优先"处理
    if (super.setTarget(this.nextSpiralWaypoint(), staticEntities, { ...options, preferStraight: false })) {
      return true;
    }
    // 路点被阻挡:以当前位置为螺旋中心重新展开,仍失败则退回常规游走目标
    this.restartSpiral();
    if (super.setTarget(this.nextSpiralWaypoint(), staticEntities, { ...options, preferStraight: false })) {
      return true;
    }
    return super.setTarget(target, staticEntities, options);
  }

  /**
   * 螺旋游走:到点后不驻足,立即继续沿螺旋前进,保证轨迹连续。
   */
  public override updateStayDuration(dt: number): void {
    super.updateStayDuration(dt);
    if (!this.isDead && !this.isMoving) {
      this.stayDurationRemaining = 0;
    }
  }

  /**
   * 计算螺旋轨迹上的下一个路点(由内向外逐圈展开)
   */
  private nextSpiralWaypoint(): Point {
    this.spiralAngle += PurpleShieldEntity.SPIRAL_STEP_ANGLE;
    this.spiralRadius += PurpleShieldEntity.SPIRAL_RADIUS_GROWTH;
    // 展开到最大半径后,以当前位置为新中心重新由内向外展开(轨迹保持连续)
    if (this.spiralRadius >= PurpleShieldEntity.SPIRAL_MAX_RADIUS) {
      this.restartSpiral();
    }
    return {
      x: this.spiralCenter.x + Math.cos(this.spiralAngle) * this.spiralRadius,
      y: this.spiralCenter.y + Math.sin(this.spiralAngle) * this.spiralRadius,
    };
  }

  /** 以当前位置为螺旋中心,重新开始一圈螺旋 */
  private restartSpiral(): void {
    this.spiralCenter = { ...this.position };
    this.spiralAngle = this.spiralAngle + PurpleShieldEntity.SPIRAL_STEP_ANGLE;
    this.spiralRadius = PurpleShieldEntity.SPIRAL_MIN_RADIUS;
  }

  /**
   * 从者跟随:瞬移到主人在从者网格中分配的格子中心
   */
  private followOwner(dynamicEntity: DynamicEntitieList): void {
    for (let pi = 0; pi < dynamicEntity.playerDynamicEntitys.length; pi++) {
      if (dynamicEntity.playerDynamicEntitys[pi].id !== this.ownerId) continue;
      const servant = dynamicEntity.playerDynamicEntitys[pi].selectServantByID(this.id);
      if (servant === null) return;
      const newPosition = dynamicEntity.playerDynamicEntitys[pi].rowColToWorldPosition(servant.row, servant.col);
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

  /**
   * 绘制实体:紫色主体 + 环绕的防护小方块
   * 防护小方块数量 = 当前剩余生命值,仅为视觉特效(无碰撞体积)
   */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
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

    // 紫色主体
    ctx.fillStyle = this.fillColor || '#8a5cf6';
    ctx.fillRect(left, top, drawW, drawH);
    ctx.strokeStyle = this.strokeColor || '#c9b3ff';
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

    // 防护小方块(数量随生命值减少)
    this.drawShieldBlocks(ctx, screenPos.x, screenPos.y);

    // 调试信息
    if (debugFlags) {
      if (debugFlags.showTag) {
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + halfH + 20);
      }
    }

    void canvasSize;
  }

  /**
   * 绘制环绕自身的防护小方块
   * 方块数量 = 当前剩余生命值;围绕身体中心匀速旋转,呈蓝色渐变透明
   */
  private drawShieldBlocks(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    const count = Math.max(0, Math.round(this.health));
    if (count <= 0) return;

    const size = PurpleShieldEntity.SHIELD_BLOCK_SIZE;
    const half = size / 2;
    const orbitRadius = PurpleShieldEntity.SHIELD_ORBIT_RADIUS;

    ctx.save();
    ctx.shadowColor = PurpleShieldEntity.SHIELD_GLOW_COLOR;
    ctx.shadowBlur = size * 1.4;
    for (let i = 0; i < count; i++) {
      // 均匀分布在环绕圆周上,并随时间旋转
      const angle = this.shieldOrbitAngle + (i * Math.PI * 2) / count;
      const bx = centerX + Math.cos(angle) * orbitRadius;
      const by = centerY + Math.sin(angle) * orbitRadius;

      // 蓝色渐变透明:内侧亮蓝 -> 外侧淡蓝透明
      const gradient = ctx.createLinearGradient(bx - half, by - half, bx + half, by + half);
      gradient.addColorStop(0, PurpleShieldEntity.SHIELD_COLOR_INNER);
      gradient.addColorStop(1, PurpleShieldEntity.SHIELD_COLOR_OUTER);
      ctx.fillStyle = gradient;
      ctx.fillRect(bx - half, by - half, size, size);
    }
    ctx.restore();
  }
}

export { PurpleShieldEntity };
