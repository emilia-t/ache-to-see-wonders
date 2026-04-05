import { DynamicEntity } from '../DynamicEntity';
import type { NpcAttitude } from '../../../../type/TypeTest2d';
import type { Point } from '../../../../interface/InterfaceTest2d';

class NpcDynamicEntity extends DynamicEntity {
  attitude: NpcAttitude; // 友好/中立/敌对

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    attitude: NpcAttitude,
    tag?: string
  ) {
    super(position, width, height, texturePath, name, 'npc', tag);
    this.attitude = attitude;
  }
}

export { NpcDynamicEntity };

