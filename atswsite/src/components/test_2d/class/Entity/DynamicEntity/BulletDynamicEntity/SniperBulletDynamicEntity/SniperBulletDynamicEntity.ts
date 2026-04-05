import { BulletDynamicEntity } from '../BulletDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class SniperBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Sniper Bullet') {
    super(position, direction, ownerId, 'long', name);
  }
}

export { SniperBulletDynamicEntity };

