import { CatDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/CatDynamicEntity/CatDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class RagdollCatDynamicEntity extends CatDynamicEntity {
  static readonly TEXTURE_PATH = './textures/cat_ragdoll.png';
  static readonly FIXED_WIDTH = 50;
  static readonly FIXED_HEIGHT = 50;

  constructor(
    position: Point,
    name: string = 'Cat'
  ) {
    super(
      position,
      RagdollCatDynamicEntity.FIXED_WIDTH,
      RagdollCatDynamicEntity.FIXED_HEIGHT,
      RagdollCatDynamicEntity.TEXTURE_PATH,
      name
    );
  }
}

export { RagdollCatDynamicEntity };

