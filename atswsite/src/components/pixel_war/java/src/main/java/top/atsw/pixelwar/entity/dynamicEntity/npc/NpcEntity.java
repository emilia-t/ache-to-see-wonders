package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BombEntity;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.game.Skill;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * NPC 基类(由前端 TS 版 NpcDynamicEntity / HostileNpcDynamicEntity / FriendlyNpcDynamicEntity 迁移)。
 *
 * <p>NPC 归属玩家(ownerId != null)时成为"从者",会瞬移到主人在从者网格中分配的格子位置;
 * 无主时由各自的子类实现游走与攻击行为。</p>
 */
public abstract class NpcEntity extends DynamicEntity {

    public static final double WIDTH = 25;
    public static final double HEIGHT = 25;

    /** 战利品配置(击杀后按概率掉落) */
    public record Loot(String type, String tag, double odds) {
    }

    /** NPC 行动上下文:提供生成子弹/炸弹、读取世界与其他玩家的能力 */
    public static final class ActionContext {
        public double deltaTime;
        public WorldView world;
        public Skill.Provider skills;
        public List<PlayerEntity> players = new ArrayList<>();
        public Consumer<BulletEntity> spawnBullet;
        public Consumer<BombEntity> spawnBomb;
    }

    /** 拥有者玩家 id,null 表示无主 */
    public Long ownerId;
    /** 拥有者队伍 id,null 表示无队伍 */
    public Long teamId;
    /** 阵营:'hostile' | 'friendly' | 'neutral' */
    public String attitude;
    /** 拾取范围(px) */
    public double pickupRange;
    /** 被击杀时获得的分数 */
    public int killScore = 1;
    /** 战利品配置(击杀后按概率掉落),默认空数组 */
    public List<Loot> loot = new ArrayList<>();
    /**
     * 主人(玩家)的射速倍率,由世界每帧同步。
     * 从者(ownerId != null)开火间隔按该倍率缩放,实现"从者子弹射速同步受玩家专研影响"。
     */
    public double ownerFireRateMultiplier = 1;
    /**
     * 最后一次对本次击杀产生贡献的玩家 id(用于"幸运之星"结算战利品加成)。
     * 仅服务端使用,不参与渲染。
     */
    public Long lastKillerPlayerId;
    /** NPC 等级(默认 0);等级越高能力越强,由刷怪逻辑在创建后调用 applyNpcLevel 设置 */
    public int level;
    /** 首次应用等级时的基础移动速度(用于在基础值上叠加等级增益,避免重复叠加) */
    private Double baseMinMoveSpeed;
    private Double baseMaxMoveSpeed;
    private Double baseSpeed;

    protected NpcEntity(Geometry.Vec2 position, Long ownerId, Long teamId, String name,
                        String attitude, double pickupRange, String tag) {
        super(position, WIDTH, HEIGHT, name, "npc", tag);
        this.attitude = attitude;
        this.pickupRange = pickupRange;
        this.ownerId = ownerId;
        this.teamId = teamId;
        this.killScore = 1;
        // NPC 默认携带的游戏经验值
        this.gameExp = 2;
    }

    /**
     * 行为循环的时间推进量。
     *
     * <p>无主 NPC 返回原 dt;玩家从者的开火节奏按其主人的射速倍率加速
     * (倍率 &gt; 1 时冷却流逝更快 → 开火更频繁)。</p>
     */
    protected double getActionDelta(double dt) {
        if (ownerId == null) {
            return dt;
        }
        double multiplier = (Double.isFinite(ownerFireRateMultiplier) && ownerFireRateMultiplier > 0)
                ? ownerFireRateMultiplier : 1;
        return dt * multiplier;
    }

    // ==================================================================
    // 等级
    // ==================================================================

    /** 等级上限(子类覆盖;同时决定刷怪时使用的等级概率表) */
    public int maxLevel() {
        return 5;
    }

    /** 每级移动速度增益(px/s,子类覆盖:红像素为 40,其余为 20) */
    protected double moveSpeedBonusPerLevel() {
        return 20;
    }

