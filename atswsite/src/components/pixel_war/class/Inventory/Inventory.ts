import type { InventoryEntry, PlayerInventory } from '@/components/pixel_war/interface/Interface';
import type { Skill } from '@/components/pixel_war/class/Skill/Skill';
import { H_getSkillByTag } from '@/components/pixel_war/registry/SkillRegistry';

/**
 * 背包实现说明
 *
 * 背包采用"固定格子"模型(与背包界面网格 2×10 一一对应):
 * - entries 是长度固定为 INVENTORY_BAG_CAPACITY 的数组,元素为条目或 null(空格)
 * - 格子下标即界面槽位下标,因此拖拽/点击可以精确落到用户指定的格子
 * - 技能不可堆叠;物品可堆叠,单格上限 INVENTORY_ITEM_MAX_STACK(50)
 * - 技能装配区(equippedSkills)为 10 个槽位,已装配的技能不再出现在背包网格中
 * - 技能装配区分两组:前 INVENTORY_INNATE_SKILL_SLOT_COUNT 格为"固有技能槽"(锁定,不可编辑),
 *   后 INVENTORY_EXTENDED_SKILL_SLOT_COUNT 格为"拓展技能槽"(可移动/替换/排序/卸下/销毁);
 *   两组槽位与底部状态栏技能槽一一对应(下标相同)
 */

/** 技能装配区槽位数量(含固有技能槽与拓展技能槽) */
const INVENTORY_SKILL_SLOT_COUNT = 10;
/** 技能装配区中的"固有技能槽"数量(前 2 格:锁定,不参与任何编辑操作) */
const INVENTORY_INNATE_SKILL_SLOT_COUNT = 2;
/** 技能装配区中的"拓展技能槽"数量(后 8 格:可自由调整) */
const INVENTORY_EXTENDED_SKILL_SLOT_COUNT = INVENTORY_SKILL_SLOT_COUNT - INVENTORY_INNATE_SKILL_SLOT_COUNT;

/**
 * 槽位是否为"固有技能槽"(前 2 格)
 * 固有槽不存储技能数据:它对应的能力是固定功能键,由界面直接绘制
 */
const H_inventoryIsInnateSkillSlot = (slotIndex: number): boolean =>
  slotIndex >= 0 && slotIndex < INVENTORY_INNATE_SKILL_SLOT_COUNT;

/**
 * 槽位是否为可编辑的"拓展技能槽"(后 8 格)
 * 所有装配/卸下/排序/销毁操作都只允许作用于拓展技能槽。
 */
const H_inventoryIsExtendedSkillSlot = (slotIndex: number): boolean =>
  slotIndex >= INVENTORY_INNATE_SKILL_SLOT_COUNT && slotIndex < INVENTORY_SKILL_SLOT_COUNT;
/** 单个物品格子的堆叠上限 */
const INVENTORY_ITEM_MAX_STACK = 50;
/** 背包网格容量(需与背包界面网格 2×10 保持一致) */
const INVENTORY_BAG_CAPACITY = 20;

/** 背包条目 uid 自增种子 */
let inventoryUidSeed = 1;

/**
 * 创建一个新的背包条目 uid
 */
const H_createInventoryUid = (): string => {
  inventoryUidSeed += 1;
  return `inv_${Date.now().toString(36)}_${inventoryUidSeed.toString(36)}`;
};

/**
 * 创建一个空的玩家背包(全部格子为空)
 */
const H_createEmptyPlayerInventory = (): PlayerInventory => ({
  entries: new Array<InventoryEntry | null>(INVENTORY_BAG_CAPACITY).fill(null),
  equippedSkills: new Array<string | null>(INVENTORY_SKILL_SLOT_COUNT).fill(null)
});

/**
 * 规范化技能装配区:保证长度为 10、元素为字符串或 null
 *
 * 前 INVENTORY_INNATE_SKILL_SLOT_COUNT 格为"固有技能槽"，恒不可被技能占用；
 * 旧数据或异常数据若把技能写进固有槽，会被迁移到第一个空的"拓展技能槽"。
 */
const H_normalizeEquippedSkills = (raw: unknown): (string | null)[] => {
  const slots = new Array<string | null>(INVENTORY_SKILL_SLOT_COUNT).fill(null);
  if (Array.isArray(raw)) {
    for (let i = 0; i < INVENTORY_SKILL_SLOT_COUNT; i++) {
      const value = raw[i];
      slots[i] = typeof value === 'string' && value !== '' ? value : null;
    }
  }
  H_inventoryMigrateInnateSkillSlots(slots);
  return slots;
};

