import { BulletDynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class LaserBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Laser Bullet') {
    super(position, direction, ownerId, 'long', name);
  }
}

export { LaserBulletDynamicEntity };

