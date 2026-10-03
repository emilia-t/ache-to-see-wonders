package top.atsw.pixelwar.registry;

/**
 * 物品定义(名称/说明/堆叠上限/使用效果)。
 *
 * <p>原先作为 {@code Inventory} 的内部类,现独立到 registry 包,便于从包结构直接看出
 * "物品定义表"的位置。对应 TS 版 interface/Interface.ts 的 {@code ItemDefinition}。</p>
 */
public final class ItemDefinition {
    public final String tag;
    public final String name;
    public final String description;
    public final String color;
    public final String icon;
    public final double heal;
    public final int maxStack;

    public ItemDefinition(String tag, String name, String description, String color, String icon, double heal, int maxStack) {
        this.tag = tag;
        this.name = name;
        this.description = description;
        this.color = color;
        this.icon = icon;
        this.heal = heal;
        this.maxStack = maxStack;
    }
}
