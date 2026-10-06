package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;

import java.util.List;

/**
 * 子弹球(由前端 TS 版 BulletOrbDynamicEntity 迁移)。
 *
 * <p>与经验球 / 技能球同为"掉落物"型动态实体:</p>
 * <ul>
 *   <li>击杀"具备发射子弹能力"的 NPC(普通子弹 / 镭射子弹)时按概率掉落;</li>
 *   <li>会向附近的存活玩家飘行;被玩家拾取后补充玩家的当前子弹数;</li>
 *   <li>玩家子弹已达上限时无法拾取(子弹球留在原地);</li>
 *   <li>玩家剩余容量不足时只吸收一部分,剩余的子弹球继续留在地上;</li>
 *   <li>超过存在时长未被拾取则自动消失。</li>
 * </ul>
 */
public final class BulletOrbEntity extends DynamicEntity {

    /** 物理碰撞体积 */
    public static final double WIDTH = 10;
    public static final double HEIGHT = 10;
    /** 吸引范围(px) */
    public static final double ATTRACT_RANGE = 200;
    /** 拾取范围(px) */
    public static final double PICKUP_RANGE = 26;
    /** 存在时长(秒) */
    public static final double LIFETIME = 45;
    /** 单颗子弹球默认承载的子弹数 */
    public static final int DEFAULT_VALUE = 1;

    /** 主色(银色,与子弹外观一致) */
    public static final String MAIN_COLOR = "#c9d6e3";
    /** 辉光/高光色 */
    public static final String GLOW_COLOR = "#f2f7fc";
    /** 弹体暗部/描边色 */
    public static final String CORE_COLOR = "#5c6b7a";

    /** 承载的子弹数(大于 1 时拾取会被拆分) */
    public int value;
    /** 已存活时间(秒) */
    public double age;
    /** 是否已被拾取(或超时消失) */
    public boolean isPickedUp;

    public BulletOrbEntity(Geometry.Vec2 position, int value) {
        super(position, WIDTH, HEIGHT, "子弹球", "bullet_orb", "bullet_orb");
        this.value = Math.max(1, value);
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.speed = 0;
        this.minMoveSpeed = 0;
        this.maxMoveSpeed = 0;
    }

    /** 子弹球每帧更新:吸引 + 拾取(补充子弹) + 超时消失 */
    public void updateOrb(double dt, List<PlayerEntity> players) {
        if (isPickedUp) {
            return;
        }
        age += dt;
        if (age >= LIFETIME) {
            isPickedUp = true;// 超时消失
            return;
        }

        // 寻找最近的存活玩家
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
            // 向玩家飘行,距离越近速度越快
            double dirX = (nearestPlayer.position.x - position.x) / nearestDist;
            double dirY = (nearestPlayer.position.y - position.y) / nearestDist;
            double speed = 150 + (1 - nearestDist / ATTRACT_RANGE) * 380;
            position.x += dirX * speed * dt;
            position.y += dirY * speed * dt;
            updateCollisionBox();
        } else {
            // 无目标时使用空气阻力减速(掉落时的随机冲量逐渐衰减)
            applyAirResistance(dt);
            position.x += motionVelocity.x * dt;
            position.y += motionVelocity.y * dt;
            updateCollisionBox();
        }

        // 拾取判定:容量为 0 时不吸收(子弹球留在原地),容量不足时只吸收一部分
        if (nearestPlayer != null) {
            double d = Geometry.distance(position.x, position.y, nearestPlayer.position.x, nearestPlayer.position.y);
            if (d <= PICKUP_RANGE) {
                int accepted = nearestPlayer.addBulletCount(value);
                if (accepted >= value) {
                    isPickedUp = true;
                } else if (accepted > 0) {
                    value -= accepted;// 仅部分吸收,剩余部分继续留在地上
                }
            }
        }
    }
}
