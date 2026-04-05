import { DynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/DynamicEntity';
import type { NpcAttitude } from '@/components/test_2d/type/TypeTest2d';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

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

