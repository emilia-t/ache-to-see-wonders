import type { Point } from '@/components/pixel_war/interface/Interface';
import { FoodItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/FoodItemEntity/FoodItemEntity';

class HealingGemItemEntity extends FoodItemEntity {
  public static readonly WIDTH = 25;
  public static readonly HEIGHT = 25;
  public static readonly TEXTURE_PATH = './textures/healing_gem_item_entity.png';

  constructor(
    position: Point,
    name: string = 'Healing Gem',
    tag: string = 'healing_gem'
  ) {
    super(
      position,
      HealingGemItemEntity.WIDTH,
      HealingGemItemEntity.HEIGHT,
      HealingGemItemEntity.TEXTURE_PATH,
      name,
      tag,
      40,
      10
    );
  }
}

export { HealingGemItemEntity };