/**
 * 把误占"固有技能槽"的技能迁移到第一个空的"拓展技能槽"
 * (固有槽不做技能存储:它对应的能力是固定功能键,由界面直接绘制)
 */
const H_inventoryMigrateInnateSkillSlots = (equippedSkills: (string | null)[]): void => {
  for (let i = 0; i < INVENTORY_INNATE_SKILL_SLOT_COUNT; i++) {
    const tag = equippedSkills[i];
    if (tag === null) continue;
    equippedSkills[i] = null;
    const emptySlot = equippedSkills.findIndex(
      (value, index) => H_inventoryIsExtendedSkillSlot(index) && value === null
    );
    if (emptySlot >= 0) equippedSkills[emptySlot] = tag;
  }
};

/**
 * 规范化背包网格:固定长度,过滤非法条目并修正数量/堆叠上限
 */
const H_normalizeEntries = (raw: unknown): (InventoryEntry | null)[] => {
  const slots = new Array<InventoryEntry | null>(INVENTORY_BAG_CAPACITY).fill(null);
  if (!Array.isArray(raw)) return slots;
  const limit = Math.min(INVENTORY_BAG_CAPACITY, raw.length);
  for (let i = 0; i < limit; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const source = item as Partial<InventoryEntry>;
    if (source.kind !== 'skill' && source.kind !== 'item') continue;
    if (typeof source.tag !== 'string' || source.tag === '') continue;

    const isSkill = source.kind === 'skill';
    const maxStack = isSkill
      ? 1
      : Math.max(1, Math.min(INVENTORY_ITEM_MAX_STACK, Math.floor(Number(source.maxStack) || INVENTORY_ITEM_MAX_STACK)));
    const count = Math.max(1, Math.min(maxStack, Math.floor(Number(source.count) || 1)));
    slots[i] = {
      uid: typeof source.uid === 'string' && source.uid !== '' ? source.uid : H_createInventoryUid(),
      kind: source.kind,
      tag: source.tag,
      name: typeof source.name === 'string' && source.name !== '' ? source.name : source.tag,
      count: isSkill ? 1 : count,
      maxStack,
      color: typeof source.color === 'string' && source.color !== '' ? source.color : '#9fe8ff'
    };
  }
  return slots;
};

/**
 * 规范化任意来源的背包数据(用于快照覆盖、客户端提交与旧数据兜底)
 */
const H_normalizePlayerInventory = (raw: unknown): PlayerInventory => {
  if (!raw || typeof raw !== 'object') return H_createEmptyPlayerInventory();
  const source = raw as Partial<PlayerInventory>;
  return {
    entries: H_normalizeEntries(source.entries),
    equippedSkills: H_normalizeEquippedSkills(source.equippedSkills)
  };
};

/**
 * 确保玩家的背包字段合法可用
 * 结构合法时直接返回原对象(避免每帧重新分配),否则返回一份规范化后的新背包。
 */
const H_ensurePlayerInventory = (raw: unknown): PlayerInventory => {
  if (!raw || typeof raw !== 'object') return H_createEmptyPlayerInventory();
  const source = raw as Partial<PlayerInventory>;
  const entriesValid = Array.isArray(source.entries) && source.entries.length === INVENTORY_BAG_CAPACITY;
  const equipValid = Array.isArray(source.equippedSkills) && source.equippedSkills.length === INVENTORY_SKILL_SLOT_COUNT;
  if (!entriesValid || !equipValid) return H_normalizePlayerInventory(raw);
  return raw as PlayerInventory;
};

/**
 * 取指定格子的条目(null 表示空格)
 */
const H_inventoryGetEntryAtSlot = (inventory: PlayerInventory, slot: number): InventoryEntry | null => {
  if (slot < 0 || slot >= inventory.entries.length) return null;
  return inventory.entries[slot] ?? null;
};

/**
 * 查找背包条目的格子下标(找不到返回 -1)
 */
const H_inventoryIndexOfUid = (inventory: PlayerInventory, uid: string): number => {
  return inventory.entries.findIndex(entry => entry !== null && entry.uid === uid);
};

/**
 * 按 uid 查找背包条目
 */
const H_inventoryFindEntry = (inventory: PlayerInventory, uid: string): InventoryEntry | null => {
  const index = H_inventoryIndexOfUid(inventory, uid);
  return index >= 0 ? inventory.entries[index] : null;
};

