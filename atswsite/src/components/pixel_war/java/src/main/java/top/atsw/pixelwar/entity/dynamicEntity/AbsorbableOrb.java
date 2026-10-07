package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.game.Skill;

/**
 * 掉落物 Orb(经验球 / 技能球 / 子弹球)的公共能力。
 *
 * <p>三者在 TS 侧是同一个联合类型,Java 侧用本接口统一表达:都由「玩家主动搜索并吸取」的
 * 权威端逻辑({@code World.updatePickups})按同一套流程处理。
 *
 * <p><b>③ 统一</b>:地面物品 {@code ItemEntity} 也实现本接口 —— 它吸引范围为 0(不磁吸),
 * 只在「接触半径」内被拾取,因此可复用同一条拾取管线。</p>
 *
 * <p><b>设计要点</b>:Orb 自身不再寻找玩家(旧实现里每个 Orb 每帧都会找最近的玩家飘行),
 * 改为由玩家侧发起搜索。因此"玩家装不下某个 Orb"(例如子弹球的玩家子弹已满)只需让
 * {@link #canBeAbsorbedBy} 返回 false,该玩家便会跳过它。</p>
 */
public interface AbsorbableOrb {

    /** 玩家当前能否接受本 Orb(子弹球在玩家子弹已满时返回 false) */
    boolean canBeAbsorbedBy(PlayerEntity player);

    /** 吸取范围(px):玩家在此范围内会主动牵引本 Orb */
    double absorbRange();

    /**
     * 拾取范围(px):进入该距离即被玩家吸收。
     *
     * <p>可依赖玩家体积 —— 物品用两者半宽之和作为「接触半径」;
     * 经验/技能/子弹球为点判定,与玩家体积无关。</p>
     */
    double pickupRange(PlayerEntity player);

    /** 被玩家牵引一帧(朝玩家飘行,距离越近速度越快) */
    void attractTowardPlayer(PlayerEntity player, double dt);

    /** 被玩家吸收(子弹球容量不足时只吸收一部分);skills 供技能球授予技能使用 */
    void absorbByPlayer(PlayerEntity player, Skill.Provider skills);

    /** 是否已被拾取(含超时消失) */
    boolean isAbsorbed();
}
