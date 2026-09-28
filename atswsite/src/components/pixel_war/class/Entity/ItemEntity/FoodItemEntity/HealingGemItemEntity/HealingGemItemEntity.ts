import type { Point } from '@/components/pixel_war/interface/Interface';
import { FoodItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/FoodItemEntity/FoodItemEntity';
// 贴图资源已由 public/textures 迁移至 pixel_war/resource/textures,通过 Vite 资源导入解析为可用 URL
import healingGemItemEntityTextureUrl from '@/components/pixel_war/resource/textures/healing_gem_item_entity.png?url';

class HealingGemItemEntity extends FoodItemEntity {
  public static readonly WIDTH = 25;
  public static readonly HEIGHT = 25;
  public static readonly TEXTURE_PATH = healingGemItemEntityTextureUrl;

  constructor(
    position: Point,
    name: string = '',
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

