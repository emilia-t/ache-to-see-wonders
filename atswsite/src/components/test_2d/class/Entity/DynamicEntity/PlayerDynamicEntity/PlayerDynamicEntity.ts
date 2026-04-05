import { DynamicEntity } from '../DynamicEntity';
import { StaticEntity } from '../../StaticEntity/StaticEntity';
import type { Point } from '../../../../interface/InterfaceTest2d';

class PlayerDynamicEntity extends DynamicEntity {
  static readonly WIDTH = 50;
  static readonly HEIGHT = 50;
  static readonly MOVE_SPEED = 320;
  static playerMoveState = {
    playerMoveW: false,
    playerMoveA: false,
    playerMoveS: false,
    playerMoveD: false
  };
  isme: boolean;

  constructor(
    position: Point,
    name: string = 'Player',
    isme: boolean = false
  ) {
    super(position, PlayerDynamicEntity.WIDTH, PlayerDynamicEntity.HEIGHT, '', name, 'player', 'player');
    this.isme = isme;
    this.fillColor = '#2d7ff9';
    this.minMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.maxMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.speed = PlayerDynamicEntity.MOVE_SPEED;
    this.wanderRange = 0;
    this.perceptionRange = 0;
    this.health = 100;
    this.movementPassion = 1;
    this.stop();
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
    if (this.isDead) return;

    let dx = 0;
    let dy = 0;
    if (PlayerDynamicEntity.playerMoveState.playerMoveW) dy += 1;
    if (PlayerDynamicEntity.playerMoveState.playerMoveS) dy -= 1;
    if (PlayerDynamicEntity.playerMoveState.playerMoveA) dx -= 1;
    if (PlayerDynamicEntity.playerMoveState.playerMoveD) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len < 0.0001) {
      this.isMoving = false;
      this.nextTarget = { ...this.position };
      this.targetHistory = [{ ...this.position }];
      this.curvePoints = [{ ...this.position }];
      this.currentCurveIndex = 0;
      return;
    }

    const velocity = this.speed * dt;
    const moveX = (dx / len) * velocity;
    const moveY = (dy / len) * velocity;
    const nextPosX = { x: this.position.x + moveX, y: this.position.y };
    const nextPosY = { x: this.position.x, y: this.position.y + moveY };
    let moved = false;

    if (!this.collidesWithStatic(nextPosX, staticEntities)) {
      this.position.x = nextPosX.x;
      moved = true;
    }
    if (!this.collidesWithStatic(nextPosY, staticEntities)) {
      this.position.y = nextPosY.y;
      moved = true;
    }

    this.updateCollisionBox();
    this.isMoving = moved;
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;

    if (moved) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      this.crowdStuckTimer = 0;
      this.insideStaticBlockedTimer = 0;
      this.facingDirection = {
        x: dx / len,
        y: dy / len,
      };
      this.lastMoveDirection = { ...this.facingDirection };
    }
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

export { PlayerDynamicEntity };

