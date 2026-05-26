import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { BulletRangeType, BulletTag } from '@/components/pixel_war/type/Type';
import type { Point } from '@/components/pixel_war/interface/Interface';

abstract class BulletDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 8;
  public static readonly HEIGHT = 8;
  public static readonly MOVE_SPEED = 720;
  public static readonly DEFAULT_DAMAGE = 30;
  public static readonly MAX_LIFETIME = 1.2;

  private lifetimeRemaining: number;

  protected velocity: Point;

  public ownerId: number | null;
  public shouldRemove: boolean;
  public rangeType: BulletRangeType;// 子弹射程类型（短/长）
  public damage: number;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    rangeType: BulletRangeType,
    name: string = 'Bullet',
    damage: number = BulletDynamicEntity.DEFAULT_DAMAGE,
    tag: BulletTag
  ) {
    super(position, BulletDynamicEntity.WIDTH, BulletDynamicEntity.HEIGHT, '', name, 'bullet', tag);
    this.rangeType = rangeType;
    this.fillColor = '#ffd84d';
    this.minMoveSpeed = BulletDynamicEntity.MOVE_SPEED;
    this.maxMoveSpeed = BulletDynamicEntity.MOVE_SPEED;
    this.speed = BulletDynamicEntity.MOVE_SPEED;
    this.wanderRange = 0;
    this.perceptionRange = 0;
    this.health = 1;
    this.healthMax = 1;
    this.movementPassion = 1;
    this.velocity = {
      x: direction.x * BulletDynamicEntity.MOVE_SPEED,
      y: direction.y * BulletDynamicEntity.MOVE_SPEED,
    };
    this.ownerId = ownerId;
    this.lifetimeRemaining = BulletDynamicEntity.MAX_LIFETIME;
    this.shouldRemove = false;
    this.isMoving = true;
    this.facingDirection = { ...direction };
    this.lastMoveDirection = { ...direction };
    this.damage = damage;
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

export { BulletDynamicEntity };

