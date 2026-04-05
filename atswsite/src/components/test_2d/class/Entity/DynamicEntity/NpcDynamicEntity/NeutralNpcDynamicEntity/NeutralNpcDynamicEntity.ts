import { NpcDynamicEntity } from '../NpcDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class NeutralNpcDynamicEntity extends NpcDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string
  ) {
    super(position, width, height, texturePath, name, 'neutral', tag);
  }
}

export { NeutralNpcDynamicEntity };

