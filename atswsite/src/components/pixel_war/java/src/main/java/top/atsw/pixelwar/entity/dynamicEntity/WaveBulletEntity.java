package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 波纹弹(由前端 TS 版 WaveBulletDynamicEntity 迁移)。
 *
 * <p>沿主轴前进的同时左右摆动:每帧以"基准方向"为轴、按正弦波偏转 ±{@link #WEAVE_DEG} 度后
 * 重新计算速度,因此弹道是一条规则的蛇形波浪线。</p>
 *
 * <p>摆幅有 {@link #WEAVE_RAMP_SECONDS} 秒的展开时间(出膛时笔直,随后逐渐摆开),
 * 且速度始终由基准方向重新推导,不会累积浮点漂移。</p>
 */
public class WaveBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "wave_bullet";
    /** 弹体基色(靛紫) */
    public static final String COLOR = "rgba(150, 160, 255, 0.9)";
    /** 摆动最大偏角(度) */
    public static final double WEAVE_DEG = 26;
    /** 摆动频率(Hz,每秒完整往复次数) */
    public static final double WEAVE_HZ = 1.5;
    /** 摆幅展开时间(秒):出膛后逐渐从笔直摆到最大偏角 */
    public static final double WEAVE_RAMP_SECONDS = 0.35;

    /** 已飞行时间(秒) */
    private double elapsed = 0;
    /** 基准方向(单位向量):波形围绕它摆动,不随帧累积漂移 */
    private final Geometry.Vec2 baseDirection;
    /** 基础速度(px/s) */
    private final double baseSpeed;

    public WaveBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                            Long ownerId, Long teamId, String name, double moveSpeed) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, COLOR, moveSpeed, TAG);
        this.rangeType = "short";
        double speedValue = (Double.isFinite(moveSpeed) && moveSpeed > 0) ? moveSpeed : MOVE_SPEED;
        double len = Math.hypot(direction.x, direction.y);
        this.baseDirection = len < 0.0001
                ? new Geometry.Vec2(1, 0)
                : new Geometry.Vec2(direction.x / len, direction.y / len);
        this.baseSpeed = speedValue;
    }

    /** 飞行中按正弦规律左右偏转:始终以基准方向为轴,避免逐帧旋转导致的方向漂移 */
    @Override
    public void updateBullet(double dt, WorldView world) {
        if (shouldRemove) {
            return;
        }
        elapsed += dt;
        double envelope = Math.min(1, elapsed / WEAVE_RAMP_SECONDS);
        double wave = Math.sin(elapsed * WEAVE_HZ * Math.PI * 2);
        double rad = Math.toRadians(WEAVE_DEG * envelope * wave);
        double cos = Math.cos(rad);
        double sin = Math.sin(rad);
        double dirX = baseDirection.x * cos - baseDirection.y * sin;
        double dirY = baseDirection.x * sin + baseDirection.y * cos;
        velocity.x = dirX * baseSpeed;
        velocity.y = dirY * baseSpeed;
        super.updateBullet(dt, world);
    }
}
