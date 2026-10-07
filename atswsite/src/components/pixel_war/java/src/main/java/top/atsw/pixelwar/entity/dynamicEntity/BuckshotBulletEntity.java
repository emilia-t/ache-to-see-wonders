package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;

/**
 * 霰弹(由前端 TS 版 BuckshotBulletDynamicEntity 迁移)。
 *
 * <p>与普通子弹共用全部飞行/命中/伤害逻辑,仅"类型标签 + 基色"不同:
 * 单发弹丸伤害低、存活短,通常由 NPC 以扇形多发布置(见 {@code MagentaSwarmSw5Npc})。</p>
 */
public class BuckshotBulletEntity extends BulletEntity {

    /** 子弹类型标签(随快照下发给客户端用于选择渲染实体) */
    public static final String TAG = "buckshot_bullet";
    /** 弹体基色(土黄) */
    public static final String BULLET_COLOR = "rgba(200, 180, 50, 0.9)";

    public BuckshotBulletEntity(Geometry.Vec2 position, Geometry.Vec2 direction,
                                Long ownerId, Long teamId, String name) {
        super(position, direction, ownerId, teamId,
                name == null ? "" : name, BULLET_COLOR, MOVE_SPEED, TAG);
        this.rangeType = "short";
    }
}
