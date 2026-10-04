import { FriendlyNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/FriendlyNpcDynamicEntity';
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
 * 友好 NPC「SkyBluePixel」(天蓝色像素)
 * - 除随机游走外不做任何事情
 * - 没有任何攻击方式
 */
class SkyBluePixelEntity extends FriendlyNpcDynamicEntity {
  public static GENERATE_WEIGHT = 0.2; // 生成权重
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '天蓝像素';

  private static readonly APPROACH_RANGE = 220;        // 主动靠近玩家的判定范围(px)
  private static readonly APPROACH_KEEP_DISTANCE = 120; // 靠近玩家后保持的距离(px)

  // 当前要靠近的玩家位置(附近无玩家时为 null)
  private approachTarget: Point | null = null;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', 'SkyBluePixel', 0, 'sky_blue_pixel');
    this.fillColor = '#87ceeb';  // 天蓝色主体
    this.strokeColor = '#4a8fb0';// 描边
    this.health = 1;
    this.healthMax = 1;
    this.kill_score = 1;         // 击杀该NPC获得的分数
    this.game_exp = 1;           // 携带的游戏经验值
    this.mapColor = '#87ceeb';   // 地图上的颜色表示
    // 将感知范围设为主动靠近的范围,便于调试圈可视化
    this.perceptionRange = SkyBluePixelEntity.APPROACH_RANGE;
    this.loot = [];              // 战利品:友好 NPC 不掉落任何战利品
  }

  public tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  public pickupItem(_item: ItemEntity): void {
    // 友好NPC不拾取任何物品
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 等级变化时重算等级相关属性(经验值随等级提升) */
  protected override onNpcLevelApplied(): void {
    this.game_exp = 1 + this.level * 1;
  }

  /**
   * 每帧更新:
   * 1. 被玩家吸附时跟随主人
   * 2. 记录附近玩家位置,供 setTarget 决定是否靠近
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.ownerId !== null) {
      this.followOwner(dynamicEntity);
      return;
    }

    this.refreshApproachTarget(dynamicEntity);
    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  /**
   * 覆盖目标设置:附近有玩家时优先靠近玩家,否则沿用随机游走目标
   */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    if (this.approachTarget) {
      return super.setTarget(this.approachTarget, staticEntities, { preferStraight: false });
    }
    return super.setTarget(target, staticEntities, options);
  }

  // 无任何攻击行为,动作循环为空
  public override actionLoop(_context: ActionLoopContext): void {}
  public override action(_context: ActionLoopContext): void {}
  public override actionBefore(_context: ActionLoopContext): void {}
  public override actionAfter(_context: ActionLoopContext): void {}

  /**
   * 
   */
  private followOwner(dynamicEntity: DynamicEntitieList): void {
    for (let pi = 0; pi < dynamicEntity.playerDynamicEntitys.length; pi++) {
      if (dynamicEntity.playerDynamicEntitys[pi].id === this.ownerId) {
        const servant = dynamicEntity.playerDynamicEntitys[pi].selectServantByID(this.id);
        if (servant !== null) {
          const newPosition = dynamicEntity.playerDynamicEntitys[pi].rowColToWorldPosition(
            servant.row,
            servant.col
          );
          if (newPosition !== null) {
            this.position.x = newPosition.x;
            this.position.y = newPosition.y;
            this.updateCollisionBox();
            this.isMoving = false;
            this.nextTarget = { ...newPosition };
            this.targetHistory = [{ ...newPosition }];
            this.curvePoints = [{ ...newPosition }];
            this.currentCurveIndex = 0;
          }
        }
      }
    }
  }

  /**
   * 刷新附近玩家位置,并计算靠近目标点
   */
  private refreshApproachTarget(dynamicEntity: DynamicEntitieList): void {
    this.approachTarget = null;

    let closestDist = Infinity;
    let closestPlayer: Point | null = null;
    for (const player of dynamicEntity.playerDynamicEntitys) {
      if (player.isDead) continue;
      const dist = Math.hypot(
        this.position.x - player.position.x,
        this.position.y - player.position.y
      );
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = { x: player.position.x, y: player.position.y };
      }
    }

    if (closestPlayer === null || closestDist > this.perceptionRange) {
      return;
    }

    // 在玩家附近选取一个保持距离的目标点,避免与玩家完全重叠
    const dx = this.position.x - closestPlayer.x;
    const dy = this.position.y - closestPlayer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
      this.approachTarget = {
        x: closestPlayer.x,
        y: closestPlayer.y - SkyBluePixelEntity.APPROACH_KEEP_DISTANCE,
      };
    } else {
      const ux = dx / dist;
      const uy = dy / dist;
      this.approachTarget = {
        x: closestPlayer.x + ux * SkyBluePixelEntity.APPROACH_KEEP_DISTANCE,
        y: closestPlayer.y + uy * SkyBluePixelEntity.APPROACH_KEEP_DISTANCE,
      };
    }
  }

  /**
   * 绘制实体
   */
  public draw(
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

    // 天蓝色主体
    ctx.fillStyle = this.fillColor || '#87ceeb';
    ctx.fillRect(left, top, drawW, drawH);
    ctx.strokeStyle = this.strokeColor || '#4a8fb0';
    ctx.strokeRect(left, top, drawW, drawH);

    // 友好表情:两个眼睛 + 微笑
    ctx.fillStyle = '#ffffff';
    const eyeOffset = drawW * 0.18;
    const eyeRadius = Math.max(1.5, drawW * 0.09);
    ctx.beginPath();
    ctx.arc(screenPos.x - eyeOffset, screenPos.y - 2, eyeRadius, 0, Math.PI * 2);
    ctx.arc(screenPos.x + eyeOffset, screenPos.y - 2, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y + 3, drawW * 0.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, drawW, drawH);
      ctx.restore();
    }

    // 调试信息
    if(debugFlags){
        if (debugFlags.showTag) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ffff00';
            ctx.fillText(this.tag, screenPos.x, screenPos.y + halfH + 20);
        }
    }

    // NPC 等级徽标(/show_level)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);
  }
}

export { SkyBluePixelEntity };
