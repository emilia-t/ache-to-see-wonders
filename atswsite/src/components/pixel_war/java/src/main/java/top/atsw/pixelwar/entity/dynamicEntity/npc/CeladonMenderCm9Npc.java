package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;

/**
 * 青玉再生者(由前端 TS 版 CeladonMenderCm9Entity 迁移)。
 *
 * <p>行为:<b>和平游走 + 周期治疗</b> —— 每隔固定时间,自动为<b>范围内生命值比例最低的</b>
 * 玩家恢复若干点生命,治疗量不会超过其生命上限。</p>
 *
 * <p>等级差异:治疗量 1 + (Level ≥ 1 ? 1 : 0);治疗间隔随等级缩短(4.0 - 0.5 × Level 秒);
 * 治疗范围随等级略微扩大。</p>
 *
 * <p>战利品:不掉落任何战利品(友好 NPC)。</p>
 */
public class CeladonMenderCm9Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.07;
    /** NPC 类型显示名称 */
    public static final String NAME = "青玉再生者";

    /** 主色调(青瓷绿) */
    public static final String MAIN_COLOR = "#7FD6B0";
    /** 辉光/描边色 */
    public static final String GLOW_COLOR = "#D8FFF0";

    /** 基准治疗间隔(秒) */
    public static final double HEAL_INTERVAL = 4;
    /** 每级缩短的治疗间隔(秒) */
    public static final double HEAL_INTERVAL_PER_LEVEL = 0.5;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 3;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 2;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 2;
    /** 每级移动速度增益 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 50;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 75;
    /** 基准治疗范围(px) */
    public static final double HEAL_RANGE_BASE = 140;
    /** 每级增加的治疗范围(px) */
    public static final double HEAL_RANGE_PER_LEVEL = 30;
    /** 基准每次治疗量(点) */
    public static final double HEAL_AMOUNT_BASE = 1;

    /** 治疗冷却剩余(秒) */
    private double healCooldownRemaining = 0;
    /** 本次治疗特效剩余时长(秒,随快照下发供客户端绘制) */
    public double healFlashTimer = 0;

    public CeladonMenderCm9Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "friendly", 0, "celadon_mender_cm9");
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
        // 友好 NPC 不掉落任何战利品
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

    /** 每级移动速度增益(与普通 NPC 一致) */
    @Override
    protected double moveSpeedBonusPerLevel() {
        return MOVE_SPEED_BONUS_PER_LEVEL;
    }

    /** 等级变化时重算掉落经验 */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = BASE_GAME_EXP + level * 2;
    }

    /** 当前治疗间隔(秒):随等级缩短,下限 1.0 秒 */
    private double healInterval() {
        return Math.max(1, HEAL_INTERVAL - HEAL_INTERVAL_PER_LEVEL * level);
    }

    /** 当前治疗范围(px):随等级略微扩大 */
    private double healRange() {
        return HEAL_RANGE_BASE + HEAL_RANGE_PER_LEVEL * level;
    }

    /** 当前单次治疗量(点):1 级起 +1(最高 2 点) */
    private double healAmount() {
        return HEAL_AMOUNT_BASE + (level >= 1 ? 1 : 0);
    }

    /** 主循环:按节奏治疗范围内生命值比例最低的受伤玩家 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        if (healFlashTimer > 0) {
            healFlashTimer = Math.max(0, healFlashTimer - context.deltaTime);
        }
        healCooldownRemaining -= getActionDelta(context.deltaTime);
        while (healCooldownRemaining <= 0 && !isDead) {
            action(context);
            healCooldownRemaining += healInterval();
        }
    }

    /** 治疗范围内生命值比例最低的受伤玩家(治疗量不超过其生命上限) */
    public void action(ActionContext context) {
        if (context.players == null) {
            return;
        }
        double range = healRange();
        double rangeSq = range * range;
        PlayerEntity target = null;
        double targetRatio = 1;
        double targetDistSq = Double.MAX_VALUE;

        for (PlayerEntity player : context.players) {
            if (player.isDead || player.health >= player.healthMax) {
                continue;
            }
            double dx = player.position.x - position.x;
            double dy = player.position.y - position.y;
            double distSq = dx * dx + dy * dy;
            if (distSq > rangeSq) {
                continue;
            }
            // 优先治疗"血量比例最低"的玩家;并列时取更近的
            double ratio = player.healthMax > 0 ? player.health / player.healthMax : 1;
            if (ratio < targetRatio || (ratio == targetRatio && distSq < targetDistSq)) {
                target = player;
                targetRatio = ratio;
                targetDistSq = distSq;
            }
        }

        if (target == null) {
            return;
        }
        double healed = Math.min(healAmount(), target.healthMax - target.health);
        if (healed <= 0) {
            return;
        }
        target.health += healed;
        healFlashTimer = 0.35;
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
