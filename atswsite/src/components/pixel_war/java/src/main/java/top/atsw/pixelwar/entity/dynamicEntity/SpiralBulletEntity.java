package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 螺旋弹(由前端 TS 版 SpiralBulletDynamicEntity 迁移)。
 *
 * <p>与普通子弹一样按固定速率飞行,但飞行过程中<b>速度方向持续旋转</b>,
 * 因此轨迹是一条平滑的螺旋弧线,用于制造"盘旋弹幕"。</p>
 *
 * <p>实现:重写 {@link #updateBullet} —— 先把速度向量按 {@link #CURVE_DEG_PER_SEC}
 * 旋转一个帧角,再交给基类按新速度推进(撞墙/寿命逻辑完全复用)。</p>
 *
 * <p>方向由速度推导,而速度随快照下发,因此多人模式下客户端渲染的弹道与权威端一致。</p>
 */
public class SpiralBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "spiral_bullet";
    /** 弹体基色(青绿) */
    public static final String COLOR = "rgba(150, 255, 220, 0.9)";
    /** 速度方向旋转角速度(度/秒):正值代表逆时针偏转 */
    public static final double CURVE_DEG_PER_SEC = 150;

    public SpiralBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                              Long ownerId, Long teamId, String name, double moveSpeed) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, COLOR, moveSpeed, TAG);
        this.rangeType = "long";
    }

    /**
     * 飞行中让速度方向按固定角速度旋转,再交给基类按新速度推进。
     */
    @Override
    public void updateBullet(double dt, WorldView world) {
        if (shouldRemove) {
            return;
        }
        double rad = Math.toRadians(CURVE_DEG_PER_SEC * dt);
        double cos = Math.cos(rad);
        double sin = Math.sin(rad);
        double vx = velocity.x;
        double vy = velocity.y;
        velocity.x = vx * cos - vy * sin;
        velocity.y = vx * sin + vy * cos;
        super.updateBullet(dt, world);
    }
}
