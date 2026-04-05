import { BulletDynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class OrdinaryBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Ordinary Bullet') {
    super(position, direction, ownerId, 'short', name);
  }
}

export { OrdinaryBulletDynamicEntity };

