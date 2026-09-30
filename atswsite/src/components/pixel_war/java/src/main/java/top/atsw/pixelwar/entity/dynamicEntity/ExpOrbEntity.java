package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;

import java.util.List;

/**
 * 经验球(由前端 TS 版 ExpOrbDynamicEntity 迁移)。
 *
 * <p>会向附近的存活玩家飘行,被拾取后为玩家增加游戏经验;超过存在时长自动消失。
 * 视觉尺寸随经验值档位变化,但碰撞体积固定。</p>
 */
public final class ExpOrbEntity extends DynamicEntity {

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

    /** 经验球每帧更新:吸引 + 拾取 + 超时消失 */
    public void updateOrb(double dt, List<PlayerEntity> players) {
        if (isPickedUp) {
            return;
        }
        age += dt;
        if (age >= LIFETIME) {
            isPickedUp = true;
            return;
        }

        PlayerEntity nearestPlayer = null;
        double nearestDist = Double.MAX_VALUE;
        for (PlayerEntity player : players) {
            if (player.isDead) {
                continue;
            }
            double d = Geometry.distance(position.x, position.y, player.position.x, player.position.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearestPlayer = player;
            }
        }

        if (nearestPlayer != null && nearestDist <= ATTRACT_RANGE && nearestDist > 0.0001) {
            double dirX = (nearestPlayer.position.x - position.x) / nearestDist;
            double dirY = (nearestPlayer.position.y - position.y) / nearestDist;
            double speed = 140 + (1 - nearestDist / ATTRACT_RANGE) * 360;
            position.x += dirX * speed * dt;
            position.y += dirY * speed * dt;
            updateCollisionBox();
        } else {
            applyAirResistance(dt);
            position.x += motionVelocity.x * dt;
            position.y += motionVelocity.y * dt;
            updateCollisionBox();
        }

        if (nearestPlayer != null) {
            double d = Geometry.distance(position.x, position.y, nearestPlayer.position.x, nearestPlayer.position.y);
            if (d <= PICKUP_RANGE) {
                nearestPlayer.gainExp(value);
                isPickedUp = true;
            }
        }
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
