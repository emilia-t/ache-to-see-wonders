import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import type { NpcActionLoopContext } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { GameConfig, Point } from '@/components/pixel_war/interface/Interface';
import type { EntityDebugFlags, DynamicEntitieList } from '@/components/pixel_war/interface/Interface';
import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';

// 用于炸弹获取所有动态实体，由 Service 在初始化时注入
let dynamicEntitiesProvider: (() => DynamicEntity[]) | null = null;

export function setDynamicEntitiesProviderForRedPixel(provider: () => DynamicEntity[]) {
  dynamicEntitiesProvider = provider;
}

/**
 * 黑像素自毁时生成的炸弹，短暂延迟后对范围内所有动态实体造成伤害
 */
class RedPixelBombEntity extends DynamicEntity {
  private countdown: number;
  private explosionRadius: number;
  private explosionDamage: number;
  private ownerId: number;

  constructor(
    position: Point,
    ownerId: number,
    countdown = 0.5,
    radius = 80,
    damage = 40
  ) {
    // kind 暂时用 'grenade'，方便引擎按动态实体处理
    super(position, 10, 10, '', 'RedPixelBomb', 'grenade' as any, 'red_pixel_bomb');
    this.ownerId = ownerId;
    this.countdown = countdown;
    this.explosionRadius = radius;
    this.explosionDamage = damage;
    this.isMoving = false;
    this.health = 1;
    this.healthMax = 1;
    // 炸弹不可见，只用于逻辑
    this.fillColor = 'transparent';
    this.strokeColor = 'transparent';
  }

  update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntitie: DynamicEntitieList
  ): void {
    if (this.isDead) return;

    this.countdown -= dt;
    if (this.countdown <= 0) {
      this.explode();
    }
  }

  private explode(): void {
    if (this.isDead) return;

    // 标记为死亡，下一帧由 Service 清理
    this.isDead = true;
    this.deathEffectTimer = 0;

    // 范围伤害
    if (!dynamicEntitiesProvider) return;
    const entities = dynamicEntitiesProvider();
    for (const entity of entities) {
      if (entity.isDead) continue;
      if (entity.id === this.ownerId) continue; // 避免伤害已经消失的生成者
      const dist = Math.hypot(
        entity.position.x - this.position.x,
        entity.position.y - this.position.y
      );
      if (dist <= this.explosionRadius) {
        entity.applyDamage(this.explosionDamage);
      }
    }
  }

  draw(): void {
    // 炸弹自身不渲染
  }
}

/**
 * 自走爆炸敌人：
 * - 向玩家移动，靠近到爆炸范围时立刻引爆
 * - 引爆前进入预警状态，黑白闪烁
 * - 引爆时在自身位置生成一枚延迟炸弹
 */
class RedPixelEntity extends HostileNpcDynamicEntity {
  static readonly WIDTH = 25;
  static readonly HEIGHT = 25;

  private playerPosition:Point | null = null;

  private static readonly EXPLODE_RANGE = 60;   // 进入此距离直接爆炸
  private static readonly WARN_RANGE = 140;     // 进入此距离开始闪烁警告

  // 用于闪烁的计时器
  private flashAccumulator: number = 0;
  private isFlashing: boolean = false;

  constructor(position: Point) {
    super(position, RedPixelEntity.WIDTH, RedPixelEntity.HEIGHT, '', 'RedPixel', 0, 'red_pixel');
    this.fillColor = '#ff1313';
    this.strokeColor = '#444444';
    this.health = 60;
    this.healthMax = 60;
  }

  tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  pickupItem(_item: ItemEntity): void {
    // 黑像素不拾取物品
  }

  // 覆盖移动目标设定：向玩家位置移动
  override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const playerPos = this.playerPosition;
    if (!playerPos) return false;

