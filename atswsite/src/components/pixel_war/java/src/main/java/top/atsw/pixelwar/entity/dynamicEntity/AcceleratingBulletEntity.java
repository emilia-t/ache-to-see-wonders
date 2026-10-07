package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 疾进弹(由前端 TS 版 AcceleratingBulletDynamicEntity 迁移)。
 *
 * <p>出膛时慢、越飞越快:速度从 {@link #INITIAL_SPEED_MULTIPLIER} 倍基础速度开始,
 * 在 {@link #RAMP_SECONDS} 秒内线性爬升到 {@link #MAX_SPEED_MULTIPLIER} 倍,之后保持恒定。</p>
 *
 * <p>速度的爬升完全在 {@link #updateBullet} 内完成,不依赖世界的任何特殊处理。</p>
 */
public class AcceleratingBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "accelerating_bullet";
    /** 弹体基色(橙红) */
    public static final String COLOR = "rgba(255, 122, 74, 0.9)";
    /** 出膛时的速度倍率(相对基础速度) */
    public static final double INITIAL_SPEED_MULTIPLIER = 0.45;
    /** 速度爬升上限倍率 */
    public static final double MAX_SPEED_MULTIPLIER = 2.1;
    /** 从初始倍率线性爬升到最大倍率所需时间(秒) */
    public static final double RAMP_SECONDS = 1.1;

    /** 已飞行时间(秒) */
    private double elapsed = 0;
    /** 基础速度(px/s):爬升倍率的参考速度 */
    private final double baseSpeed;

    public AcceleratingBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                                    Long ownerId, Long teamId, String name, double moveSpeed) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, COLOR, moveSpeed, TAG);
        this.rangeType = "short";
        this.baseSpeed = (Double.isFinite(moveSpeed) && moveSpeed > 0) ? moveSpeed : MOVE_SPEED;
        double len = Math.hypot(direction.x, direction.y);
        double dirX = len < 0.0001 ? 1 : direction.x / len;
        double dirY = len < 0.0001 ? 0 : direction.y / len;
        velocity.x = dirX * baseSpeed * INITIAL_SPEED_MULTIPLIER;
        velocity.y = dirY * baseSpeed * INITIAL_SPEED_MULTIPLIER;
        this.speed = baseSpeed * INITIAL_SPEED_MULTIPLIER;
        this.minMoveSpeed = this.speed;
        this.maxMoveSpeed = this.speed;
    }

    /** 当前速度倍率(0~1 的爬升进度线性映射到 [初始倍率, 最大倍率]) */
    private double speedMultiplier() {
        double t = Math.max(0, Math.min(1, elapsed / RAMP_SECONDS));
        return INITIAL_SPEED_MULTIPLIER + (MAX_SPEED_MULTIPLIER - INITIAL_SPEED_MULTIPLIER) * t;
    }

    /** 飞行中按固定倍率爬升:保持方向不变,仅把速度大小乘以当前倍率,再交给基类推进 */
    @Override
    public void updateBullet(double dt, WorldView world) {
        if (shouldRemove) {
            return;
        }
        elapsed += dt;
        double speedValue = baseSpeed * speedMultiplier();
        double len = Math.hypot(velocity.x, velocity.y);
        double dirX = len > 0.0001 ? velocity.x / len : 1;
        double dirY = len > 0.0001 ? velocity.y / len : 0;
        velocity.x = dirX * speedValue;
        velocity.y = dirY * speedValue;
        this.speed = speedValue;
        this.minMoveSpeed = speedValue;
        this.maxMoveSpeed = speedValue;
        super.updateBullet(dt, world);
    }
}
