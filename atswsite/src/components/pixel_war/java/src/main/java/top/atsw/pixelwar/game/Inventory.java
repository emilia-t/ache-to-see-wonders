package top.atsw.pixelwar.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 背包与物品注册表(由前端 TS 版 class/Inventory/Inventory.ts 与 class/ItemRegistry/ItemRegistry.ts 迁移)。
 *
 * <p>背包规则与 TS 版一致:</p>
 * <ul>
 *   <li>背包采用"固定格子"模型,{@code entries} 长度固定 20,下标即界面槽位;</li>
 *   <li>技能不可堆叠;物品可堆叠,单格上限 50;</li>
 *   <li>技能装配区固定 10 个槽位,已装配的技能不再出现在背包网格中。</li>
 * </ul>
 */
public final class Inventory {

    /** 技能装配区槽位数量 */
    public static final int SKILL_SLOT_COUNT = 10;
    /** 单个物品格子的堆叠上限 */
    public static final int ITEM_MAX_STACK = 50;
    /** 背包网格容量(与前端背包界面网格 2×10 保持一致) */
    public static final int BAG_CAPACITY = 20;

    /** 条目种类:技能 / 物品 */
    public static final String KIND_SKILL = "skill";
    public static final String KIND_ITEM = "item";

    /** 背包条目 uid 自增种子 */
    private static final AtomicLong UID_SEED = new AtomicLong(1);

    private Inventory() {
    }

    // ==================================================================
    // 数据结构
    // ==================================================================

    /** 背包中的一个条目(技能 count 恒为 1,maxStack 恒为 1) */
    public static final class Entry {
        public String uid;
        public String kind;
        public String tag;
        public String name;
        public int count;
        public int maxStack;
        public String color;

        public Entry() {
        }

        public Entry(String uid, String kind, String tag, String name, int count, int maxStack, String color) {
            this.uid = uid;
            this.kind = kind;
            this.tag = tag;
            this.name = name;
            this.count = count;
            this.maxStack = maxStack;
            this.color = color;
        }

        public Entry copy() {
            return new Entry(uid, kind, tag, name, count, maxStack, color);
        }

        public boolean isSkill() {
            return KIND_SKILL.equals(kind);
        }
    }

    /** 玩家背包:上半部分为持有物网格,下半部分为技能装配区 */
    public static final class Bag {
        /** 背包网格(固定长度,元素为 null 表示空格) */
        public Entry[] entries = new Entry[BAG_CAPACITY];
        /** 技能装配区(10 个槽位,存放技能 tag,null 表示空槽) */
        public String[] equippedSkills = new String[SKILL_SLOT_COUNT];

        public static Bag createEmpty() {
            return new Bag();
        }
    }

    /** 物品定义(名称/说明/堆叠上限/使用效果) */
    public static final class ItemDefinition {
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

    /**
     * 物品注册表:物品 tag -> 物品定义。
     * 背包展示、堆叠上限与"使用物品"的效果均按 tag 在此查找。
     */
    public static final class ItemRegistry {
        private static final Map<String, ItemDefinition> REGISTRY = new LinkedHashMap<>();

        static {
            register(new ItemDefinition("healing_gem", "治疗宝石", "使用后立即恢复 10 点生命值",
                    "#7ef0b0", "gem", 10, ITEM_MAX_STACK));
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
                    "#9fe8ff", "square", 0, ITEM_MAX_STACK);
        }

        public static boolean isValid(String tag) {
            return REGISTRY.containsKey(tag);
        }

        public static List<ItemDefinition> all() {
            return new ArrayList<>(REGISTRY.values());
        }
    }

    // ==================================================================
    // 基础工具
    // ==================================================================

    /** 生成一个新的背包条目 uid */
    public static String createUid() {
        long seed = UID_SEED.incrementAndGet();
        return "inv_" + Long.toString(System.currentTimeMillis(), 36) + "_" + Long.toString(seed, 36);
    }

    /** 创建一个空的玩家背包 */
    public static Bag createEmpty() {
        return Bag.createEmpty();
    }

    /** 已占用的格子数量 */
    public static int usedSlotCount(Bag bag) {
        int used = 0;
        for (Entry entry : bag.entries) {
            if (entry != null) {
                used++;
            }
        }
        return used;
    }

    /** 取指定格子的条目(null 表示空格) */
    public static Entry getEntryAtSlot(Bag bag, int slot) {
        if (slot < 0 || slot >= bag.entries.length) {
            return null;
        }
        return bag.entries[slot];
    }

