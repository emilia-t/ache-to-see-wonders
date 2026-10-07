package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 回旋弹(由前端 TS 版 BoomerangBulletDynamicEntity 迁移)。
 *
 * <p>去而复返:先沿发射方向飞出 {@link #OUTBOUND_SECONDS} 秒,随后整条速度取反并乘以
 * {@link #RETURN_SPEED_MULTIPLIER} 加速返回,因此弹道是一条"折返"的往返线段。</p>
 *
 * <p>折返仅发生一次,完全在 {@link #updateBullet} 内实现;此后按基类寿命自然消失。</p>
 */
public class BoomerangBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "boomerang_bullet";
    /** 弹体基色(琥珀金) */
    public static final String COLOR = "rgba(255, 196, 92, 0.9)";
    /** 飞出阶段时长(秒),到达后折返 */
    public static final double OUTBOUND_SECONDS = 0.85;
    /** 折返时的速度倍率(>1 表示返程更快) */
    public static final double RETURN_SPEED_MULTIPLIER = 1.3;

    /** 已飞行时间(秒) */
    private double elapsed = 0;
    /** 是否已经折返(只折返一次) */
    private boolean returned = false;

    public BoomerangBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                                 Long ownerId, Long teamId, String name, double moveSpeed) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, COLOR, moveSpeed, TAG);
        this.rangeType = "long";
    }

    /** 飞出阶段结束后把速度取反(并提速),之后按基类逻辑继续推进 */
    @Override
    public void updateBullet(double dt, WorldView world) {
        if (shouldRemove) {
            return;
        }
        elapsed += dt;
        if (!returned && elapsed >= OUTBOUND_SECONDS) {
            returned = true;
            velocity.x = -velocity.x * RETURN_SPEED_MULTIPLIER;
            velocity.y = -velocity.y * RETURN_SPEED_MULTIPLIER;
            this.speed = Math.hypot(velocity.x, velocity.y);
            this.minMoveSpeed = this.speed;
            this.maxMoveSpeed = this.speed;
        }
        super.updateBullet(dt, world);
    }
}
