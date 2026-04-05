import { DynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/DynamicEntity';
import { StaticEntity } from '@/components/test_2d/class/Entity/StaticEntity/StaticEntity';
import type { BulletRangeType } from '@/components/test_2d/type/TypeTest2d';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class BulletDynamicEntity extends DynamicEntity {
  static readonly WIDTH = 12;
  static readonly HEIGHT = 12;
  static readonly MOVE_SPEED = 720;
  static readonly DAMAGE = 34;
  static readonly MAX_LIFETIME = 1.2;

  velocity: Point;
  ownerId: number | null;
  lifetimeRemaining: number;
  shouldRemove: boolean;
  rangeType: BulletRangeType;// 子弹射程类型（短/长）

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    rangeType: BulletRangeType,
    name: string = 'Bullet'
  ) {
    super(position, BulletDynamicEntity.WIDTH, BulletDynamicEntity.HEIGHT, '', name, 'bullet', 'bullet');
    this.rangeType = rangeType;
    this.fillColor = '#ffd84d';
    this.minMoveSpeed = BulletDynamicEntity.MOVE_SPEED;
    this.maxMoveSpeed = BulletDynamicEntity.MOVE_SPEED;
    this.speed = BulletDynamicEntity.MOVE_SPEED;
    this.wanderRange = 0;
    this.perceptionRange = 0;
    this.health = 1;
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

  override update(dt: number, staticEntities: StaticEntity[]) {
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

  override updateCrowdStuckState(_dt: number) {}

  override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }

  override updateStayDuration(_dt: number) {}

  override canGetNewWanderTarget(_dt: number, _staticEntities: StaticEntity[]) {
    return false;
  }
}

export { BulletDynamicEntity };