    // 直接以玩家为目标，允许弯曲路径以避开障碍
    return super.setTarget(playerPos, staticEntities, { preferStraight: false });
  }

  // 每帧检测与玩家的距离，决定是否爆炸或闪烁
  override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;

    // 常规移动更新
    super.update(dt, staticEntities, dynamicEntity, gameConfig);

    if (this.isDead) return;

    let playerPos:Point | null = null;
    if (gameConfig.singleplayerMode){//单人模式下追玩家0
        const singlePlayer = dynamicEntity.playerDynamicEntitys[0];
        if(singlePlayer && !singlePlayer.isDead){
            playerPos={
                x:singlePlayer.position.x,
                y:singlePlayer.position.y
            };
            this.playerPosition=playerPos;
        }
    }
    else {
        // 多人模式下追最近的玩家
        let closestDist = Infinity;
        let closestPlayerPos: Point | null = null;
        for (const player of dynamicEntity.playerDynamicEntitys) {
            if (player.isDead) continue;
            const dist = Math.hypot(
                this.position.x - player.position.x,
                this.position.y - player.position.y
            );
            if (dist < closestDist) {
                closestDist = dist;
                closestPlayerPos = { x: player.position.x, y: player.position.y };
            }
        }
        if (closestPlayerPos) {
            playerPos = closestPlayerPos;
            this.playerPosition = playerPos;
        }
    }


    if(!playerPos){
        return;
    }

    const distToPlayer = Math.hypot(
      this.position.x - playerPos.x,
      this.position.y - playerPos.y
    );

    // 判断是否进入预警（闪烁）范围
    this.isFlashing = distToPlayer <= RedPixelEntity.WARN_RANGE && distToPlayer > RedPixelEntity.EXPLODE_RANGE;

    if (this.isFlashing) {
      this.flashAccumulator += dt;
    } else {
      this.flashAccumulator = 0;
    }

    // 进入爆炸范围 -> 自毁
    if (distToPlayer <= RedPixelEntity.EXPLODE_RANGE) {
      this.selfDestruct();
    }
  }

  private selfDestruct(): void {
    if (this.isDead) return;

    // 触发死亡流程（保持 dead 状态，但不等待死亡特效完全结束）
    this.triggerDeath();
    this.deathEffectTimer = 0; // 立刻可以被清理

    // 生成炸弹实体，推入待处理列表，由 Service 在下一帧注入动态实体列表
    const bomb = new RedPixelBombEntity(
      { ...this.position },
      this.id
    );
    RedPixelEntity.pendingBombs.push(bomb);
  }

  // 绘制时处理闪烁效果：预警状态下黑白交替
  draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const left = screenPos.x - halfW;
    const top = screenPos.y - halfH;

    // 闪烁决定当前颜色
    let fill = this.fillColor || '#111';
    if (this.isFlashing) {
      // 每秒闪烁 6 次，交替黑白
      const phase = Math.sin(this.flashAccumulator * Math.PI * 6);
      fill = phase > 0 ? '#ffffff' : '#000000';
    }

    ctx.fillStyle = fill;
    ctx.fillRect(left, top, this.width, this.height);
    ctx.strokeStyle = this.strokeColor || '#555';
    ctx.strokeRect(left, top, this.width, this.height);

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, this.width, this.height);
      ctx.restore();
    }

    // 血条
    const healthRatio = Math.max(0, Math.min(1, this.health / this.healthMax));
    const barWidth = Math.max(36, this.width);
    const barHeight = 4;
    const barX = screenPos.x - barWidth / 2;
    const topY = screenPos.y - halfH - 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, topY, barWidth, barHeight);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(barX, topY, barWidth * healthRatio, barHeight);

    // 调试信息（复用 WhitePixel 的绘制模式）
    if (debugFlags) {
      if (debugFlags.showTag) {
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.name, screenPos.x, screenPos.y + halfH + 20);
      }
      // 省略其余调试绘制，可参考 WhitePixelEntity 进行扩展
    }
  }

  // ---------- 静态辅助 ----------

  // 待注入动态实体列表的炸弹队列，Service 应在 updateGame 开始时取出并加入 MAP_DATA
  static pendingBombs: RedPixelBombEntity[] = [];

  override action(context: NpcActionLoopContext): void {
      
  }

  override actionLoop(context: NpcActionLoopContext): void {
      
  }

  override actionBefore(context: NpcActionLoopContext): void {
      
  }

  override actionAfter(context: NpcActionLoopContext): void {
      
  }
}

export { RedPixelEntity, RedPixelBombEntity };