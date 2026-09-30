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
