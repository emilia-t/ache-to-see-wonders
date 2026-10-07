/**
 * NPC 刷怪等级概率表。
 *
 * 同一类 NPC 生成时按等级概率表随机等级,等级越高能力越强(见 NpcDynamicEntity.applyNpcLevel)。
 * - 等级上限为 5 的 NPC(白像素 / va2 / 金色闪避者 / 幽蓝孤光 ls1)使用 6 档概率表;
 * - 等级上限为 2 的 NPC(红像素 / 天蓝像素 / 紫盾 / 紫色烟花 oa18 / 珊瑚红触手 t1)使用 3 档概率表。
 *
 * 两表在各自的有效等级范围内合计均为 100%;若有效等级概率总和不足 100%
 * (例如上限被裁剪),则按有效等级重新归一化。
 *
 * 对应 Java 侧:java/.../game/NpcLevelTable.java(需保持一致)
 */

/** 等级上限为 5 的 NPC 的等级概率(Level 0~5) */
export const NPC_LEVEL_WEIGHTS_MAX5: readonly number[] = [0.45, 0.25, 0.15, 0.08, 0.05, 0.02];

/** 等级上限为 2 的 NPC 的等级概率(Level 0~2) */
export const NPC_LEVEL_WEIGHTS_MAX2: readonly number[] = [0.65, 0.25, 0.1];

/**
 * 随机抽取一个 NPC 等级。
 * @param maxLevel 该 NPC 的等级上限(>= 5 使用 6 档表,否则使用 3 档表)
 * @returns 抽中的等级(0 ~ maxLevel)
 */
export const H_rollNpcLevel = (maxLevel: number): number => {
  const table = maxLevel >= 5 ? NPC_LEVEL_WEIGHTS_MAX5 : NPC_LEVEL_WEIGHTS_MAX2;
  const effectiveCount = Math.max(1, Math.min(table.length, Math.floor(maxLevel) + 1));
  const effective = table.slice(0, effectiveCount);
  const total = effective.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) return 0;

  let random = Math.random() * total;
  for (let i = 0; i < effective.length; i++) {
    if (random < effective[i]) return i;
    random -= effective[i];
  }
  return effective.length - 1;
};
