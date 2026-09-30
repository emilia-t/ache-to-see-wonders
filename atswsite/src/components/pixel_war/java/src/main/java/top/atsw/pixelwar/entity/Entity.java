package top.atsw.pixelwar.entity;

import top.atsw.pixelwar.core.Geometry;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 实体基类(由前端 TS 版 class/Entity/Entity.ts 迁移)。
 *
 * <p>客户端渲染相关的贴图字段(texturePath / texture)在服务端不参与模拟,
 * 仅保留 tag/name/颜色等会随快照下发的展示信息。</p>
 */
public abstract class Entity {

    /** 实体 id 自增种子(对应 TS 版 Entity.nextEntityId,起始 100) */
    private static final AtomicLong NEXT_ID = new AtomicLong(100);

    public long id;
    /** 实体大类:'static' | 'dynamic' | 'item' */
    public String type;
    /** 世界坐标 */
    public Geometry.Vec2 position;
    public double width;
    public double height;
    public String name;
    public String tag;
    public Geometry.Box collisionBox;
    public String fillColor;
    public String strokeColor;
    public String mapColor;

    protected Entity(String type, Geometry.Vec2 position, double width, double height, String name, String tag) {
        this.id = NEXT_ID.getAndIncrement();
        this.type = type;
        this.position = position;
        this.width = width;
        this.height = height;
        this.name = name;
        this.tag = (tag == null || tag.isEmpty()) ? name : tag;
        this.collisionBox = new Geometry.Box(
                position.x - width / 2,
                position.y - height / 2,
                width,
                height);
    }

    /** 更新碰撞盒(位置变化时调用) */
    public void updateCollisionBox() {
        this.collisionBox.x = this.position.x - this.width / 2;
        this.collisionBox.y = this.position.y - this.height / 2;
        this.collisionBox.width = this.width;
        this.collisionBox.height = this.height;
    }

    /** 到另一点的距离 */
    public double distanceTo(Entity other) {
        return Geometry.distance(position.x, position.y, other.position.x, other.position.y);
    }

    /** 到指定坐标的距离 */
    public double distanceTo(double x, double y) {
        return Geometry.distance(position.x, position.y, x, y);
    }
}
