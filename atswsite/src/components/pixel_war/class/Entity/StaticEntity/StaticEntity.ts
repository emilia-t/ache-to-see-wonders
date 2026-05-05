import { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { Point } from '@/components/pixel_war/interface/Interface';

abstract class StaticEntity extends Entity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag: string,
  ) {
    super('static', position, width, height, texturePath, name, tag);
  }
}

export { StaticEntity };

