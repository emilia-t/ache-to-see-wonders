package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;

/**
 * 普通子弹(由前端 TS 版 BulletDynamicEntity + OrdinaryBulletDynamicEntity 迁移)。
 *
 * <p>子弹沿固定速度直线飞行,撞墙或超过存活时间后标记移除;
 * 与动态实体的命中判定由世界模块统一处理(空间哈希加速)。</p>
 *
 * <p>激光弹({@link LaserBulletEntity})作为子类复用同一套字段与列表,但其 tag 为
 * {@code laser_bullet} 且几何形状为"线段",命中判定走独立分支。</p>
 */
public class BulletEntity extends DynamicEntity {

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
    /**
     * 命中目标后是否立即消失。
     * 普通子弹为 true;穿甲弹({@link PiercingBulletEntity})覆写为 false。
     */
    public boolean piercesTargets = false;
    /** 本发子弹已伤害过的目标 id(仅穿甲类子弹使用) */
    protected java.util.Set<Long> hitTargetIds = null;
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
        this(position, direction, ownerId, teamId, name, bulletColor, moveSpeed, "ordinary_bullet");
    }

    /**
     * 构造一颗带指定类型标签的子弹(供激光弹等子类复用)。
     *
     * @param tag 子弹类型标签('ordinary_bullet' / 'laser_bullet' ...),随快照下发给客户端
     */
    protected BulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction, Long ownerId, Long teamId,
                           String name, String bulletColor, double moveSpeed, String tag) {
        super(position, WIDTH, HEIGHT, name == null ? "" : name, "bullet", tag);
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

        if (collidesWithStatic(nextPos, world)) {
            onStaticCollision(nextPos, world);
            return;
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

    /** 位置 {@code pos} 是否与任意静态实体(AABB)相交(子类如跳弹需要分轴复用,故为 protected) */
    protected boolean collidesWithStatic(Geometry.Vec2 pos, WorldView world) {
        double halfW = width / 2;
        double halfH = height / 2;
        double minX = pos.x - halfW;
        double maxX = pos.x + halfW;
        double minY = pos.y - halfH;
        double maxY = pos.y + halfH;
        for (StaticEntity staticEntity : world.staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            Geometry.Box box = staticEntity.collisionBox;
            boolean separated = maxX <= box.x || minX >= box.maxX() || maxY <= box.y || minY >= box.maxY();
            if (!separated) {
                return true;
            }
        }
        return false;
    }

    /**
     * 撞到静态实体时的处理。默认标记移除;跳弹类覆写为「反弹」。
     *
     * @param nextPos 本帧将要到达的位置(已确认与静态实体相交)
     * @param world   世界视图(供子类分轴复检)
     */
    protected void onStaticCollision(Geometry.Vec2 nextPos, WorldView world) {
        shouldRemove = true;
    }

    /** 该目标是否已被本发子弹伤害过(普通子弹恒为 false) */
    public boolean hasDamagedTarget(long targetId) {
        return hitTargetIds != null && hitTargetIds.contains(targetId);
    }

    /** 记录本发子弹已伤害某目标(仅穿甲类子弹会真正记录) */
    public void markDamagedTarget(long targetId) {
        if (!piercesTargets) {
            return;
        }
        if (hitTargetIds == null) {
            hitTargetIds = new java.util.HashSet<>();
        }
        hitTargetIds.add(targetId);
    }
}
