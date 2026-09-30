package top.atsw.pixelwar.entity.itemEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.Entity;

/**
 * 物品实体
 *
 * <p>物品不参与碰撞体积计算;存在时长耗尽后进入消失特效阶段,特效结束由世界模块移除。
 * {@code count} 表示这一堆物品的数量(玩家死亡掉落时会保留堆叠数量)。</p>
 */
public final class ItemEntity extends Entity {

    public static final double WIDTH = 25;
    public static final double HEIGHT = 25;
    /** 物品存在时长(秒) */
    public static final double DEFAULT_LIFETIME = 60;

    /** 初始寿命(秒) */
    public final double lifetimeTotal;
    /** 寿命剩余时间(秒) */
    public double lifetimeRemaining;
    /** 是否进入消失特效阶段 */
    public boolean isDisappearing;
    /** 消失特效总时长(秒) */
    public final double disappearDuration = 0.45;
    /** 消失特效剩余时间(秒) */
    public double disappearTimer;
    /** 这一堆物品的数量(堆叠) */
    public int count;

    public ItemEntity(Geometry.Vec2 position, String tag, String name, int count) {
        this(position, tag, name, count, DEFAULT_LIFETIME);
    }

    public ItemEntity(Geometry.Vec2 position, String tag, String name, int count, double lifetimeSeconds) {
        super("item", position, WIDTH, HEIGHT, name, tag);
        this.lifetimeTotal = Math.max(0, lifetimeSeconds);
        this.lifetimeRemaining = this.lifetimeTotal;
        this.count = Math.max(1, count);
        // 物品不参与碰撞体积计算
        this.collisionBox = new Geometry.Box(position.x, position.y, 0, 0);
    }

    @Override
    public void updateCollisionBox() {
        // 物品无碰撞盒,位置变化不需要更新碰撞盒
    }

    public void updateLifetime(double dt) {
        if (isDisappearing) {
            disappearTimer = Math.max(0, disappearTimer - dt);
            return;
        }
        if (lifetimeRemaining <= 0) {
            beginDisappear();
            return;
        }
        lifetimeRemaining = Math.max(0, lifetimeRemaining - dt);
        if (lifetimeRemaining <= 0) {
            beginDisappear();
        }
    }

    public void beginDisappear() {
        if (isDisappearing) {
            return;
        }
        isDisappearing = true;
        disappearTimer = disappearDuration;
    }

    public boolean isReadyToRemove() {
        return isDisappearing && disappearTimer <= 0;
    }

    /** 寿命比例(1 = 全新,0 = 即将消失),供客户端做淡出 */
    public double lifetimeRatio() {
        if (lifetimeTotal <= 0) {
            return 1;
        }
        if (isDisappearing) {
            return 0;
        }
        return Geometry.clamp(lifetimeRemaining / lifetimeTotal, 0, 1);
    }
}
