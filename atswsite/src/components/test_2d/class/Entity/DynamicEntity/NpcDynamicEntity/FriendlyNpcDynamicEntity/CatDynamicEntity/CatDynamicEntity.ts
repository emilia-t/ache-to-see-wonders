import { FriendlyNpcDynamicEntity } from '../FriendlyNpcDynamicEntity';
import type { Point } from '../../../../../../interface/InterfaceTest2d';

class CatDynamicEntity extends FriendlyNpcDynamicEntity {
  static readonly CAT_HUNGER_TOO_FULL_THRESHOLD = 180; // 超过该饱腹值后不主动拾取烤鱼
  chasingItemId: number | null;
  hungerMeter: number; // 饥饿值（0~200）
  hungerDecayTimer: number; // 饥饿衰减计时器（秒）
  hungerDamageTimer: number; // 饥饿伤害计时器（秒）

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Cat'
  ) {
    super(position, width, height, texturePath, name, 'cat');
    this.chasingItemId = null;
    this.hungerMeter = 100;
    this.hungerDecayTimer = 0;
    this.hungerDamageTimer = 0;
    this.tag = 'cat';
    this.health = 50;
    this.minMoveSpeed = 50;
    this.maxMoveSpeed = 100;
    this.wanderRange = 12 * ((this.width / 2) + (this.height / 2));
    this.perceptionRange = 8 * ((this.width / 2) + (this.height / 2));
    const baseSpeed = this.minMoveSpeed + Math.random() * (this.maxMoveSpeed - this.minMoveSpeed);
    this.speed = baseSpeed * this.movementPassion;
  }

  clearChasingItem() {
    this.chasingItemId = null;
  }

  addHunger(amount: number) {
    if (amount <= 0 || this.isDead) return;
    this.hungerMeter = Math.min(200, Math.max(0, this.hungerMeter + amount));
    if (this.hungerMeter > 0) {
      this.hungerDamageTimer = 0;
    }
  }

  updateHunger(dt: number) {
    if (this.isDead) return;

    this.hungerDecayTimer += dt;
    while (this.hungerDecayTimer >= 1) {
      this.hungerDecayTimer -= 1;
      this.hungerMeter = Math.max(0, this.hungerMeter - 1);
    }

    if (this.hungerMeter <= 0) {
      this.hungerDamageTimer += dt;
      while (this.hungerDamageTimer >= 1) {
        this.hungerDamageTimer -= 1;
        this.applyDamage(1);
      }
    } else {
      this.hungerDamageTimer = 0;
    }
  }
}

export { CatDynamicEntity };

