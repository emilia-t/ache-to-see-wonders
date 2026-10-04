package top.atsw.pixelwar.game;

/**
 * NPC 刷怪等级概率表。
 *
 * <p>同一类 NPC 生成时按等级概率表随机等级,等级越高能力越强(见
 * {@link top.atsw.pixelwar.entity.dynamicEntity.npc.NpcEntity#applyNpcLevel(int)})。</p>
 * <ul>
 *   <li>等级上限为 5 的 NPC(白像素 / va2 / 金色闪避者)使用 6 档概率表;</li>
 *   <li>等级上限为 2 的 NPC(红像素 / 天蓝像素 / 紫盾 / 紫色烟花 oa18)使用 3 档概率表。</li>
 * </ul>
 *
 * <p>两表在各自的有效等级范围内合计均为 100%;若有效等级概率总和不足 100%
 * (例如上限被裁剪),则按有效等级重新归一化。</p>
 *
 * <p>与 TS 侧 registry/NpcLevelTable.ts 保持一致。</p>
 */
public final class NpcLevelTable {

    private NpcLevelTable() {
    }

    /** 等级上限为 5 的 NPC 的等级概率(Level 0~5) */
    public static final double[] WEIGHTS_MAX5 = {0.45, 0.25, 0.15, 0.08, 0.05, 0.02};

    /** 等级上限为 2 的 NPC 的等级概率(Level 0~2) */
    public static final double[] WEIGHTS_MAX2 = {0.65, 0.25, 0.10};

    /**
     * 随机抽取一个 NPC 等级。
     *
     * @param maxLevel 该 NPC 的等级上限(≥ 5 使用 6 档表,否则使用 3 档表)
     * @return 抽中的等级(0 ~ maxLevel)
     */
    public static int rollLevel(int maxLevel) {
        double[] table = maxLevel >= 5 ? WEIGHTS_MAX5 : WEIGHTS_MAX2;
        int effectiveCount = Math.max(1, Math.min(table.length, maxLevel + 1));
        double total = 0;
        for (int i = 0; i < effectiveCount; i++) {
            total += table[i];
        }
        if (!(total > 0)) {
            return 0;
        }
        double random = Math.random() * total;
        for (int i = 0; i < effectiveCount; i++) {
            if (random < table[i]) {
                return i;
            }
            random -= table[i];
        }
        return effectiveCount - 1;
    }
}
