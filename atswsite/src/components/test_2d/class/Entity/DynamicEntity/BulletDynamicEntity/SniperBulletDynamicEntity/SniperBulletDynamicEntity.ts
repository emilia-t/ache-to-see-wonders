import { BulletDynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class SniperBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Sniper Bullet') {
    super(position, direction, ownerId, 'long', name);
  }
}

export { SniperBulletDynamicEntity };

