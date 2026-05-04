import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class BuckshotBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, name: string = 'Buckshot Bullet') {
    super(position, direction, ownerId, 'short', name, 20, 'buckshot_bullet');
    //
  }
}

export { BuckshotBulletDynamicEntity };

