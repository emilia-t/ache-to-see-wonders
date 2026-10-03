package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BombEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;

/**
 * 红像素(由前端 TS 版 RedPixelEntity 迁移)。
 *
 * <p>自走爆炸敌人:向玩家移动,靠近到爆炸范围时立刻引爆(在自己的位置生成一枚延迟炸弹后自毁);
 * 若被其他方式击杀,死亡时同样生成炸弹。击杀获得 3 分,不掉落战利品。</p>
 */
public class RedPixelNpc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.1;
    /** 进入此距离直接爆炸(px) */
    private static final double EXPLODE_RANGE = 60;
    /** 进入此距离开始预警(px) */
    private static final double WARN_RANGE = 140;

    /** 是否已经生成过炸弹(防止重复生成) */
    private boolean hasSpawnedDeathBomb;
    /** 是否处于预警(闪烁)状态 */
    public boolean isFlashing;
    /** 当前追踪的玩家位置(无存活玩家时为 null) */
    private Geometry.Vec2 playerPosition;

    public RedPixelNpc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "red_pixel");
        this.fillColor = "#ff1313";
        this.strokeColor = "#444444";
        this.health = 1;
        this.healthMax = 1;
        this.killScore = 3;
        this.mapColor = "#ff1313";
        this.gameExp = 4; // 基础经验值(4 + Level × 4)
        // 战利品:红像素(自走爆炸)不掉落任何战利品
    }

    /** 等级上限:2 */
    @Override
    public int maxLevel() {
        return 2;
    }

    /** 每级移动速度增益:红像素为 40(其余 NPC 为 20) */
    @Override
    protected double moveSpeedBonusPerLevel() {
        return 40;
    }

    /** 等级变化时重算等级相关属性(经验值随等级提升) */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = 4 + level * 4;
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    /** 每帧更新:追踪最近的存活玩家并判断是否进入预警/引爆范围 */
    @Override
    public void update(double dt, WorldView world, top.atsw.pixelwar.core.GameConfig config) {
        if (isDead) {
            return;
        }
        if (ownerId != null) {
            followOwner(world);
            updateDamageEffect(dt);
            updateDeathEffect(dt);
            return;
        }

        PlayerEntity target = nearestAlivePlayer(world);
        if (target == null) {
            super.update(dt, world, config);
            return;
        }
        playerPosition = target.position.copy();
        double distToPlayer = Geometry.distance(position.x, position.y, playerPosition.x, playerPosition.y);
        isFlashing = distToPlayer <= WARN_RANGE && distToPlayer > EXPLODE_RANGE;
        if (distToPlayer > EXPLODE_RANGE) {
            setTarget(playerPosition, world, false);
        }
        super.update(dt, world, config);
    }

    /** 到达爆炸范围则引爆;被击杀时在死亡结算中生成炸弹 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead || context.spawnBomb == null) {
            return;
        }
        if (ownerId != null) {
            return;
        }
        if (playerPosition == null) {
            return;
        }
        double distToPlayer = Geometry.distance(position.x, position.y, playerPosition.x, playerPosition.y);
        if (distToPlayer <= EXPLODE_RANGE) {
            spawnDeathBomb(context, ownerId, teamId);
            // 引爆:立即完成死亡(无死亡特效)
            this.isDead = true;
            this.deathEffectTimer = 0;
        }
    }

    /**
     * 死亡特效结算钩子:被击杀时同样生成一枚炸弹(对应 TS 版 RedPixelEntity.hasSpawnedDeathBomb)。
     */
    public void onDeathEffects(ActionContext context) {
        if (isDead) {
            spawnDeathBomb(context, ownerId, teamId);
        }
    }

    private void spawnDeathBomb(ActionContext context, Long bombOwnerId, Long bombTeamId) {
        if (hasSpawnedDeathBomb || context.spawnBomb == null) {
            return;
        }
        hasSpawnedDeathBomb = true;
        context.spawnBomb.accept(new BombEntity(position.copy(), bombOwnerId, bombTeamId));
    }

    private PlayerEntity nearestAlivePlayer(WorldView world) {
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
        return nearest;
    }
}
