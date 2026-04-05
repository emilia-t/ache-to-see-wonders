import { BulletDynamicEntity } from '../BulletDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class OrdinaryBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Ordinary Bullet') {
    super(position, direction, ownerId, 'short', name);
  }
}

export { OrdinaryBulletDynamicEntity };

