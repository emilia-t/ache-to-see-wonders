package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;

/**
 * 穿甲狙击弹(由前端 TS 版 SniperBulletDynamicEntity 迁移)。
 *
 * <p>与普通子弹共用全部飞行/命中/伤害逻辑(见 {@link BulletEntity#updateBullet} 与
 * {@code World.updateBullets}),仅"类型标签 + 基色"不同:用于表达弹体更长、
 * 射程类型为 long 的高威胁弹种。客户端按 tag 选择对应的渲染实体。</p>
 */
public class SniperBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "sniper_bullet";
    /** 弹体基色(纯白) */
    public static final String BULLET_COLOR = "rgba(255, 255, 255, 0.9)";

    public SniperBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                              Long ownerId, Long teamId, String name) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, BULLET_COLOR, MOVE_SPEED, TAG);
        this.rangeType = "long";
    }
}
