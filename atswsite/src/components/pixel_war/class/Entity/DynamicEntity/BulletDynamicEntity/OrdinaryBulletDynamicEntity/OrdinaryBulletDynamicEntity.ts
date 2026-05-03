import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class OrdinaryBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Ordinary Bullet') {
    super(position, direction, ownerId, 'short', name);
    this.damage = 50;
  }
}

export { OrdinaryBulletDynamicEntity };

