package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;

/**
 * 激光弹(线段型子弹,与 TS 版 LaserBulletDynamicEntity 对齐)。
 *
 * <p>发射后从射击起点沿射击方向生成一道具有伤害的激光线段。线段本身不自行飞行,
 * 而是由"激光前端"沿射击方向以展开速度延伸,
 * 展开时间 = 激光长度 ÷ 展开速度。线段会被围墙截断(前端碰到围墙即停止延伸)。</p>
 *
 * <p>激光会跟随发射者(野生 NPC / 玩家 / 玩家的从者 NPC)同步移动:世界每帧按发射者的
 * 位移增量平移整条线段,方向与长度保持不变(见 {@link #followShooter})。</p>
 *
 * <p>生命周期分为 5 个阶段:起点发光/展开 → 渐亮(0.1s) → 持续发光(duration_tick × 20ms)
 * → 渐暗消失(0.1s);客户端据此自行还原动画,服务端只下发少量动态字段。</p>
 *
 * <p>命中判定与伤害由 {@code World.updateBullets} 处理:目标碰到线段即受伤,
 * 首次接触立刻造成 1 次基础伤害,持续接触每累计 20 tick 再造成 基础伤害 × 2,
 * 离开线段后计时重置。</p>
 */
public class LaserBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "laser_bullet";

    /** 激光长度下限(px) */
    public static final double MIN_LENGTH = 500;
    /** 默认最大长度(px) */
    public static final double DEFAULT_LENGTH = 1200;
    /** 默认展开速度(px/s) */
    public static final double DEFAULT_EXPAND_SPEED = 6000;
    /** 默认持续发光时长(tick) */
    public static final int DEFAULT_DURATION_TICKS = 50;
    /** 单个游戏刻的秒数(1 tick = 20ms) */
    public static final double TICK_SECONDS = 0.02;
    /** 阶段 2 渐亮时长(秒) */
    public static final double FADE_IN_SECONDS = 0.1;
    /** 阶段 4 渐暗时长(秒) */
    public static final double FADE_OUT_SECONDS = 0.1;
    /** 尾部衰减长度(px) */
    public static final double TAIL_FADE_LENGTH = 100;
    /** 光束判定半宽(px) */
    public static final double HIT_HALF_WIDTH = 4;
    /** 持续接触结算间隔(tick) */
    public static final int CONTACT_TICK_INTERVAL = 20;
    /** 持续伤害倍率 */
    public static final double CONTACT_DAMAGE_MULTIPLIER = 2;

    /** 默认激光主色 */
    public static final String DEFAULT_LASER_COLOR = "#C2F0FF";
    /** 默认激光辉光色 */
    public static final String DEFAULT_LASER_GLOW_COLOR = "#E6F6FA";

    /** 激光最大长度(px,已按围墙截断) */
    public double laserMaxLength;
    /** 激光前端展开速度(px/s) */
    public double laserExpandSpeed;
    /** 阶段 3 持续发光时长(秒) */
    public double laserHoldSeconds;
    /** 已存在时长(秒) */
    public double laserElapsed;
    /** 辉光色 */
    public String laserGlowColor;
    /**
     * 发射者上一帧的位置(玩家与 NPC 发射时都会写入)。
     *
     * <p>世界据此计算发射者的位移增量,让激光跟随发射者同步移动(见 {@link #followShooter})。
     * 该字段只在权威端使用,不随快照下发。</p>
     */
    public Geometry.Vec2 laserShooterPosition;
    /** 发射时配置的原始激光长度(px,未按围墙截断):移动后重新截断时以其为上限 */
    private final double laserConfiguredLength;
    /** 上一次按围墙截断长度时激光所处的位置(位置未变化则无需重复射线检测) */
    private Geometry.Vec2 laserClampOrigin;

    /**
     * 构造一束激光。
     *
     * @param length        激光最大长度(px),小于 {@link #MIN_LENGTH} 时按下限取值
     * @param expandSpeed   前端展开速度(px/s),非法值回退默认
     * @param durationTicks 持续发光时长(tick),不大于 0 时回退默认
     * @param damage        基础伤害,非法值回退默认
     * @param glowColor     辉光色,空值回退默认
     */
    public LaserBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction, Long ownerId, Long teamId,
                             String name, String bulletColor, double length, double expandSpeed,
                             int durationTicks, double damage, String glowColor) {
        super(position, direction, ownerId, teamId,
                name,
                (bulletColor == null || bulletColor.isEmpty()) ? DEFAULT_LASER_COLOR : bulletColor,
                (Double.isFinite(expandSpeed) && expandSpeed > 0) ? expandSpeed : DEFAULT_EXPAND_SPEED,
                TAG);

        this.laserExpandSpeed = (Double.isFinite(expandSpeed) && expandSpeed > 0)
                ? expandSpeed : DEFAULT_EXPAND_SPEED;
        this.laserConfiguredLength = Math.max(MIN_LENGTH,
                (Double.isFinite(length) ? length : DEFAULT_LENGTH));
        this.laserMaxLength = this.laserConfiguredLength;
        int ticks = durationTicks > 0 ? durationTicks : DEFAULT_DURATION_TICKS;
        this.laserHoldSeconds = ticks * TICK_SECONDS;
        this.laserGlowColor = (glowColor == null || glowColor.isEmpty())
                ? DEFAULT_LASER_GLOW_COLOR : glowColor;
        this.damage = (Double.isFinite(damage) && damage > 0) ? damage : DEFAULT_DAMAGE;
        // 激光本体不位移(位置固定为射击起点),由"前端延伸"表达射速;
        // velocity 仍为"单位方向 × 展开速度",与普通子弹语义一致,便于客户端推导方向
        this.isMoving = false;
    }

    /** 激光前端展开所需时间(秒) = 长度 ÷ 展开速度 */
    public double expandSeconds() {
        double speed = laserExpandSpeed > 0 ? laserExpandSpeed : DEFAULT_EXPAND_SPEED;
        return laserMaxLength / speed;
    }

    /** 激光总存活时长(秒) = 展开 + 渐亮 + 持续发光 + 渐暗 */
    public double totalLifetimeSeconds() {
        return expandSeconds() + FADE_IN_SECONDS + laserHoldSeconds + FADE_OUT_SECONDS;
    }

    /** 单位射击方向(由速度方向推得;速度为零时回退到朝向) */
    public Geometry.Vec2 unitDirection() {
        double dx = velocity.x;
        double dy = velocity.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            dx = facingDirection.x;
            dy = facingDirection.y;
            len = Math.hypot(dx, dy);
        }
        if (len < 0.0001) {
            return new Geometry.Vec2(1, 0);
        }
        return new Geometry.Vec2(dx / len, dy / len);
    }

    /** 指定时刻的激光长度(px) */
    public double lengthAt(double elapsed) {
        double expand = expandSeconds();
        if (!(expand > 0)) {
            return laserMaxLength;
        }
        double ratio = Math.max(0, Math.min(1, elapsed / expand));
        return laserMaxLength * ratio;
    }

    /**
     * 让激光跟随发射者同步移动:按发射者相对上一帧的位移增量,整体平移这条激光线段。
     *
     * <p>只做平移、不改变方向与长度,因此光束始终"挂在发射者的炮口上"。发射者不存在
     * (已被清理/断线)时不做任何处理,激光保持最后位置直到自然寿命结束。</p>
     *
     * @param shooterPosition 发射者当前帧的位置
     */
    public void followShooter(Geometry.Vec2 shooterPosition) {
        if (shooterPosition == null) {
            return;
        }
        if (laserShooterPosition == null) {
            laserShooterPosition = new Geometry.Vec2(shooterPosition.x, shooterPosition.y);
            return;
        }
        double dx = shooterPosition.x - laserShooterPosition.x;
        double dy = shooterPosition.y - laserShooterPosition.y;
        if (dx == 0 && dy == 0) {
            return;
        }
        position.x += dx;
        position.y += dy;
        updateCollisionBox();
        laserShooterPosition.x = shooterPosition.x;
        laserShooterPosition.y = shooterPosition.y;
    }

    /**
     * 按围墙重新截断激光长度(仅在起点位置变化时真正执行射线检测)。
     * 始终以"发射时配置的原始长度"为上限,因此发射者离开围墙后光束可以重新伸长。
     */
    private void clampLengthToWalls(WorldView world) {
        if (laserClampOrigin != null
                && laserClampOrigin.x == position.x
                && laserClampOrigin.y == position.y) {
            return;
        }
        laserClampOrigin = new Geometry.Vec2(position.x, position.y);
        double wallLimit = raycastStaticDistance(laserConfiguredLength, world);
        laserMaxLength = Math.max(0, Math.min(laserConfiguredLength, wallLimit));
    }

    /**
     * 激光每帧推进:起点位置变化时重新按围墙截断,之后仅累计存在时长。
     * 激光本体不自行飞行,因此完全覆盖基类"直线飞行 + 撞墙即移除"的逻辑。
     */
    @Override
    public void updateBullet(double dt, WorldView world) {
        if (shouldRemove) {
            return;
        }
        clampLengthToWalls(world);
        laserElapsed += dt;
        if (laserElapsed >= totalLifetimeSeconds()) {
            shouldRemove = true;
        }
    }

    /**
     * 沿射击方向做射线与静态实体(围墙)的相交测试,返回第一个命中点的距离。
     * 未命中、或命中点在起点之前(起点已在墙内)时返回 maxLength。
     */
    private double raycastStaticDistance(double maxLength, WorldView world) {
        if (!(maxLength > 0) || world == null) {
            return maxLength;
        }
        Geometry.Vec2 dir = unitDirection();
        double originX = position.x;
        double originY = position.y;
        // 先用线段包围盒筛掉无关静态实体,再逐个做 slab 相交测试
        double minX = Math.min(originX, originX + dir.x * maxLength) - 1;
        double minY = Math.min(originY, originY + dir.y * maxLength) - 1;
        double maxX = Math.max(originX, originX + dir.x * maxLength) + 1;
        double maxY = Math.max(originY, originY + dir.y * maxLength) + 1;

        double nearest = maxLength;
        for (StaticEntity staticEntity : world.staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            Geometry.Box box = staticEntity.collisionBox;
            double tMin = 0;
            double tMax = nearest;

            // X 轴 slab
            if (Math.abs(dir.x) < 1e-6) {
                if (originX <= box.x || originX >= box.maxX()) {
                    continue;
                }
            } else {
                double t1 = (box.x - originX) / dir.x;
                double t2 = (box.maxX() - originX) / dir.x;
                if (t1 > t2) {
                    double swap = t1;
                    t1 = t2;
                    t2 = swap;
                }
                tMin = Math.max(tMin, t1);
                tMax = Math.min(tMax, t2);
            }

            // Y 轴 slab
            if (Math.abs(dir.y) < 1e-6) {
                if (originY <= box.y || originY >= box.maxY()) {
                    continue;
                }
            } else {
                double t1 = (box.y - originY) / dir.y;
                double t2 = (box.maxY() - originY) / dir.y;
                if (t1 > t2) {
                    double swap = t1;
                    t1 = t2;
                    t2 = swap;
                }
                tMin = Math.max(tMin, t1);
                tMax = Math.min(tMax, t2);
            }

            // 命中:交点在射线上,且位于起点前方
            if (tMin <= tMax && tMin > 0 && tMin < nearest) {
                nearest = tMin;
            }
        }
        return nearest;
    }
}
