package top.atsw.pixelwar.entity;

import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;

import java.util.List;

/**
 * 动态实体需要访问的世界视图(静态实体与空间索引)。
 *
 * <p>定义在 entity 包中,由 world 包实现,避免 entity 与 world 相互直接依赖。</p>
 */
public interface WorldView {

    /** 全部静态实体 */
    List<StaticEntity> staticEntities();

    /** 点是否与任一静态实体碰撞(走空间索引) */
    boolean isPointCollidingStatic(double x, double y);

    /** 取回与矩形相交的静态实体(走空间索引) */
    List<StaticEntity> staticEntitiesInRect(double x, double y, double width, double height);

    /** 当前存活/死亡的玩家列表 */
    List<PlayerEntity> players();

    /** 当前 NPC 列表(用于伤害、吸附、掉落等系统) */
    List<DynamicEntity> npcEntities();

    /** 当前子弹列表(用于 NPC 威胁預判等) */
    List<BulletEntity> bullets();
}
