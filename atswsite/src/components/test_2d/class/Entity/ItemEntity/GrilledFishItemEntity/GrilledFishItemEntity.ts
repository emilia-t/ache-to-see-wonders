import { ItemEntity } from '@/components/test_2d/class/Entity/ItemEntity/ItemEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class GrilledFishItemEntity extends ItemEntity {
  static readonly WIDTH = 40;
  static readonly HEIGHT = 40;
  static readonly TEXTURE_PATH = './textures/grilled_fish.png';

  constructor(
    position: Point,
    name: string = 'Grilled Fish',
    tag: string = 'grilled_fish'
  ) {
    super(
      position,
      GrilledFishItemEntity.WIDTH,
      GrilledFishItemEntity.HEIGHT,
      GrilledFishItemEntity.TEXTURE_PATH,
      name,
      tag,
      60
    );
  }
}

export { GrilledFishItemEntity };

