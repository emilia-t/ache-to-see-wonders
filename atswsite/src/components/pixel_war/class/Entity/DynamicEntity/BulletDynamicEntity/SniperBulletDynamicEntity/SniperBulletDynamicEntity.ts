import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class SniperBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Sniper Bullet') {
    super(position, direction, ownerId, 'long', name);
    this.damage = 100;
  }
}

export { SniperBulletDynamicEntity };

