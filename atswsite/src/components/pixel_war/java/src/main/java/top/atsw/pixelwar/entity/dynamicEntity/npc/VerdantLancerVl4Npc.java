package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.PiercingBulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;

/**
 * 敌对 NPC「青翠枪骑兵」(由前端 TS 版 VerdantLancerVl4Entity 迁移)。
 *
 * <p>行为:<b>主动冲锋</b>型敌人 —— 无视随机游走,始终朝最近的玩家直线冲锋;
 * 一旦与目标的距离进入 {@link #CHARGE_FIRE_RANGE} 之内,便按节奏挺枪突刺,
 * 射出一发<b>穿甲弹</b>(可贯穿沿途多个目标)。</p>
 *
 * <p>等级差异:生命 3 + 1 × Level(升级即回满);掉落经验 exp = 4 + 2 × Level;
 * 突刺间隔随等级缩短(1.4 - 0.1 × Level 秒);每级移动速度 +25。</p>
 *
 * <p>战利品:子弹球(75%)+「扇面连射」技能球(20%)。</p>
 */
public class VerdantLancerVl4Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.12;
    /** NPC 类型显示名称 */
    public static final String NAME = "青翠枪骑兵";

    /** 主色调(青翠) */
    public static final String MAIN_COLOR = "#57C77A";
    /** 辉光/描边色(浅绿) */
    public static final String GLOW_COLOR = "#D6FFE0";

    /** 基准突刺间隔(秒) */
    public static final double ACTION_INTERVAL = 1.4;
    /** 每级缩短的突刺间隔(秒) */
    public static final double ACTION_INTERVAL_PER_LEVEL = 0.1;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 3;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 4;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 4;
    /** 每级移动速度增益(高于普通 NPC) */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 25;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 85;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 130;
    /** 进入该距离内才会挺枪突刺(px) */
    public static final double CHARGE_FIRE_RANGE = 260;

    /** 最近玩家位置(每帧由 update 解析;为空表示无目标) */
    private Geometry.Vec2 playerPosition = null;
    /** 突刺冷却剩余(秒) */
    private double actionCooldownRemaining = 0;

    public VerdantLancerVl4Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "verdant_lancer_vl4");
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.health = HEALTH_BASE;
        this.healthMax = HEALTH_BASE;
        this.killScore = KILL_SCORE;
        this.gameExp = BASE_GAME_EXP;
        this.mapColor = MAIN_COLOR;
        this.minMoveSpeed = MIN_MOVE_SPEED;
        this.maxMoveSpeed = MAX_MOVE_SPEED;
        this.speed = MIN_MOVE_SPEED;
        this.loot.add(new Loot("skillOrb", "fan_shoot_skill", 0.2));
        this.loot.add(new Loot("bulletOrb", "bullet_orb", 0.75));
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public String displayName() {
        return NAME;
    }

    /** 等级上限:5 */
    @Override
    public int maxLevel() {
        return 5;
    }

    /** 每级移动速度增益:枪骑兵 +25 */
    @Override
    protected double moveSpeedBonusPerLevel() {
        return MOVE_SPEED_BONUS_PER_LEVEL;
    }

    /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
    @Override
    protected void onNpcLevelApplied() {
        this.healthMax = HEALTH_BASE + HEALTH_PER_LEVEL * level;
        this.health = healthMax;
        this.gameExp = BASE_GAME_EXP + level * 2;
    }

    /** 当前突刺间隔(秒):随等级缩短,下限 0.5 秒 */
    private double actionInterval() {
        return Math.max(0.5, ACTION_INTERVAL - ACTION_INTERVAL_PER_LEVEL * level);
    }

    /** 覆盖移动目标:始终朝最近的玩家冲锋(允许弯曲路径绕开障碍) */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        Geometry.Vec2 playerPos = playerPosition;
        if (playerPos == null) {
            return false;
        }
        return super.setTarget(playerPos, world, false);
    }

    /** 每帧更新:解析最近玩家位置 → 被吸附时跟随主人,否则继续冲锋 */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        if (ownerId != null) {
            followOwner(world);
            return;
        }
        playerPosition = resolveNearestPlayerPosition(world);
        super.update(dt, world, config);
    }

    /** 解析最近的存活玩家位置(无玩家时返回 null) */
    private Geometry.Vec2 resolveNearestPlayerPosition(WorldView world) {
        Geometry.Vec2 nearest = null;
        double nearestDist = Double.MAX_VALUE;
        for (PlayerEntity player : world.players()) {
            if (player.isDead) {
                continue;
            }
            double dist = Geometry.distance(position.x, position.y, player.position.x, player.position.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = new Geometry.Vec2(player.position.x, player.position.y);
            }
        }
        return nearest;
    }

    /** 主循环:进入突刺距离后按节奏挺枪;距离过远时蓄势不开火 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        // 从者跟随主人时不再主动冲锋突刺,避免"跟着玩家乱刺"
        if (ownerId != null) {
            return;
        }
        Geometry.Vec2 target = playerPosition;
        if (target == null) {
            return;
        }
        double distance = Math.hypot(target.x - position.x, target.y - position.y);
        if (distance > CHARGE_FIRE_RANGE) {
            return;
        }
        actionCooldownRemaining -= getActionDelta(context.deltaTime);
        while (actionCooldownRemaining <= 0 && !isDead) {
            action(context);
            actionCooldownRemaining += actionInterval();
        }
    }

    /** 朝最近玩家方向挺枪突刺,射出一发穿甲弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 target = playerPosition;
        Geometry.Vec2 direction = target != null ? unitDirectionTo(target) : normalizedFacingDirection();
        double spawnDistance = width * 0.75;
        context.spawnBullet.accept(new PiercingBulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                "",
                getBulletMoveSpeed()));
    }

    /** 指向某点的归一化单位向量(重合时回退当前朝向) */
    private Geometry.Vec2 unitDirectionTo(Geometry.Vec2 target) {
        double dx = target.x - position.x;
        double dy = target.y - position.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            return normalizedFacingDirection();
        }
        return new Geometry.Vec2(dx / len, dy / len);
    }
}