/**
 * 第一个空格的下标(无空格返回 -1)
 */
const H_inventoryFirstEmptySlot = (inventory: PlayerInventory): number => {
  return inventory.entries.findIndex(entry => entry === null);
};

/**
 * 已占用的格子数量
 */
const H_inventoryUsedSlotCount = (inventory: PlayerInventory): number => {
  let used = 0;
  for (const entry of inventory.entries) if (entry !== null) used++;
  return used;
};

/**
 * 玩家是否已持有该技能(背包含有 或 已装配)
 */
const H_inventoryHasSkill = (inventory: PlayerInventory, skillTag: string): boolean => {
  if (inventory.equippedSkills.includes(skillTag)) return true;
  return inventory.entries.some(entry => entry !== null && entry.kind === 'skill' && entry.tag === skillTag);
};

/**
 * 统计背包中该物品的总数量(含堆叠)
 */
const H_inventoryCountItem = (inventory: PlayerInventory, itemTag: string): number => {
  let total = 0;
  for (const entry of inventory.entries) {
    if (entry !== null && entry.kind === 'item' && entry.tag === itemTag) total += entry.count;
  }
  return total;
};

/**
 * 判断背包是否还能继续容纳该物品
 * 存在未满的同类堆叠 或 存在空格时返回 true
 */
const H_inventoryCanAcceptItem = (inventory: PlayerInventory, itemTag: string): boolean => {
  const hasPartialStack = inventory.entries.some(
    entry => entry !== null && entry.kind === 'item' && entry.tag === itemTag && entry.count < entry.maxStack
  );
  if (hasPartialStack) return true;
  return H_inventoryFirstEmptySlot(inventory) >= 0;
};

/**
 * 向背包添加一个技能(技能不可堆叠,已持有时不再重复添加)
 * @returns 是否添加成功(已持有或没有空格时返回 false)
 */
const H_inventoryAddSkill = (inventory: PlayerInventory, skill: Skill): boolean => {
  if (H_inventoryHasSkill(inventory, skill.tag)) return false;
  const slot = H_inventoryFirstEmptySlot(inventory);
  if (slot < 0) return false;
  inventory.entries[slot] = {
    uid: H_createInventoryUid(),
    kind: 'skill',
    tag: skill.tag,
    name: skill.name,
    count: 1,
    maxStack: 1,
    color: skill.color
  };
  return true;
};

/**
 * 向背包添加物品(自动堆叠,单格上限 50,超出部分占用新的空格)
 * @returns 实际加入的数量
 */
const H_inventoryAddItem = (
  inventory: PlayerInventory,
  itemTag: string,
  itemName: string,
  count: number,
  color: string = '#9fe8ff',
  maxStack: number = INVENTORY_ITEM_MAX_STACK
): number => {
  let remaining = Math.max(0, Math.floor(count));
  if (remaining <= 0) return 0;
  const stackLimit = Math.max(1, Math.min(INVENTORY_ITEM_MAX_STACK, Math.floor(maxStack) || INVENTORY_ITEM_MAX_STACK));
  let added = 0;

  // 1. 优先补齐已有的未满堆叠
  for (const entry of inventory.entries) {
    if (remaining <= 0) break;
    if (entry === null || entry.kind !== 'item' || entry.tag !== itemTag) continue;
    const space = entry.maxStack - entry.count;
    if (space <= 0) continue;
    const move = Math.min(space, remaining);
    entry.count += move;
    remaining -= move;
    added += move;
  }

  // 2. 剩余部分占用新的空格
  while (remaining > 0) {
    const slot = H_inventoryFirstEmptySlot(inventory);
    if (slot < 0) break;// 背包已满
    const move = Math.min(stackLimit, remaining);
    inventory.entries[slot] = {
      uid: H_createInventoryUid(),
      kind: 'item',
      tag: itemTag,
      name: itemName || itemTag,
      count: move,
      maxStack: stackLimit,
      color
    };
    remaining -= move;
    added += move;
  }

  return added;
};

/**
 * 移除指定格子中的条目(可用于销毁整格或扣减数量)
 * @param count 移除数量,传入 Infinity 表示清空该格
 * @returns 是否发生了变化
 */
const H_inventoryRemoveSlot = (inventory: PlayerInventory, slot: number, count: number = Infinity): boolean => {
  const entry = H_inventoryGetEntryAtSlot(inventory, slot);
  if (entry === null) return false;
  if (count >= entry.count) {
    inventory.entries[slot] = null;
    return true;
  }
  entry.count -= Math.max(1, Math.floor(count));
  if (entry.count <= 0) inventory.entries[slot] = null;
  return true;
};