    /** 查找背包条目的格子下标(找不到返回 -1) */
    public static int indexOfUid(Bag bag, String uid) {
        for (int i = 0; i < bag.entries.length; i++) {
            Entry entry = bag.entries[i];
            if (entry != null && entry.uid.equals(uid)) {
                return i;
            }
        }
        return -1;
    }

    /** 按 uid 查找背包条目 */
    public static Entry findEntry(Bag bag, String uid) {
        int index = indexOfUid(bag, uid);
        return index >= 0 ? bag.entries[index] : null;
    }

    /** 第一个空格的下标(无空格返回 -1) */
    public static int firstEmptySlot(Bag bag) {
        for (int i = 0; i < bag.entries.length; i++) {
            if (bag.entries[i] == null) {
                return i;
            }
        }
        return -1;
    }

    /** 玩家是否已持有该技能(背包含有 或 已装配) */
    public static boolean hasSkill(Bag bag, String skillTag) {
        for (String tag : bag.equippedSkills) {
            if (skillTag.equals(tag)) {
                return true;
            }
        }
        for (Entry entry : bag.entries) {
            if (entry != null && entry.isSkill() && entry.tag.equals(skillTag)) {
                return true;
            }
        }
        return false;
    }

    /** 统计背包中该物品的总数量(含堆叠) */
    public static int countItem(Bag bag, String itemTag) {
        int total = 0;
        for (Entry entry : bag.entries) {
            if (entry != null && KIND_ITEM.equals(entry.kind) && entry.tag.equals(itemTag)) {
                total += entry.count;
            }
        }
        return total;
    }

    /** 判断背包是否还能继续容纳该物品(存在未满的同类堆叠 或 存在空格) */
    public static boolean canAcceptItem(Bag bag, String itemTag) {
        for (Entry entry : bag.entries) {
            if (entry != null && KIND_ITEM.equals(entry.kind) && entry.tag.equals(itemTag)
                    && entry.count < entry.maxStack) {
                return true;
            }
        }
        return firstEmptySlot(bag) >= 0;
    }

    /** 向背包添加一个技能(技能不可堆叠,已持有时不再重复添加) */
    public static boolean addSkill(Bag bag, String skillTag, String skillName, String color) {
        if (hasSkill(bag, skillTag)) {
            return false;
        }
        int slot = firstEmptySlot(bag);
        if (slot < 0) {
            return false;
        }
        bag.entries[slot] = new Entry(createUid(), KIND_SKILL, skillTag, skillName, 1, 1, color);
        return true;
    }

    /**
     * 向背包添加物品(自动堆叠,单格上限 50,超出部分占用新的空格)。
     *
     * @return 实际加入的数量
     */
    public static int addItem(Bag bag, String itemTag, String itemName, int count, String color, int maxStack) {
        int remaining = Math.max(0, count);
        if (remaining <= 0) {
            return 0;
        }
        int stackLimit = Math.max(1, Math.min(ITEM_MAX_STACK, maxStack > 0 ? maxStack : ITEM_MAX_STACK));
        int added = 0;

        // 1. 优先补齐已有的未满堆叠
        for (Entry entry : bag.entries) {
            if (remaining <= 0) {
                break;
            }
            if (entry == null || !KIND_ITEM.equals(entry.kind) || !entry.tag.equals(itemTag)) {
                continue;
            }
            int space = entry.maxStack - entry.count;
            if (space <= 0) {
                continue;
            }
            int move = Math.min(space, remaining);
            entry.count += move;
            remaining -= move;
            added += move;
        }

        // 2. 剩余部分占用新的空格
        while (remaining > 0) {
            int slot = firstEmptySlot(bag);
            if (slot < 0) {
                break;
            }
            int move = Math.min(stackLimit, remaining);
            String name = (itemName == null || itemName.isEmpty()) ? itemTag : itemName;
            bag.entries[slot] = new Entry(createUid(), KIND_ITEM, itemTag, name, move, stackLimit, color);
            remaining -= move;
            added += move;
        }

        return added;
    }

    /**
     * 移除指定格子中的条目。
     *
     * @param count 移除数量,传入 {@link Integer#MAX_VALUE} 表示清空该格
     * @return 是否发生了变化
     */
    public static boolean removeSlot(Bag bag, int slot, int count) {
        Entry entry = getEntryAtSlot(bag, slot);
        if (entry == null) {
            return false;
        }
        if (count >= entry.count) {
            bag.entries[slot] = null;
            return true;
        }
        entry.count -= Math.max(1, count);
        if (entry.count <= 0) {
            bag.entries[slot] = null;
        }
        return true;
    }

