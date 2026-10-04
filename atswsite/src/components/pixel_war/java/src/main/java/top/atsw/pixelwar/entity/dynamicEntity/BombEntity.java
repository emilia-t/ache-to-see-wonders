package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;

/**
 * 红像素自毁炸弹(由前端 TS 版 class/Entity/DynamicEntity/GrenadeDynamicEntity/RedPixelBombEntity 迁移)。
 *
 * <p>短暂延迟后对范围内所有动态实体造成伤害;炸弹不移动、不可被击中。</p>
 */
public final class BombEntity extends DynamicEntity {

    public static final double WIDTH = 10;
    public static final double HEIGHT = 10;
    /** 默认引爆延迟(秒) */
    public static final double DEFAULT_COUNTDOWN = 0.5;
    /** 默认爆炸半径(px) */
    public static final double DEFAULT_RADIUS = 80;
    /** 默认爆炸伤害 */
    public static final double DEFAULT_DAMAGE = 1;

    public double countdown;
    public double explosionRadius;
    public double explosionDamage;
    public Long ownerId;
    public Long teamId;
    /**
     * 生成者的显示名称(兜底用)。
     *
     * <p>红像素引爆时自身会立刻被清理,等到炸弹爆炸时按 ownerId 已查不到生成者,
     * 因此生成时把名称记录下来,保证死亡界面仍能显示「你被 红色像素 击倒了」。</p>
     */
    public String damageSourceName = "";

    public BombEntity(Geometry.Vec2 position, Long ownerId, Long teamId) {
        this(position, ownerId, teamId, DEFAULT_COUNTDOWN, DEFAULT_RADIUS, DEFAULT_DAMAGE);
    }

    public BombEntity(Geometry.Vec2 position, Long ownerId, Long teamId,
                      double countdown, double explosionRadius, double explosionDamage) {
        super(position, WIDTH, HEIGHT, "", "grenade", "red_pixel_bomb");
        this.countdown = countdown;
        this.explosionRadius = explosionRadius;
        this.explosionDamage = explosionDamage;
        this.ownerId = ownerId;
        this.teamId = teamId;
        this.isMoving = false;
        this.health = 1;
        this.healthMax = 1;
        this.speed = 0;
        this.minMoveSpeed = 0;
        this.maxMoveSpeed = 0;
    }

    /** 倒计时推进,返回 true 表示本帧引爆 */
    public boolean updateBomb(double dt) {
        if (isDead) {
            return false;
        }
        countdown -= dt;
        return countdown <= 0;
    }

    /** 爆炸计时进度(0 → 1),供客户端绘制预警 */
    public double fuseRatio() {
        double total = DEFAULT_COUNTDOWN;
        if (total <= 0) {
            return 1;
        }
        return Geometry.clamp(1 - countdown / total, 0, 1);
    }
}
