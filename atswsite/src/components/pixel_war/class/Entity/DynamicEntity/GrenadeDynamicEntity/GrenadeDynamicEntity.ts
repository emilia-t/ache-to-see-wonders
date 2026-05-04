import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { GrenadePurpose } from '@/components/pixel_war/type/Type';
import type { Point } from '@/components/pixel_war/interface/Interface';

class GrenadeDynamicEntity extends DynamicEntity {
  purpose: GrenadePurpose;// 投掷物类型

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    purpose: GrenadePurpose,
    tag: string
  ) {
    super(position, width, height, texturePath, name, 'grenade', tag);
    this.purpose = purpose;
    this.health = 1;
    this.healthMax = 1;
  }
}

export { GrenadeDynamicEntity };

