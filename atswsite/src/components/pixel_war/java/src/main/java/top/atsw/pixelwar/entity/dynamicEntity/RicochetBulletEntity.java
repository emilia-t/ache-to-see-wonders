package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 跳弹(由前端 TS 版 RicochetBulletDynamicEntity 迁移)。
 *
 * <p>撞墙时<b>反弹</b>而不是消失,最多反弹 {@link #MAX_BOUNCES} 次,超出后按普通子弹处理。</p>
 *
 * <p>反弹采用<b>分轴判定</b>:分别用「只走 X」「只走 Y」的候选位置复检静态碰撞,
 * 因此正面撞墙、沿墙滑行与角落双反弹都表现自然。</p>
 */
public class RicochetBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "ricochet_bullet";
    /** 弹体基色(钴蓝) */
    public static final String COLOR = "rgba(110, 170, 255, 0.9)";
    /** 最大反弹次数 */
    public static final int MAX_BOUNCES = 3;

    /** 剩余可反弹次数(仅权威端使用) */
    public int remainingBounces = MAX_BOUNCES;

    public RicochetBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                                Long ownerId, Long teamId, String name, double moveSpeed) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, COLOR, moveSpeed, TAG);
        this.rangeType = "long";
    }

    /**
     * 撞墙:按剩余次数反弹,位置保持不动(下一帧按反向速度继续前进)。
     */
    @Override
    protected void onStaticCollision(Geometry.Vec2 nextPos, WorldView world) {
        if (remainingBounces <= 0) {
            shouldRemove = true;
            return;
        }
        remainingBounces -= 1;

        boolean hitX = collidesWithStatic(new Geometry.Vec2(nextPos.x, position.y), world);
        boolean hitY = collidesWithStatic(new Geometry.Vec2(position.x, nextPos.y), world);
        if (hitX && !hitY) {
            velocity.x = -velocity.x;
        } else if (hitY && !hitX) {
            velocity.y = -velocity.y;
        } else {
            // 角落:两轴同时反弹
            velocity.x = -velocity.x;
            velocity.y = -velocity.y;
        }
    }
}
