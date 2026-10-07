package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.game.Skill;

/**
 * 经验球(由前端 TS 版 ExpOrbDynamicEntity 迁移)。
 *
 * <p><b>自身不寻找玩家</b>:只做"存在时长 + 惯性滑行";
 * 由 {@code World.updatePickups} 的"玩家主动搜索并吸取"逻辑牵引与吸收。</p>
 * <p>视觉尺寸随经验值档位变化,但碰撞体积固定。</p>
 */
public final class ExpOrbEntity extends DynamicEntity implements AbsorbableOrb {

    /** 统一物理碰撞体积 */
    public static final double WIDTH = 12;
    public static final double HEIGHT = 12;
    /** 吸引范围(px) */
    public static final double ATTRACT_RANGE = 180;
    /** 拾取范围(px) */
    public static final double PICKUP_RANGE = 22;
    /** 存在时长(秒) */
    public static final double LIFETIME = 30;
    /** 经验值档位(共 11 档,与《我的世界》一致) */
    public static final int[] VALUE_TIERS = {1, 3, 7, 17, 37, 73, 149, 307, 617, 1237, 2477};

    /** 内含经验值 */
    public int value;
    /** 已存活时间(秒) */
    public double age;
    /** 是否已被拾取(或超时消失) */
    public boolean isPickedUp;

    public ExpOrbEntity(Geometry.Vec2 position, int value) {
        super(position, WIDTH, HEIGHT, "经验球", "exp_orb", "exp_orb");
        this.value = Math.max(1, value);
        this.fillColor = "#67e87c";
        this.strokeColor = "#2ecc71";
        this.speed = 0;
        this.minMoveSpeed = 0;
        this.maxMoveSpeed = 0;
    }

    /** 经验球每帧更新:仅存在时长与惯性滑行(不再自行寻找玩家) */
    public void updateOrb(double dt) {
        if (isPickedUp) {
            return;
        }
        age += dt;
        if (age >= LIFETIME) {
            isPickedUp = true;// 超时消失
            return;
        }

        // 仅保留惯性滑行(死亡时随机爆出的冲量逐渐衰减)
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

    /** 拾取范围(px):经验球为点判定,与玩家体积无关 */
    @Override
    public double pickupRange(PlayerEntity player) {
        return PICKUP_RANGE;
    }

    /** 玩家当前能否接受本经验球(经验值恒可累加,始终可接受) */
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
        double speed = 140 + (1 - distance / ATTRACT_RANGE) * 360;
        position.x += dx / distance * speed * dt;
        position.y += dy / distance * speed * dt;
        updateCollisionBox();
    }

    /** 被玩家吸收:为玩家增加经验并标记为已拾取 */
    @Override
    public void absorbByPlayer(PlayerEntity player, Skill.Provider skills) {
        player.gainExp(value);
        isPickedUp = true;
    }

    /** 是否已被拾取(含超时消失) */
    @Override
    public boolean isAbsorbed() {
        return isPickedUp;
    }

    /** 按经验值拆分为若干经验球(贪心匹配档位,与《我的世界》一致) */
    public static java.util.List<Integer> splitExpValueIntoOrbs(double totalValue) {
        java.util.List<Integer> values = new java.util.ArrayList<>();
        double remaining = totalValue;
        while (remaining > 0) {
            boolean split = false;
            for (int tier : VALUE_TIERS) {
                if (remaining >= tier) {
                    values.add(tier);
                    remaining -= tier;
                    split = true;
                    break;
                }
            }
            if (!split) {
                break;
            }
        }
        return values;
    }
}
