import { ItemEntity } from '@/components/test_2d/class/Entity/ItemEntity/ItemEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class FoodItemEntity extends ItemEntity {
  hungerMeterIncrease: number;// 食物增加的饥饿值
  
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag: string,
    hungerMeterIncrease: number
  ) {
    super(
      position,
      width,
      height,
      texturePath,
      name,
      tag,
      60
    );
    this.hungerMeterIncrease = hungerMeterIncrease;
  }
}

export { FoodItemEntity };

