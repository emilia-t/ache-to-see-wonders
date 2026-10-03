package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;

/**
 * 友好 NPC「天蓝色像素」(由前端 TS 版 SkyBluePixelEntity 迁移)。
 *
 * <p>除随机游走与主动靠近玩家(保持一定距离)外没有任何攻击方式,不掉落战利品。</p>
 */
public class SkyBluePixelNpc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.2;
    /** 主动靠近玩家的判定范围(px) */
    private static final double APPROACH_RANGE = 220;
    /** 靠近玩家后保持的距离(px) */
    private static final double APPROACH_KEEP_DISTANCE = 120;

    /** 当前要靠近的玩家位置(附近无玩家时为 null) */
    private Geometry.Vec2 approachTarget;

    public SkyBluePixelNpc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "SkyBluePixel", "friendly", 0, "sky_blue_pixel");
        this.fillColor = "#87ceeb";
        this.strokeColor = "#4a8fb0";
        this.health = 1;
        this.healthMax = 1;
        this.killScore = 1;
        this.gameExp = 1;
        this.mapColor = "#87ceeb";
        this.perceptionRange = APPROACH_RANGE;
    }

    /** 等级上限:2 */
    @Override
    public int maxLevel() {
        return 2;
    }

    /** 等级变化时重算等级相关属性(经验值随等级提升) */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = 1 + level * 1;
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public void update(double dt, WorldView world, top.atsw.pixelwar.core.GameConfig config) {
        if (ownerId != null) {
            followOwner(world);
            updateDamageEffect(dt);
            updateDeathEffect(dt);
            return;
        }
        refreshApproachTarget(world);
        super.update(dt, world, config);
    }

    /** 无任何攻击行为 */
    @Override
    public void actionLoop(ActionContext context) {
        // 友好 NPC 不攻击
    }

    /** 附近有玩家时优先靠近玩家,否则沿用随机游走目标 */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        if (approachTarget != null) {
            return super.setTarget(approachTarget, world, false);
        }
        return super.setTarget(target, world, preferStraight);
    }

    /** 刷新附近玩家位置,并计算靠近目标点 */
    private void refreshApproachTarget(WorldView world) {
        approachTarget = null;
        PlayerEntity nearest = null;
        double nearestDist = Double.MAX_VALUE;
        for (PlayerEntity player : world.players()) {
            if (player.isDead) {
                continue;
            }
            double d = Geometry.distance(position.x, position.y, player.position.x, player.position.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = player;
            }
        }
        if (nearest == null || nearestDist > APPROACH_RANGE) {
            return;
        }
        if (nearestDist <= APPROACH_KEEP_DISTANCE) {
            // 已足够近:不再靠近,保持自由游走
            return;
        }
        double dirX = (nearest.position.x - position.x) / nearestDist;
        double dirY = (nearest.position.y - position.y) / nearestDist;
        approachTarget = new Geometry.Vec2(
                nearest.position.x - dirX * APPROACH_KEEP_DISTANCE,
                nearest.position.y - dirY * APPROACH_KEEP_DISTANCE);
    }
}