/**
 * 从背包移除指定条目(按 uid 定位,可用于"使用物品"等按 uid 操作的场景)
 * @param count 移除数量,传入 Infinity 表示整条移除
 * @returns 是否发生了移除
 */
const H_inventoryRemoveEntry = (inventory: PlayerInventory, uid: string, count: number = Infinity): boolean => {
  const index = H_inventoryIndexOfUid(inventory, uid);
  if (index < 0) return false;
  return H_inventoryRemoveSlot(inventory, index, count);
};

/**
 * 生成一个技能条目(用于把技能放回背包)
 */
const H_createSkillBagEntry = (skill: Skill): InventoryEntry => ({
  uid: H_createInventoryUid(),
  kind: 'skill',
  tag: skill.tag,
  name: skill.name,
  count: 1,
  maxStack: 1,
  color: skill.color
});

/**
 * 将背包中的技能装配到指定槽位
 * - 固有技能槽(前 2 格)不可装配
 * - 若目标槽位已被其他技能占用,被替换的技能会放到该技能腾出的背包格子中(原地交换)
 * - 成功后该技能从背包网格中移除
 * @returns 是否装配成功
 */
const H_inventoryEquipSkill = (inventory: PlayerInventory, tag: string, slotIndex: number): boolean => {
  // 仅"拓展技能槽"可装配(固有技能槽锁定)
  if (!H_inventoryIsExtendedSkillSlot(slotIndex)) return false;
  const bagSlot = inventory.entries.findIndex(
    entry => entry !== null && entry.kind === 'skill' && entry.tag === tag
  );
  if (bagSlot < 0) return false;

  const displaced = inventory.equippedSkills[slotIndex];
  if (displaced !== null && displaced !== tag) {
    const displacedSkill = H_getSkillByTag(displaced);
    if (displacedSkill === null) return false;
    // 被替换的技能直接放到腾出的格子中,避免背包被占满时装配失败
    inventory.entries[bagSlot] = H_createSkillBagEntry(displacedSkill);
    inventory.equippedSkills[slotIndex] = tag;
    return true;
  }

  inventory.entries[bagSlot] = null;
  inventory.equippedSkills[slotIndex] = tag;
  return true;
};

/**
 * 将背包中的技能自动装配到第一个空的"拓展技能槽"
 * @returns 装配到的槽位下标,无空槽或失败时返回 null
 */
const H_inventoryAutoEquipSkill = (inventory: PlayerInventory, tag: string): number | null => {
  const slotIndex = inventory.equippedSkills.findIndex(
    (value, index) => H_inventoryIsExtendedSkillSlot(index) && value === null
  );
  if (slotIndex < 0) return null;
  return H_inventoryEquipSkill(inventory, tag, slotIndex) ? slotIndex : null;
};

/**
 * 卸下指定"拓展技能槽"的技能,放回背包(占用第一个空格)
 * @returns 是否卸载成功
 */
const H_inventoryUnequipSkill = (inventory: PlayerInventory, slotIndex: number): boolean => {
  // 固有技能槽不可卸下
  if (!H_inventoryIsExtendedSkillSlot(slotIndex)) return false;
  const tag = inventory.equippedSkills[slotIndex];
  if (tag === null) return false;
  const skill = H_getSkillByTag(tag);
  if (skill === null) return false;
  const emptySlot = H_inventoryFirstEmptySlot(inventory);
  if (emptySlot < 0) return false;
  inventory.entries[emptySlot] = H_createSkillBagEntry(skill);
  inventory.equippedSkills[slotIndex] = null;
  return true;
};

/**
 * 卸下指定"拓展技能槽"的技能,并放入指定的背包格(要求该格为空)
 * 用于把技能拖到用户指定的空格上
 * @returns 是否卸载成功
 */
const H_inventoryUnequipSkillToSlot = (inventory: PlayerInventory, slotIndex: number, bagSlot: number): boolean => {
  // 固有技能槽不可卸下
  if (!H_inventoryIsExtendedSkillSlot(slotIndex)) return false;
  if (bagSlot < 0 || bagSlot >= inventory.entries.length) return false;
  if (inventory.entries[bagSlot] !== null) return false;
  const tag = inventory.equippedSkills[slotIndex];
  if (tag === null) return false;
  const skill = H_getSkillByTag(tag);
  if (skill === null) return false;
  inventory.entries[bagSlot] = H_createSkillBagEntry(skill);
  inventory.equippedSkills[slotIndex] = null;
  return true;
};

