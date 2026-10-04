/**
 * 伤害来源解析(用于死亡界面提示「你被 xxx 击倒了」)。
 *
 * <p>子弹 / 炸弹等投射物只携带「造成伤害的实体 id」(ownerId),这里把它换算成可展示的名称:</p>
 * <ul>
 *   <li>玩家 → 玩家名;</li>
 *   <li>玩家的从者 NPC → 该从者所属玩家名;</li>
 *   <li>无主 NPC → 该 NPC 类型的显示名称(各 NPC 的静态 NAME,例如「红色像素」)。</li>
 * </ul>
 *
 * <p>本模块不依赖任何实体类(只用结构类型),因此既可以被 Worker(Service.ts)调用,
 * 也可以被投射物实体(如 RedPixelBombEntity)调用,不会引入循环依赖。</p>
 */

/** 参与伤害来源解析的最小实体结构 */
type DamageSourceEntity = {
  id: number;
  name?: string;
  ownerId?: number | null;
  getDisplayName?: () => string;
};

/** 参与伤害来源解析的动态实体列表(结构兼容 DynamicEntitieList) */
export type DamageSourceEntityList = {
  playerDynamicEntitys?: DamageSourceEntity[];
  npcDynamicEntitys?: DamageSourceEntity[];
};

/** 无法识别伤害来源时的兜底显示名(供 UI 展示,例如死亡界面) */
export const DAMAGE_SOURCE_UNKNOWN_NAME = '未知';

/**
 * 把「造成伤害的实体 id」解析为死亡界面要展示的名称。
 *
 * @param dynamicEntitie 当前世界中的动态实体列表(玩家 / NPC)
 * @param sourceEntityId 造成伤害的实体 id(子弹或炸弹的 ownerId)
 * @returns 展示名称;来源为空或无法解析时返回空串(由调用方决定兜底文案)
 */
export const H_resolveDamagerName = (
  dynamicEntitie: DamageSourceEntityList | null | undefined,
  sourceEntityId: number | null | undefined
): string => {
  if (sourceEntityId === null || sourceEntityId === undefined) return '';
  const playerList = dynamicEntitie?.playerDynamicEntitys ?? [];
  const npcList = dynamicEntitie?.npcDynamicEntitys ?? [];

  // 直接由玩家造成
  const player = playerList.find((item) => item.id === sourceEntityId);
  if (player) return player.name || '';

  const npc = npcList.find((item) => item.id === sourceEntityId);
  if (npc) {
    // 玩家的从者 NPC:记为从者所属玩家
    if (npc.ownerId !== null && npc.ownerId !== undefined) {
      const owner = playerList.find((item) => item.id === npc.ownerId);
      if (owner) return owner.name || '';
    }
    // 无主 NPC:使用其类型显示名称(静态 NAME)
    const displayName = npc.getDisplayName?.();
    if (displayName) return displayName;
    return npc.name || '';
  }
  return '';
};
