import { DynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/DynamicEntity';
import type { GrenadePurpose } from '@/components/test_2d/type/TypeTest2d';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class GrenadeDynamicEntity extends DynamicEntity {
  purpose: GrenadePurpose;// 投掷物类型

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    purpose: GrenadePurpose,
    tag?: string
  ) {
    super(position, width, height, texturePath, name, 'grenade', tag);
    this.purpose = purpose;
  }
}

export { GrenadeDynamicEntity };

