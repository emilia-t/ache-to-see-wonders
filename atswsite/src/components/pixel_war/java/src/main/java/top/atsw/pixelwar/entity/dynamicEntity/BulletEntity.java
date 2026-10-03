package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;

/**
 * 普通子弹(由前端 TS 版 BulletDynamicEntity + OrdinaryBulletDynamicEntity 迁移)。
 *
 * <p>子弹沿固定速度直线飞行,撞墙或超过存活时间后标记移除;
 * 与动态实体的命中判定由世界模块统一处理(空间哈希加速)。</p>
 */
public final class BulletEntity extends DynamicEntity {

    public static final double WIDTH = 8;
    public static final double HEIGHT = 8;
    /** 子弹速度(px/s) */
    //public static final double MOVE_SPEED = 780;
    public static final double MOVE_SPEED = 320;
    /** 默认伤害 */
    public static final double DEFAULT_DAMAGE = 1;
    /** 最大存在时间(秒) */
    //public static final double MAX_LIFETIME = 1.8;
    public static final double MAX_LIFETIME = 5.6;

    public final Geometry.Vec2 velocity;
    public Long ownerId;
    public Long teamId;
    public boolean shouldRemove;
    public double damage;
    public String bulletColor;
    /** 射程类型:'short' | 'long' */
    public String rangeType;
    private double lifetimeRemaining = MAX_LIFETIME;

    public BulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction, Long ownerId, Long teamId,
                        String name, String bulletColor) {
        this(position, direction, ownerId, teamId, name, bulletColor, MOVE_SPEED);
    }

    /**
     * 构造一颗子弹,可自定义子弹速度。
     *
     * @param moveSpeed 子弹速度(px/s);用于 NPC 等级加成等场景,非法值回退到 {@link #MOVE_SPEED}
     */
    public BulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction, Long ownerId, Long teamId,
                        String name, String bulletColor, double moveSpeed) {
        super(position, WIDTH, HEIGHT, name == null ? "" : name, "bullet", "ordinary_bullet");
        this.rangeType = "short";
        this.fillColor = "#ffd84d";
        double speedValue = (Double.isFinite(moveSpeed) && moveSpeed > 0) ? moveSpeed : MOVE_SPEED;
        this.minMoveSpeed = speedValue;
        this.maxMoveSpeed = speedValue;
        this.speed = speedValue;
        this.wanderRange = 0;
        this.perceptionRange = 0;
        this.health = 1;
        this.healthMax = 1;
        this.movementPassion = 1;
        double len = Math.hypot(direction.x, direction.y);
        double dirX = len < 0.0001 ? 1 : direction.x / len;
        double dirY = len < 0.0001 ? 0 : direction.y / len;
        this.velocity = new Geometry.Vec2(dirX * speedValue, dirY * speedValue);
        this.ownerId = ownerId;
        this.teamId = teamId;
        this.isMoving = true;
        this.facingDirection = new Geometry.Vec2(dirX, dirY);
        this.lastMoveDirection = facingDirection.copy();
        this.damage = DEFAULT_DAMAGE;
        this.bulletColor = (bulletColor == null || bulletColor.isEmpty())
                ? "rgba(255, 255, 50, 0.9)" : bulletColor;
    }

    /** 子弹每帧推进:撞墙或寿命耗尽即标记移除 */
    public void updateBullet(double dt, WorldView world) {
        if (shouldRemove) {
            return;
        }
        lifetimeRemaining = Math.max(0, lifetimeRemaining - dt);
        if (lifetimeRemaining <= 0) {
            shouldRemove = true;
            return;
        }

        Geometry.Vec2 nextPos = new Geometry.Vec2(
                position.x + velocity.x * dt,
                position.y + velocity.y * dt);

        double halfW = width / 2;
        double halfH = height / 2;
        double minX = nextPos.x - halfW;
        double maxX = nextPos.x + halfW;
        double minY = nextPos.y - halfH;
        double maxY = nextPos.y + halfH;
        for (StaticEntity staticEntity : world.staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            Geometry.Box box = staticEntity.collisionBox;
            boolean separated = maxX <= box.x || minX >= box.maxX() || maxY <= box.y || minY >= box.maxY();
            if (!separated) {
                shouldRemove = true;
                return;
            }
        }

        position.set(nextPos);
        updateCollisionBox();
        nextTarget = position.copy();
        targetHistory = new java.util.ArrayList<>(java.util.List.of(position.copy()));
        curvePoints = new java.util.ArrayList<>(java.util.List.of(position.copy()));
        currentCurveIndex = 0;
        lastStuckCheckPos = position.copy();
        noMoveLastPos = position.copy();
    }
}
