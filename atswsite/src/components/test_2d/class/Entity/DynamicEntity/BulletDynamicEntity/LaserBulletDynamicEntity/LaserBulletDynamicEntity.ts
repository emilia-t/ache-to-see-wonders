import { BulletDynamicEntity } from '../BulletDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class LaserBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Laser Bullet') {
    super(position, direction, ownerId, 'long', name);
  }
}

export { LaserBulletDynamicEntity };