    /** 每级子弹速度增益(px/s) */
    public double getBulletSpeedBonus() {
        return level * 60;
    }

    /** 本 NPC 发射子弹时的速度(基础子弹速度 + 等级增益) */
    protected double getBulletMoveSpeed() {
        return BulletEntity.MOVE_SPEED + getBulletSpeedBonus();
    }

    /**
     * 应用 NPC 等级:设置等级并重算与等级相关的属性。
     *
     * <p>由刷怪逻辑在创建实体后调用;构造阶段等级恒为 0(即各公式的基准值)。
     * 重复调用是幂等的(移动速度始终基于首次调用的基础值重新计算)。</p>
     */
    public void applyNpcLevel(int level) {
        int clamped = Math.max(0, Math.min(maxLevel(), level));
        this.level = clamped;
        applyMoveSpeedBonus();
        onNpcLevelApplied();
    }

    /** 在基础移动速度上叠加 等级 × 每级增益 */
    private void applyMoveSpeedBonus() {
        if (baseMinMoveSpeed == null) {
            baseMinMoveSpeed = minMoveSpeed;
            baseMaxMoveSpeed = maxMoveSpeed;
            baseSpeed = speed;
        }
        double bonus = moveSpeedBonusPerLevel() * level;
        minMoveSpeed = baseMinMoveSpeed + bonus;
        maxMoveSpeed = baseMaxMoveSpeed + bonus;
        speed = baseSpeed + bonus;
    }

    /** 等级变化时重算等级相关属性(生命/经验/攻击间隔等),由子类覆盖 */
    protected void onNpcLevelApplied() {
        // 默认无额外等级属性
    }

    /** 生成权重(0,1],用于按权重随机刷新 */
    public abstract double generateWeight();

    /** 战役动作循环(仅在未被冻结/销毁时调用) */
    public abstract void actionLoop(ActionContext context);

    /** 是否处于"从者"状态 */
    public boolean isServant() {
        return ownerId != null;
    }

    /** 释放归属(死亡或断连时调用) */
    public void releaseOwner() {
        this.ownerId = null;
        this.teamId = null;
    }

    /**
     * 从者跟随:瞬移到主人在从者网格中分配的格子中心。
     *
     * @return 是否成功跟随(主人或格子不存在时返回 false)
     */
    public boolean followOwner(WorldView world) {
        if (ownerId == null) {
            return false;
        }
        for (PlayerEntity player : world.players()) {
            if (player.id != ownerId) {
                continue;
            }
            PlayerEntity.Servant servant = player.selectServantByID(id);
            if (servant == null) {
                return false;
            }
            Geometry.Vec2 newPosition = player.rowColToWorldPosition(servant.row, servant.col);
            if (newPosition == null) {
                return false;
            }
            position.set(newPosition);
            updateCollisionBox();
            isMoving = false;
            nextTarget = newPosition.copy();
            targetHistory = new ArrayList<>(List.of(newPosition.copy()));
            curvePoints = new ArrayList<>(List.of(newPosition.copy()));
            currentCurveIndex = 0;
            return true;
        }
        return false;
    }

    /** 归一化的朝向(无方向时朝下) */
    protected Geometry.Vec2 normalizedFacingDirection() {
        double len = Math.hypot(facingDirection.x, facingDirection.y);
        if (len < 0.0001) {
            return new Geometry.Vec2(0, 1);
        }
        return new Geometry.Vec2(facingDirection.x / len, facingDirection.y / len);
    }

    /**
     * 按阵营决定子弹颜色:有主时使用主人的子弹颜色,否则使用自身默认颜色。
     */
    protected String bulletColorOf(ActionContext context) {
        if (ownerId != null) {
            for (PlayerEntity player : context.players) {
                if (player.playerRule.bulletColor != null && !player.playerRule.bulletColor.isEmpty()) {
                    return player.playerRule.bulletColor;
                }
            }
        }
        return "";
    }
}
