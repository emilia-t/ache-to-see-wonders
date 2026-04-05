import { DynamicEntity } from '../DynamicEntity';
import type { GrenadePurpose } from '../../../../type/TypeTest2d';
import type { Point } from '../../../../interface/InterfaceTest2d';

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