    /** 从背包移除指定条目(按 uid 定位) */
    public static boolean removeEntry(Bag bag, String uid, int count) {
        int index = indexOfUid(bag, uid);
        if (index < 0) {
            return false;
        }
        return removeSlot(bag, index, count);
    }

    /** 生成一个技能条目(用于把技能放回背包) */
    private static Entry createSkillBagEntry(String tag, String name, String color) {
        return new Entry(createUid(), KIND_SKILL, tag, name, 1, 1, color);
    }

    /**
     * 将背包中的技能装配到指定槽位。
     * 若目标槽位已被其他技能占用,被替换的技能会放到该技能腾出的背包格子中(原地交换)。
     */
    public static boolean equipSkill(Bag bag, String tag, int slotIndex, Skill.Provider skills) {
        if (slotIndex < 0 || slotIndex >= SKILL_SLOT_COUNT) {
            return false;
        }
        int bagSlot = -1;
        for (int i = 0; i < bag.entries.length; i++) {
            Entry entry = bag.entries[i];
            if (entry != null && entry.isSkill() && entry.tag.equals(tag)) {
                bagSlot = i;
                break;
            }
        }
        if (bagSlot < 0) {
            return false;
        }

        String displaced = bag.equippedSkills[slotIndex];
        if (displaced != null && !displaced.equals(tag)) {
            var displacedSkill = skills.byTag(displaced);
            if (displacedSkill == null) {
                return false;
            }
            bag.entries[bagSlot] = createSkillBagEntry(displacedSkill.tag(), displacedSkill.name(), displacedSkill.color());
            bag.equippedSkills[slotIndex] = tag;
            return true;
        }

        bag.entries[bagSlot] = null;
        bag.equippedSkills[slotIndex] = tag;
        return true;
    }

    /** 将背包中的技能自动装配到第一个空槽,返回装配到的槽位下标(失败返回 null) */
    public static Integer autoEquipSkill(Bag bag, String tag, Skill.Provider skills) {
        for (int i = 0; i < SKILL_SLOT_COUNT; i++) {
            if (bag.equippedSkills[i] == null) {
                return equipSkill(bag, tag, i, skills) ? i : null;
            }
        }
        return null;
    }

    /** 卸下指定槽位的技能,放回背包(占用第一个空格) */
    public static boolean unequipSkill(Bag bag, int slotIndex, Skill.Provider skills) {
        if (slotIndex < 0 || slotIndex >= SKILL_SLOT_COUNT) {
            return false;
        }
        String tag = bag.equippedSkills[slotIndex];
        if (tag == null) {
            return false;
        }
        var skill = skills.byTag(tag);
        if (skill == null) {
            return false;
        }
        int emptySlot = firstEmptySlot(bag);
        if (emptySlot < 0) {
            return false;
        }
        bag.entries[emptySlot] = createSkillBagEntry(skill.tag(), skill.name(), skill.color());
        bag.equippedSkills[slotIndex] = null;
        return true;
    }

    /** 卸下指定槽位的技能,并放入指定的背包格(要求该格为空) */
    public static boolean unequipSkillToSlot(Bag bag, int slotIndex, int bagSlot, Skill.Provider skills) {
        if (slotIndex < 0 || slotIndex >= SKILL_SLOT_COUNT) {
            return false;
        }
        if (bagSlot < 0 || bagSlot >= bag.entries.length) {
            return false;
        }
        if (bag.entries[bagSlot] != null) {
            return false;
        }
        String tag = bag.equippedSkills[slotIndex];
        if (tag == null) {
            return false;
        }
        var skill = skills.byTag(tag);
        if (skill == null) {
            return false;
        }
        bag.entries[bagSlot] = createSkillBagEntry(skill.tag(), skill.name(), skill.color());
        bag.equippedSkills[slotIndex] = null;
        return true;
    }

    /** 交换/移动两个技能槽 */
    public static boolean moveSkillSlot(Bag bag, int from, int to) {
        if (from == to || from < 0 || from >= SKILL_SLOT_COUNT || to < 0 || to >= SKILL_SLOT_COUNT) {
            return false;
        }
        String temp = bag.equippedSkills[to];
        bag.equippedSkills[to] = bag.equippedSkills[from];
        bag.equippedSkills[from] = temp;
        return true;
    }

