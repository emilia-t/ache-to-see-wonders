package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;

/**
 * 穿甲弹(由前端 TS 版 PiercingBulletDynamicEntity 迁移)。
 *
 * <p>命中目标后<b>不消失</b> —— 继续沿原方向飞行,并对沿途每个目标各造成一次伤害。
 * 同一目标对同一发子弹只结算一次(见 {@link BulletEntity#hasDamagedTarget}),
 * 穿透分支位于 {@code World.updateBullets}。</p>
 */
public class PiercingBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "piercing_bullet";
    /** 弹体基色(亮品红) */
    public static final String COLOR = "rgba(255, 120, 200, 0.9)";

    public PiercingBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                                Long ownerId, Long teamId, String name, double moveSpeed) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, COLOR, moveSpeed, TAG);
        this.rangeType = "long";
        this.piercesTargets = true;
    }
}
