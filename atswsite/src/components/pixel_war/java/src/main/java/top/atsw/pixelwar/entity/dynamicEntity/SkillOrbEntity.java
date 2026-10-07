package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.game.Skill;

/**
 * 技能球(由前端 TS 版 SkillOrbDynamicEntity 迁移)。
 *
 * <p>击杀携带 loot 配置的 NPC 时按概率掉落;<b>自身不寻找玩家</b>,
 * 由 {@code World.updatePickups} 的"玩家主动搜索并吸取"逻辑牵引与吸收;
 * 超时未被吸取则自动消失。</p>
 */
public final class SkillOrbEntity extends DynamicEntity implements AbsorbableOrb {

    /** 物理碰撞体积 */
    public static final double WIDTH = 14;
    public static final double HEIGHT = 14;
    /**
     * 吸引范围(px)。
     *
     * <p>必须小于"背包拖拽丢弃"的最小抛出距离(80px):否则丢弃出去的技能球会立刻被玩家吸回来。</p>
     */
    public static final double ATTRACT_RANGE = 70;
    /** 拾取范围(px) */
    public static final double PICKUP_RANGE = 26;
    /** 存在时长(秒) */
    public static final double LIFETIME = 45;
    /** 技能未注册时的兜底颜色 */
    public static final String FALLBACK_COLOR = "#9fe8ff";

    /** 技能标签(如 va2_shoot_skill) */
    public String skillTag;
    /** 已存活时间(秒) */
    public double age;
    /** 是否已被拾取(或超时消失) */
    public boolean isPickedUp;

    public SkillOrbEntity(Geometry.Vec2 position, String skillTag, Skill.Provider skills) {
        super(position, WIDTH, HEIGHT, "技能球", "skill_orb", "skill_orb");
        this.skillTag = skillTag;
        this.fillColor = color(skills);
        this.strokeColor = this.fillColor;
        this.speed = 0;
        this.minMoveSpeed = 0;
        this.maxMoveSpeed = 0;
    }

    /** 技能主题色(技能未注册时使用兜底色) */
    public String color(Skill.Provider skills) {
        Skill skill = skills == null ? null : skills.byTag(skillTag);
        return skill == null ? FALLBACK_COLOR : skill.color();
    }

    /** 技能球每帧更新:仅存在时长与惯性滑行(不再自行寻找玩家) */
    public void updateOrb(double dt) {
        if (isPickedUp) {
            return;
        }
        age += dt;
        if (age >= LIFETIME) {
            isPickedUp = true;// 超时消失
            return;
        }

        // 仅保留惯性滑行(爆出/丢弃时的冲量逐渐衰减)
        applyAirResistance(dt);
        position.x += motionVelocity.x * dt;
        position.y += motionVelocity.y * dt;
        updateCollisionBox();
    }

    // ==================================================================
    // 被玩家主动吸取(由 World.updatePickups 调用)
    // ==================================================================

    /** 吸取范围(px) */
    @Override
    public double absorbRange() {
        return ATTRACT_RANGE;
    }

    /** 拾取范围(px):技能球为点判定,与玩家体积无关 */
    @Override
    public double pickupRange(PlayerEntity player) {
        return PICKUP_RANGE;
    }

    /** 玩家当前能否接受本技能球(技能可重复获取,始终可接受) */
    @Override
    public boolean canBeAbsorbedBy(PlayerEntity player) {
        return true;
    }

    /** 被玩家牵引一帧:朝玩家飘行,距离越近速度越快 */
    @Override
    public void attractTowardPlayer(PlayerEntity player, double dt) {
        if (isPickedUp) {
            return;
        }
        double dx = player.position.x - position.x;
        double dy = player.position.y - position.y;
        double distance = Math.hypot(dx, dy);
        if (distance <= 0.0001) {
            return;
        }
        double speed = 150 + (1 - distance / ATTRACT_RANGE) * 380;
        position.x += dx / distance * speed * dt;
        position.y += dy / distance * speed * dt;
        updateCollisionBox();
    }

    /** 被玩家吸收:玩家获得对应技能并标记为已拾取 */
    @Override
    public void absorbByPlayer(PlayerEntity player, Skill.Provider skills) {
        // 已持有相同技能时也直接消耗技能球,避免地面堆积重复技能球
        player.acquireSkill(skillTag, skills);
        isPickedUp = true;
    }

    /** 是否已被拾取(含超时消失) */
    @Override
    public boolean isAbsorbed() {
        return isPickedUp;
    }
}
