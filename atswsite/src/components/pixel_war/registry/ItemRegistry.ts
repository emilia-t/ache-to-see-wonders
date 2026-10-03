import type { ItemDefinition } from '@/components/pixel_war/interface/Interface';
import { INVENTORY_ITEM_MAX_STACK } from '@/components/pixel_war/class/Inventory/Inventory';

/**
 * 物品注册表:物品 tag -> 物品定义
 * 背包展示、堆叠上限与"使用物品"的效果均按 tag 在此查找。
 *
 * 对应 Java 侧:java/.../registry/ItemRegistry.java
 */
const ITEM_REGISTRY: ReadonlyMap<string, ItemDefinition> = new Map<string, ItemDefinition>([
  [
    'healing_gem',
    {
      tag: 'healing_gem',
      name: '治疗宝石',
      description: '使用后立即恢复 1 点生命值',
      color: '#7ef0b0',
      icon: 'gem',
      heal: 1,
      maxStack: INVENTORY_ITEM_MAX_STACK
    }
  ]
]);

/**
 * 按物品标签获取物品定义
 * 未注册的物品会返回一个"未知物品"兜底定义,保证背包界面始终可渲染。
 * @param tag 物品标签
 */
const H_getItemDefinition = (tag: string): ItemDefinition => {
  const definition = ITEM_REGISTRY.get(tag);
  if (definition) return definition;
  return {
    tag,
    name: tag || '未知物品',
    description: '未知物品',
    color: '#9fe8ff',
    icon: 'square',
    heal: 0,
    maxStack: INVENTORY_ITEM_MAX_STACK
  };
};

/**
 * 获取全部已注册物品定义
 */
const H_getAllItemDefinitions = (): ItemDefinition[] => Array.from(ITEM_REGISTRY.values());

/**
 * 判断物品标签是否已注册
 */
const H_isItemTagValid = (tag: string): boolean => ITEM_REGISTRY.has(tag);

export { ITEM_REGISTRY, H_getItemDefinition, H_getAllItemDefinitions, H_isItemTagValid };
