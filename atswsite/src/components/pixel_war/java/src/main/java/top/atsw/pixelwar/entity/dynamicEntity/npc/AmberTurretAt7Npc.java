package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.SniperBulletEntity;

/**
 * 琥珀炮台(由前端 TS 版 AmberTurretAt7Entity 迁移)。
 *
 * <p>行为:几乎不移动的<b>重型炮台</b> —— 以极低的移动速度小幅游走,
 * 不依赖"移动时才开火"的限制,而是按固定节奏朝当前朝向射出一发型穿甲狙击弹。</p>
 *
 * <p>等级差异:生命 6 + 2 × Level(升级即回满);掉落经验 exp = 6 + 2 × Level;
 * 射击间隔随等级缩短(2.4 - 0.4 × Level 秒);每级移动速度仅 +5(远低于普通 NPC 的 +20)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
public class AmberTurretAt7Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.09;
    /** NPC 类型显示名称 */
    public static final String NAME = "琥珀炮台";

    /** 主色调(琥珀) */
    public static final String MAIN_COLOR = "#E8A33D";
    /** 辉光/描边色 */
    public static final String GLOW_COLOR = "#FFE0A3";

    /** 基准射击间隔(秒) */
    public static final double ACTION_INTERVAL = 2.4;
    /** 每级缩短的射击间隔(秒) */
    public static final double ACTION_INTERVAL_PER_LEVEL = 0.4;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 6;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 2;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 6;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 6;
    /** 每级移动速度增益(远低于普通 NPC) */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 5;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 30;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 40;

    /** 射击冷却剩余(秒) */
    private double actionCooldownRemaining = 0;

    public AmberTurretAt7Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "amber_turret_at7");
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
        // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
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

    /** 等级上限:2 */
    @Override
    public int maxLevel() {
        return 2;
    }

    /** 每级移动速度增益:炮台只有 +5,远低于普通 NPC 的 +20 */
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

    /** 当前射击间隔(秒):随等级缩短,下限 0.6 秒 */
    private double actionInterval() {
        return Math.max(0.6, ACTION_INTERVAL - ACTION_INTERVAL_PER_LEVEL * level);
    }

    /** 主循环:炮台不受"移动中才能射击"限制,只要存活就按固定节奏持续开火 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        actionCooldownRemaining -= getActionDelta(context.deltaTime);
        while (actionCooldownRemaining <= 0 && !isDead) {
            action(context);
            actionCooldownRemaining += actionInterval();
        }
    }

    /** 朝当前朝向发射一发型穿甲狙击弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = normalizedFacingDirection();
        double spawnDistance = width * 0.75;
        context.spawnBullet.accept(new SniperBulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                ""));
    }

    /** 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上,否则走常规游走 */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        if (ownerId != null) {
            followOwner(world);
            return;
        }
        super.update(dt, world, config);
    }
}
