package top.atsw.pixelwar.entity.staticEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.Entity;

/**
 * 静态实体
 *
 * <ul>
 *   <li>{@code curb8}:400(或 50)× 50 的长条,按 direction(up/down/left/right)决定朝向;</li>
 *   <li>{@code curb}:50 × 50 的角块,用于填补四角空隙。</li>
 * </ul>
 */
public final class StaticEntity extends Entity {

    /** 长条单元的贴图长度(TILE × LENGTH,对应 TS 版 CurbStaticEntity8Length) */
    public static final double TILE = 50;
    public static final int LENGTH = 8;
    /** 围墙厚度 */
    public static final double THICKNESS = 50;

    /** 朝向:'up' | 'down' | 'left' | 'right' | null(角块无朝向) */
    public final String direction;

    private StaticEntity(String tag, Geometry.Vec2 position, double width, double height, String direction) {
        super("static", position, width, height, tag, tag);
        this.direction = direction;
        this.tag = tag;
    }

    /** 创建 400 × 50 的围墙长条 */
    public static StaticEntity curb8(Geometry.Vec2 position, String direction) {
        double length = TILE * LENGTH;
        boolean horizontal = "up".equals(direction) || "down".equals(direction);
        double width = horizontal ? length : THICKNESS;
        double height = horizontal ? THICKNESS : length;
        return new StaticEntity("curb8", position, width, height, direction);
    }

    /** 创建 50 × 50 的围墙角块 */
    public static StaticEntity curb(Geometry.Vec2 position) {
        return new StaticEntity("curb", position, THICKNESS, THICKNESS, null);
    }
}
