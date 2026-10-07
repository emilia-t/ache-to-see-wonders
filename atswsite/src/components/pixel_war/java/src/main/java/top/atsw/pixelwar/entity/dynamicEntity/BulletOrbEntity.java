package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.game.Skill;

/**
 * 子弹球(由前端 TS 版 BulletOrbDynamicEntity 迁移)。
 *
 * <p>与经验球 / 技能球同为"掉落物"型动态实体:</p>
 * <ul>
 *   <li>击杀"具备发射子弹能力"的 NPC(普通子弹 / 镭射子弹)时按概率掉落;</li>
 *   <li><b>自身不寻找玩家</b>:只做"存在时长 + 惯性滑行";
 *       由 {@code World.updatePickups} 的"玩家主动搜索并吸取"逻辑牵引与吸收;</li>
 *   <li>玩家子弹已达上限时不可吸取(玩家会跳过它,子弹球静置在原地);</li>
 *   <li>玩家剩余容量不足时只吸收一部分,剩余的子弹球继续留在地上;</li>
 *   <li>超时未被吸取则自动消失。</li>
 * </ul>
 */
public final class BulletOrbEntity extends DynamicEntity implements AbsorbableOrb {

    /** 物理碰撞体积 */
    public static final double WIDTH = 10;
    public static final double HEIGHT = 10;
    /** 吸引范围(px) */
    public static final double ATTRACT_RANGE = 200;
    /** 拾取范围(px) */
    public static final double PICKUP_RANGE = 26;
    /** 存在时长(秒) */
    public static final double LIFETIME = 45;
    /** 单颗子弹球默认承载的子弹数 */
    public static final int DEFAULT_VALUE = 1;

    /** 主色(银色,与子弹外观一致) */
    public static final String MAIN_COLOR = "#c9d6e3";
    /** 辉光/高光色 */
    public static final String GLOW_COLOR = "#f2f7fc";
    /** 弹体暗部/描边色 */
    public static final String CORE_COLOR = "#5c6b7a";

    /** 承载的子弹数(大于 1 时拾取会被拆分) */
    public int value;
    /** 已存活时间(秒) */
    public double age;
    /** 是否已被拾取(或超时消失) */
    public boolean isPickedUp;

    public BulletOrbEntity(Geometry.Vec2 position, int value) {
        super(position, WIDTH, HEIGHT, "子弹球", "bullet_orb", "bullet_orb");
        this.value = Math.max(1, value);
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.speed = 0;
        this.minMoveSpeed = 0;
        this.maxMoveSpeed = 0;
    }

    /** 子弹球每帧更新:仅存在时长与惯性滑行(不再自行寻找玩家) */
    public void updateOrb(double dt) {
        if (isPickedUp) {
            return;
        }
        age += dt;
        if (age >= LIFETIME) {
            isPickedUp = true;// 超时消失
            return;
        }

        // 仅保留惯性滑行(爆出时的冲量逐渐衰减)
        applyAirResistance(dt);
        position.x += motionVelocity.x * dt;
        position.y += motionVelocity.y * dt;
        updateCollisionBox();
    }

    // ==================================================================
    // 被玩家主动吸取(由 World.updatePickups 调用)
    // ==================================================================

    /** 吸取范围(px) */
    @Override
    public double absorbRange() {
        return ATTRACT_RANGE;
    }

    /** 拾取范围(px):子弹球为点判定,与玩家体积无关 */
    @Override
    public double pickupRange(PlayerEntity player) {
        return PICKUP_RANGE;
    }

    /**
     * 玩家当前能否接受本子弹球。
     *
     * <p>子弹已满时返回 false —— 此时玩家不会牽引它,因此子弹球会安静地待在地上,
     * 而不是绕着"装不下"的玩家反复弹跳。</p>
     */
    @Override
    public boolean canBeAbsorbedBy(PlayerEntity player) {
        return player.getBulletCapacity() > 0;
    }

    /** 被玩家牽引一帧:朝玩家飘行,距离越近速度越快 */
    @Override
    public void attractTowardPlayer(PlayerEntity player, double dt) {
        if (isPickedUp) {
            return;
        }
        double dx = player.position.x - position.x;
        double dy = player.position.y - position.y;
        double distance = Math.hypot(dx, dy);
        if (distance <= 0.0001) {
            return;
        }
        double speed = 150 + (1 - distance / ATTRACT_RANGE) * 380;
        position.x += dx / distance * speed * dt;
        position.y += dy / distance * speed * dt;
        updateCollisionBox();
    }

    /** 被玩家吸收:容量为 0 时不吸收(留在原地),容量不足时只吸收一部分 */
    @Override
    public void absorbByPlayer(PlayerEntity player, Skill.Provider skills) {
        int accepted = player.addBulletCount(value);
        if (accepted >= value) {
            isPickedUp = true;
        } else if (accepted > 0) {
            value -= accepted;// 仅部分吸收,剩余部分继续留在地上
        }
    }

    /** 是否已被拾取(含超时消失) */
    @Override
    public boolean isAbsorbed() {
        return isPickedUp;
    }
}
