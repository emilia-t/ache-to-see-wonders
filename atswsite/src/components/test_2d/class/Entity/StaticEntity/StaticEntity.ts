import { Entity } from '@/components/test_2d/class/Entity/Entity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class StaticEntity extends Entity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string
  ) {
    super('static', position, width, height, texturePath, name, tag);
  }
}

export { StaticEntity };

