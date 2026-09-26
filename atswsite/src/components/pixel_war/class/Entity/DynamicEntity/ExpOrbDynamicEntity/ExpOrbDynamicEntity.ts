import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
import type { Point, DynamicEntitieList, GameConfig, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/**
 * 经验球实体（exp_orb）
 * 参考《我的世界》经验球设计:
 * - 独立动态实体,物理碰撞体积统一
 * - 视觉大小与颜色随内含经验值变化(共 11 档),价值≥17 时中心出现橙色核心
 * - 会向附近的存活玩家飘行,被玩家拾取后为玩家增加游戏经验
 */
class ExpOrbDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 12;// 统一物理碰撞体积(宽,px)
  public static readonly HEIGHT = 12;// 统一物理碰撞体积(高,px)
  public static readonly ATTRACT_RANGE = 180;// 吸引范围(px),范围内自动飞向玩家
  public static readonly PICKUP_RANGE = 22;// 拾取范围(px)
  public static readonly LIFETIME = 30;// 经验球存在时长(秒)

  // 经验球经验值档位(共11档,与《我的世界》一致)
  public static readonly VALUE_TIERS = [1, 3, 7, 17, 37, 73, 149, 307, 617, 1237, 2477];

  public value: number;// 内含经验值
  public age: number;// 已存活时间(秒)
  public isPickedUp: boolean;// 是否已被拾取(或超时消失),用于移除

  constructor(position: Point, value: number) {
    super(position, ExpOrbDynamicEntity.WIDTH, ExpOrbDynamicEntity.HEIGHT, '', '经验球', 'exp_orb', 'exp_orb');
    this.value = Math.max(1, Math.floor(value));
    this.age = 0;
    this.isPickedUp = false;
    this.fillColor = '#67e87c';
    this.strokeColor = '#2ecc71';
    this.speed = 0;
    this.minMoveSpeed = 0;
    this.maxMoveSpeed = 0;
  }

  /**
   * 视觉尺寸:经验值越高视觉模型越大(0.6~1.4 倍基准),但不影响实际碰撞体积
   */
  private getVisualScale(): number {
    let tierIndex = ExpOrbDynamicEntity.VALUE_TIERS.findIndex(t => this.value <= t);
    if (tierIndex < 0) tierIndex = ExpOrbDynamicEntity.VALUE_TIERS.length - 1;
    return 0.6 + (tierIndex / (ExpOrbDynamicEntity.VALUE_TIERS.length - 1)) * 0.8;
  }

  /**
   * 价值≥17 时中心出现橙色核心
   */
  private hasCore(): boolean {
    return this.value >= 17;
  }

  public override update(
    dt: number,
    _staticEntities: StaticEntity[],
    dynamicEntities: DynamicEntitieList,
    _gameConfig: GameConfig
  ): void {
    if (this.isPickedUp) return;

    this.age += dt;
    if (this.age >= ExpOrbDynamicEntity.LIFETIME) {
      this.isPickedUp = true;// 超时消失
      return;
    }

    // 寻找最近的存活玩家
    let nearestPlayer: PlayerDynamicEntity | null = null;
    let nearestDist = Infinity;
    for (const player of dynamicEntities.playerDynamicEntitys) {
      if (player.isDead) continue;
      const d = Math.hypot(this.position.x - player.position.x, this.position.y - player.position.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestPlayer = player;
      }
    }

    if (nearestPlayer && nearestDist <= ExpOrbDynamicEntity.ATTRACT_RANGE) {
      // 向玩家飘行,距离越近速度越快
      const dir = {
        x: (nearestPlayer.position.x - this.position.x) / nearestDist,
        y: (nearestPlayer.position.y - this.position.y) / nearestDist,
      };
      const speed = 140 + (1 - nearestDist / ExpOrbDynamicEntity.ATTRACT_RANGE) * 360;
      this.position.x += dir.x * speed * dt;
      this.position.y += dir.y * speed * dt;
    } else {
      // 无目标时使用空气阻力减速(死亡时随机爆出的冲量逐渐衰减)
      this.applyAirResistance(dt);
      this.position.x += this.motionVelocity.x * dt;
      this.position.y += this.motionVelocity.y * dt;
    }

    this.updateCollisionBox();

    // 拾取判定(移动后重新计算距离)
    if (nearestPlayer) {
      const d = Math.hypot(this.position.x - nearestPlayer.position.x, this.position.y - nearestPlayer.position.y);
      if (d <= ExpOrbDynamicEntity.PICKUP_RANGE) {
        nearestPlayer.gainExp(this.value);
        this.isPickedUp = true;
      }
    }
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    if (this.isPickedUp) return;
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const scale = this.getVisualScale();
    const radius = (this.width / 2) * scale;

    ctx.save();

    // 外层光晕
    const glow = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, radius * 2.2);
    glow.addColorStop(0, 'rgba(103, 232, 124, 0.5)');
    glow.addColorStop(1, 'rgba(103, 232, 124, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 主体(绿色渐变)
    const body = ctx.createRadialGradient(
      screenPos.x - radius * 0.3, screenPos.y - radius * 0.3, radius * 0.1,
      screenPos.x, screenPos.y, radius
    );
    body.addColorStop(0, '#d8ffe0');
    body.addColorStop(0.5, '#67e87c');
    body.addColorStop(1, '#1f9d55');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 价值≥17时绘制橙色核心
    if (this.hasCore()) {
      const coreRadius = radius * 0.5;
      const core = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, coreRadius);
      core.addColorStop(0, '#fff2cc');
      core.addColorStop(0.4, '#ffb347');
      core.addColorStop(1, '#e67e22');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export { ExpOrbDynamicEntity };
