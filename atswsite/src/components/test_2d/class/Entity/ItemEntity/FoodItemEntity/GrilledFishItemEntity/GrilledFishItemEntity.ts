import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';
import { FoodItemEntity } from '@/components/test_2d/class/Entity/ItemEntity/FoodItemEntity/FoodItemEntity';

class GrilledFishItemEntity extends FoodItemEntity {
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
      40
    );
  }
}

export { GrilledFishItemEntity };