    /**
     * 背包格之间的移动/交换/合并:
     * 目标格为空 -> 直接移动;目标是同种物品且未满堆叠 -> 合并堆叠;其余情况 -> 两格交换。
     */
    public static boolean moveEntry(Bag bag, int from, int to) {
        if (from == to || from < 0 || from >= bag.entries.length || to < 0 || to >= bag.entries.length) {
            return false;
        }
        Entry fromEntry = bag.entries[from];
        Entry toEntry = bag.entries[to];
        if (fromEntry == null) {
            return false;
        }

        if (toEntry != null && KIND_ITEM.equals(fromEntry.kind) && KIND_ITEM.equals(toEntry.kind)
                && fromEntry.tag.equals(toEntry.tag)) {
            int space = toEntry.maxStack - toEntry.count;
            if (space > 0) {
                int move = Math.min(space, fromEntry.count);
                toEntry.count += move;
                fromEntry.count -= move;
                if (fromEntry.count <= 0) {
                    bag.entries[from] = null;
                }
                return true;
            }
        }

        bag.entries[to] = fromEntry;
        bag.entries[from] = toEntry;
        return true;
    }

    /** 销毁背包条目(按 uid 定位,整条移除) */
    public static boolean destroyEntry(Bag bag, String uid) {
        return removeEntry(bag, uid, Integer.MAX_VALUE);
    }

    /** 销毁指定背包格中的条目 */
    public static boolean destroySlot(Bag bag, int slot) {
        return removeSlot(bag, slot, Integer.MAX_VALUE);
    }

    /** 销毁已装配的槽位技能 */
    public static boolean destroyEquipped(Bag bag, int slotIndex) {
        if (slotIndex < 0 || slotIndex >= SKILL_SLOT_COUNT || bag.equippedSkills[slotIndex] == null) {
            return false;
        }
        bag.equippedSkills[slotIndex] = null;
        return true;
    }

    // ==================================================================
    // 规范化(用于客户端提交数据 / 快照覆盖 / 旧数据兜底)
    // ==================================================================

    /** 规范化技能装配区:保证长度为 10、元素为字符串或 null */
    public static String[] normalizeEquippedSkills(List<String> raw) {
        String[] slots = new String[SKILL_SLOT_COUNT];
        if (raw == null) {
            return slots;
        }
        for (int i = 0; i < SKILL_SLOT_COUNT && i < raw.size(); i++) {
            String value = raw.get(i);
            slots[i] = (value != null && !value.isEmpty()) ? value : null;
        }
        return slots;
    }

    /** 规范化背包网格:固定长度,过滤非法条目并修正数量/堆叠上限 */
    public static Entry[] normalizeEntries(List<Entry> raw) {
        Entry[] slots = new Entry[BAG_CAPACITY];
        if (raw == null) {
            return slots;
        }
        int limit = Math.min(BAG_CAPACITY, raw.size());
        for (int i = 0; i < limit; i++) {
            Entry item = raw.get(i);
            if (item == null) {
                continue;
            }
            if (!KIND_SKILL.equals(item.kind) && !KIND_ITEM.equals(item.kind)) {
                continue;
            }
            if (item.tag == null || item.tag.isEmpty()) {
                continue;
            }
            boolean isSkill = KIND_SKILL.equals(item.kind);
            int maxStack = isSkill
                    ? 1
                    : Math.max(1, Math.min(ITEM_MAX_STACK, item.maxStack > 0 ? item.maxStack : ITEM_MAX_STACK));
            int count = Math.max(1, Math.min(maxStack, item.count > 0 ? item.count : 1));
            String uid = (item.uid != null && !item.uid.isEmpty()) ? item.uid : createUid();
            String name = (item.name != null && !item.name.isEmpty()) ? item.name : item.tag;
            String color = (item.color != null && !item.color.isEmpty()) ? item.color : "#9fe8ff";
            slots[i] = new Entry(uid, item.kind, item.tag, name, isSkill ? 1 : count, maxStack, color);
        }
        return slots;
    }

    /** 规范化任意来源的背包数据 */
    public static Bag normalize(List<Entry> entries, List<String> equippedSkills) {
        Bag bag = new Bag();
        bag.entries = normalizeEntries(entries);
        bag.equippedSkills = normalizeEquippedSkills(equippedSkills);
        return bag;
    }

    /** 深拷贝一份背包(用于单播快照,避免外部修改服务端状态) */
    public static Bag copyOf(Bag source) {
        Bag bag = new Bag();
        for (int i = 0; i < source.entries.length; i++) {
            bag.entries[i] = source.entries[i] == null ? null : source.entries[i].copy();
        }
        System.arraycopy(source.equippedSkills, 0, bag.equippedSkills, 0, source.equippedSkills.length);
        return bag;
    }
}
