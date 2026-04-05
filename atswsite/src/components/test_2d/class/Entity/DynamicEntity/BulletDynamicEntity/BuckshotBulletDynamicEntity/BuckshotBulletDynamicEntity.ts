import { BulletDynamicEntity } from '../BulletDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class BuckshotBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Buckshot Bullet') {
    super(position, direction, ownerId, 'short', name);
  }
}

export { BuckshotBulletDynamicEntity };