/**
 * 交换/移动两个"拓展技能槽"(固有技能槽不参与)
 * @returns 是否发生了变化
 */
const H_inventoryMoveSkillSlot = (inventory: PlayerInventory, from: number, to: number): boolean => {
  if (from === to) return false;
  // 排序/移动只在"拓展技能槽"之间进行
  if (!H_inventoryIsExtendedSkillSlot(from) || !H_inventoryIsExtendedSkillSlot(to)) return false;
  const temp = inventory.equippedSkills[to];
  inventory.equippedSkills[to] = inventory.equippedSkills[from];
  inventory.equippedSkills[from] = temp;
  return true;
};

/**
 * 背包格之间的移动/交换/合并
 * - 目标格为空:直接移动
 * - 目标是同种物品且未满堆叠:合并堆叠
 * - 其余情况:两格交换
 * @returns 是否发生了变化
 */
const H_inventoryMoveEntry = (inventory: PlayerInventory, from: number, to: number): boolean => {
  if (from === to) return false;
  if (from < 0 || from >= inventory.entries.length) return false;
  if (to < 0 || to >= inventory.entries.length) return false;

  const fromEntry = inventory.entries[from];
  const toEntry = inventory.entries[to];
  if (fromEntry === null) return false;

  // 同种物品优先合并堆叠
  if (toEntry !== null && fromEntry.kind === 'item' && toEntry.kind === 'item' && fromEntry.tag === toEntry.tag) {
    const space = toEntry.maxStack - toEntry.count;
    if (space > 0) {
      const move = Math.min(space, fromEntry.count);
      toEntry.count += move;
      fromEntry.count -= move;
      if (fromEntry.count <= 0) inventory.entries[from] = null;
      return true;
    }
  }

  inventory.entries[to] = fromEntry;
  inventory.entries[from] = toEntry;
  return true;
};

/**
 * 销毁背包条目(按 uid 定位,整条移除)
 */
const H_inventoryDestroyEntry = (inventory: PlayerInventory, uid: string): boolean => {
  return H_inventoryRemoveEntry(inventory, uid, Infinity);
};

/**
 * 销毁指定背包格中的条目
 */
const H_inventoryDestroySlot = (inventory: PlayerInventory, slot: number): boolean => {
  return H_inventoryRemoveSlot(inventory, slot, Infinity);
};

/**
 * 销毁已装配的"拓展技能槽"技能(固有技能槽不可销毁)
 */
const H_inventoryDestroyEquipped = (inventory: PlayerInventory, slotIndex: number): boolean => {
  if (!H_inventoryIsExtendedSkillSlot(slotIndex)) return false;
  if (inventory.equippedSkills[slotIndex] === null) return false;
  inventory.equippedSkills[slotIndex] = null;
  return true;
};

export {
  INVENTORY_SKILL_SLOT_COUNT,
  INVENTORY_INNATE_SKILL_SLOT_COUNT,
  INVENTORY_EXTENDED_SKILL_SLOT_COUNT,
  H_inventoryIsInnateSkillSlot,
  H_inventoryIsExtendedSkillSlot,
  INVENTORY_ITEM_MAX_STACK,
  INVENTORY_BAG_CAPACITY,
  H_createInventoryUid,
  H_createEmptyPlayerInventory,
  H_normalizePlayerInventory,
  H_normalizeEquippedSkills,
  H_ensurePlayerInventory,
  H_inventoryGetEntryAtSlot,
  H_inventoryIndexOfUid,
  H_inventoryFindEntry,
  H_inventoryFirstEmptySlot,
  H_inventoryUsedSlotCount,
  H_inventoryHasSkill,
  H_inventoryCountItem,
  H_inventoryCanAcceptItem,
  H_inventoryAddSkill,
  H_inventoryAddItem,
  H_inventoryRemoveSlot,
  H_inventoryRemoveEntry,
  H_inventoryEquipSkill,
  H_inventoryAutoEquipSkill,
  H_inventoryUnequipSkill,
  H_inventoryUnequipSkillToSlot,
  H_inventoryMoveSkillSlot,
  H_inventoryMoveEntry,
  H_inventoryDestroyEntry,
  H_inventoryDestroySlot,
  H_inventoryDestroyEquipped
};
