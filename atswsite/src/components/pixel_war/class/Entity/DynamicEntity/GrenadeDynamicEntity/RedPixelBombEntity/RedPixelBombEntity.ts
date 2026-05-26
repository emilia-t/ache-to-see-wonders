import { 
    GrenadeDynamicEntity, 
    StaticEntity
} 
from "@/components/pixel_war/class";
import type {
    Point,
    DynamicEntitieList, 
    GameConfig,
    EntityDebugFlags
}
from "@/components/pixel_war/interface/Interface";

/**
 * 黑像素自毁时生成的炸弹，短暂延迟后对范围内所有动态实体造成伤害
 */
export class RedPixelBombEntity extends GrenadeDynamicEntity {
  private countdown: number;
  private explosionRadius: number;
  private explosionDamage: number;

  constructor(
    position: Point,
    ownerId: number,
    countdown = 0.5,
    radius = 80,
    damage = 40
  ) {
    super(position, 10, 10, '', 'RedPixelBomb', 'bomb', 'red_pixel_bomb');
    this.ownerId = ownerId;
    this.countdown = countdown;
    this.explosionRadius = radius;
    this.explosionDamage = damage;
    this.isMoving = false;
    this.health = 1;
    this.healthMax = 1;
    // this.fillColor = 'transparent';
    this.fillColor = 'transparent';
    this.strokeColor = 'transparent';
  }

  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntitie: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;

    this.countdown -= dt;
    if (this.countdown <= 0) {
      this.explode(dynamicEntitie);
    }
  }

  private explode(dynamicEntitie:DynamicEntitieList): void {
    if (this.isDead) return;

    // 标记为死亡
    this.isDead = true;
    this.deathEffectTimer = 0;

    // 范围伤害 玩家
    if (dynamicEntitie.playerDynamicEntitys.length !== 0){
        for (const entity of dynamicEntitie.playerDynamicEntitys) {
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
    
    // 范围伤害 NPC
    if (dynamicEntitie.npcDynamicEntitys.length !== 0){
        for (const entity of dynamicEntitie.npcDynamicEntitys) {
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
  }

  public draw(
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
  
      // 调试信息
      if (debugFlags) {
        if (debugFlags.showTag) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ffff00';
            ctx.fillText(this.name, screenPos.x, screenPos.y + halfH + 20);
        }
      }
  }
}