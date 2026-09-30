package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;

/**
 * 白像素(由前端 TS 版 WhitePixelEntity 迁移)。
 *
 * <p>无主时"边移动边射击"(沿当前朝向发射,每秒 1 发);成为从者后不再受移动条件限制。</p>
 */
public class WhitePixelNpc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.8;
    /** 射击间隔(秒) */
    protected static final double ACTION_INTERVAL = 1;

    private boolean actionLoopRunning;
    private double actionCooldownRemaining;

    public WhitePixelNpc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "white_pixel");
        this.fillColor = "#ffffff";
        this.strokeColor = "#bebebe";
        this.health = 1;
        this.healthMax = 1;
        this.killScore = 1;
        this.mapColor = "#ffffff";
        this.gameExp = 2;
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public void actionLoop(ActionContext context) {
        if (ownerId == null) {
            // 普通情况下只能在移动时射击
            if (isDead || !isMoving) {
                actionLoopRunning = false;
                return;
            }
            if (!actionLoopRunning) {
                actionLoopRunning = true;
                action(context);
                actionCooldownRemaining = ACTION_INTERVAL;
                return;
            }
            actionCooldownRemaining -= context.deltaTime;
            while (actionCooldownRemaining <= 0 && isMoving && !isDead) {
                action(context);
                actionCooldownRemaining += ACTION_INTERVAL;
            }
        } else {
            // 被玩家吸附情况下不考虑移动的条件
            if (isDead) {
                actionLoopRunning = false;
                return;
            }
            if (!actionLoopRunning) {
                actionLoopRunning = true;
                action(context);
                actionCooldownRemaining = ACTION_INTERVAL;
                return;
            }
            actionCooldownRemaining -= context.deltaTime;
            while (actionCooldownRemaining <= 0 && !isDead) {
                action(context);
                actionCooldownRemaining += ACTION_INTERVAL;
            }
        }
    }

    /** 沿当前朝向发射一颗子弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = normalizedFacingDirection();
        double spawnDistance = width * 0.6;
        String bulletColor = bulletColorOf(context);
        context.spawnBullet.accept(new BulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                "",
                bulletColor));
    }

    /** 每帧更新:有主时跟随主人,无主时按父类逻辑游走 */
    @Override
    public void update(double dt, WorldView world, top.atsw.pixelwar.core.GameConfig config) {
        if (ownerId != null) {
            followOwner(world);
            updateDamageEffect(dt);
            updateDeathEffect(dt);
            return;
        }
        super.update(dt, world, config);
    }
}
