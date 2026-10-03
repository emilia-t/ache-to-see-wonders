package top.atsw.pixelwar.registry;

import top.atsw.pixelwar.game.Inventory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 物品注册表:物品 tag -> 物品定义(对应 TS 版 registry/ItemRegistry.ts)。
 *
 * <p>背包展示、堆叠上限与"使用物品"的效果均按 tag 在此查找。
 * 原先作为 {@code Inventory} 的内部类,现独立到 registry 包。</p>
 */
public final class ItemRegistry {
    private static final Map<String, ItemDefinition> REGISTRY = new LinkedHashMap<>();

    static {
        register(new ItemDefinition("healing_gem", "治疗宝石", "使用后立即恢复 1 点生命值",
                "#7ef0b0", "gem", 1, Inventory.ITEM_MAX_STACK));
    }

    private ItemRegistry() {
    }

    private static void register(ItemDefinition definition) {
        REGISTRY.put(definition.tag, definition);
    }

    /** 按物品标签获取定义;未注册的物品返回"未知物品"兜底定义 */
    public static ItemDefinition get(String tag) {
        ItemDefinition definition = REGISTRY.get(tag);
        if (definition != null) {
            return definition;
        }
        String safeTag = tag == null ? "" : tag;
        return new ItemDefinition(safeTag, safeTag.isEmpty() ? "未知物品" : safeTag, "未知物品",
                "#9fe8ff", "square", 0, Inventory.ITEM_MAX_STACK);
    }

    public static boolean isValid(String tag) {
        return REGISTRY.containsKey(tag);
    }

    public static List<ItemDefinition> all() {
        return new ArrayList<>(REGISTRY.values());
    }
}
