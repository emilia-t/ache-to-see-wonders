package top.atsw.pixelwar.game;

import java.util.ArrayList;
import java.util.List;

/**
 * 专研(Research)系统 —— 面向玩家的自我提升天赋系统。
 *
 * <p>玩家每次升级时按概率触发专研界面,从随机三个研究项中选择一项进行研究。</p>
 * <ul>
 *   <li>普通研究项(蓝色):总体出现概率 90%,5 个子项均摊;</li>
 *   <li>传说研究项(金色):总体出现概率 10%,3 个子项均摊。</li>
 * </ul>
 *
 * <p>本类只定义研究项本身(标签/名称/类别/权重/上限/说明)与抽取、查询等纯函数;
 * 玩家身上的研究状态与效果结算见 {@link top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity}。</p>
 *
 * <p>与 TS 侧 class/Research/Research.ts 保持定义与权重一致。</p>
 */
public final class Research {

    private Research() {
    }

    // ==================================================================
    // 数值常量(与 TS class/Research/Research.ts 保持一致)
    // ==================================================================

    /** 移速:每级提升的移动速度百分比 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 0.06;
    /** 射速:每级提升的开火速度百分比 */
    public static final double FIRE_RATE_BONUS_PER_LEVEL = 0.08;
    /** 冷却:每级减少的技能冷却百分比 */
    public static final double COOLDOWN_REDUCTION_PER_LEVEL = 0.05;
    /** 冷却:冷却减少的最大叠加上限(50%) */
    public static final double COOLDOWN_REDUCTION_MAX = 0.5;
    /** 体力:每级提升的体力上限(具体数值) */
    public static final double STAMINA_MAX_BONUS_PER_LEVEL = 15;
    /** 体力:每级降低的疾跑体力消耗(具体数值,点/秒) */
    public static final double STAMINA_DRAIN_REDUCTION_PER_LEVEL = 2;
    /** 体力:疾跑体力消耗的下限(点/秒) */
    public static final double STAMINA_DRAIN_MIN = 6;
    /** 生命:每级提升的生命上限(具体数值) */
    public static final double HEALTH_MAX_BONUS_PER_LEVEL = 2;
    /** 死亡不掉落:每级增加的保护概率 */
    public static final double DEATH_KEEP_CHANCE_PER_LEVEL = 0.2;
    /** 不动堡垒:每级增加的最大吸收值 */
    public static final double FORTRESS_ABSORB_PER_LEVEL = 100;
    /** 幸运之星:每级增加的战利品掉落概率 */
    public static final double LUCKY_STAR_BONUS_PER_LEVEL = 0.05;

    /** 抽取时一次给出的研究项数量 */
    public static final int OPTION_COUNT = 3;

    private static final double NORMAL_WEIGHT = 0.9 / 5;
    private static final double LEGENDARY_WEIGHT = 0.1 / 3;

    /** 研究项类别 */
    public enum Category {
        /** 普通(蓝色) */
        NORMAL,
        /** 传说(金色) */
        LEGENDARY
    }

    /**
     * 玩家持有的一个研究项记录(可变)。
     * {@code value} 仅"不动堡垒"用于记录剩余吸收值,其余恒为 0。
     */
    public static final class State {
        public String tag;
        public int level;
        public double value;

        public State(String tag, int level, double value) {
            this.tag = tag;
            this.level = level;
            this.value = value;
        }
    }

    /** 研究项定义 */
    public record Definition(String tag, String name, Category category, double weight, Integer maxLevel,
                             String description) {
    }

    private static final List<Definition> DEFINITIONS = List.of(
            new Definition("move_speed", "移速", Category.NORMAL, NORMAL_WEIGHT, null,
                    "提升玩家移动速度"),
            new Definition("fire_rate", "射速", Category.NORMAL, NORMAL_WEIGHT, null,
                    "提升普通子弹射速(从者子弹射速同步受玩家影响)"),
            new Definition("cooldown", "冷却", Category.NORMAL, NORMAL_WEIGHT, null,
                    "减少玩家技能(含固有技能)的冷却时间,最大叠加至 50%"),
            new Definition("stamina", "体力", Category.NORMAL, NORMAL_WEIGHT, null,
                    "提升体力上限并降低疾跑体力消耗速度"),
            new Definition("health", "生命", Category.NORMAL, NORMAL_WEIGHT, null,
                    "提升玩家生命上限"),
            new Definition("death_keep", "死亡不掉落", Category.LEGENDARY, LEGENDARY_WEIGHT, 5,
                    "死亡时保护背包内的部分物品与技能不掉落,每次死亡降低 1 级"),
            new Definition("immovable_fortress", "不动堡垒", Category.LEGENDARY, LEGENDARY_WEIGHT, 5,
                    "保持不动时持续吸收受到的伤害,吸收耗尽后降级"),
            new Definition("lucky_star", "幸运之星", Category.LEGENDARY, LEGENDARY_WEIGHT, 5,
                    "提升击败敌方 NPC 时战利品的掉落概率"));

    /** 按标签查询研究项定义,未登记返回 null */
    public static Definition byTag(String tag) {
        for (Definition definition : DEFINITIONS) {
            if (definition.tag().equals(tag)) {
                return definition;
            }
        }
        return null;
    }

    /** 查询玩家身上某个研究项的等级,未研究时返回 0 */
    public static int getLevel(List<State> states, String tag) {
        State state = getState(states, tag);
        return state == null ? 0 : Math.max(0, state.level);
    }

    /** 查询玩家身上某个研究项的记录,未研究时返回 null */
    public static State getState(List<State> states, String tag) {
        if (states == null) {
            return null;
        }
        for (State state : states) {
            if (state.tag.equals(tag)) {
                return state;
            }
        }
        return null;
    }

    /** 是否已叠满(无上限的研究项恒为 false) */
    public static boolean isMaxed(List<State> states, String tag) {
        Definition definition = byTag(tag);
        if (definition == null || definition.maxLevel() == null) {
            return false;
        }
        return getLevel(states, tag) >= definition.maxLevel();
    }

    /**
     * 计算升级触发专研的概率: p = (64 - 等级) / 100,最低 5%。
     */
    public static double triggerProbability(int level) {
        return Math.max(0.05, (64 - level) / 100.0);
    }

    /**
     * 随机抽取若干互不相同的可研究项(按权重;已叠满项不进入候选池)。
     *
     * @param states 玩家已有研究记录
     * @param count  期望抽取数量
     */
    public static List<String> rollOptions(List<State> states, int count) {
        List<Definition> remaining = new ArrayList<>();
        for (Definition definition : DEFINITIONS) {
            if (!isMaxed(states, definition.tag())) {
                remaining.add(definition);
            }
        }
        List<String> result = new ArrayList<>();
        while (result.size() < count && !remaining.isEmpty()) {
            double totalWeight = 0;
            for (Definition definition : remaining) {
                totalWeight += Math.max(0, definition.weight());
            }
            if (totalWeight <= 0) {
                break;
            }
            double random = Math.random() * totalWeight;
            int picked = remaining.size() - 1;
            for (int i = 0; i < remaining.size(); i++) {
                random -= Math.max(0, remaining.get(i).weight());
                if (random < 0) {
                    picked = i;
                    break;
                }
            }
            result.add(remaining.remove(picked).tag());
        }
        return result;
    }
}
