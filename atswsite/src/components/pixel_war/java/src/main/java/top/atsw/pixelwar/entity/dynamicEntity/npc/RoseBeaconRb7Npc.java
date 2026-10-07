package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;

/**
 * 友好 NPC「蔷薇信标」(由前端 TS 版 RoseBeaconRb7Entity 迁移)。
 *
 * <p>行为:<b>和平游走 + 周期群体治疗</b> —— 每隔固定时间向外扩散一圈治疗脉冲,
 * 一次性为范围内<b>所有</b>受伤的玩家(含主人/队友)各恢复若干点生命,
 * 治疗量不会超过各自的生命上限。</p>
 *
 * <p>与「青玉再生者 cm9」的区别:cm9 是"单体、慢速、大治疗量"(只治血量比例最低的一人),
 * rb7 是"群体、快速、小治疗量"(范围内所有受伤玩家一起回血),二者定位互补。</p>
 *
 * <p>等级差异:治疗间隔随等级缩短(3.0 - 0.3 × Level 秒);治疗范围随等级扩大
 * (160 + 20 × Level px);每次治疗量 1 + (Level ≥ 1 ? 1 : 0)(最高 2 点)。</p>
 *
 * <p>战利品:不掉落任何战利品(友好 NPC)。</p>
 */
public class RoseBeaconRb7Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.06;
    /** NPC 类型显示名称 */
    public static final String NAME = "蔷薇信标";

    /** 主色调(蔷薇粉) */
    public static final String MAIN_COLOR = "#E86A9B";
    /** 辉光/描边色 */
    public static final String GLOW_COLOR = "#FFD3E4";

    /** 基准治疗间隔(秒) */
    public static final double HEAL_INTERVAL = 3;
    /** 每级缩短的治疗间隔(秒) */
    public static final double HEAL_INTERVAL_PER_LEVEL = 0.3;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 4;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 2;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 2;
    /** 每级移动速度增益 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 45;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 70;
    /** 基准治疗范围(px) */
    public static final double HEAL_RANGE_BASE = 160;
    /** 每级增加的治疗范围(px) */
    public static final double HEAL_RANGE_PER_LEVEL = 20;
    /** 基准每次治疗量(点) */
    public static final double HEAL_AMOUNT_BASE = 1;

    /** 治疗冷却剩余(秒) */
    private double healCooldownRemaining = 0;
    /** 本次治疗特效剩余时长(秒):随快照下发给客户端用于绘制脉冲环 */
    public double healPulseTimer = 0;

    public RoseBeaconRb7Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "friendly", 0, "rose_beacon_rb7");
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

    /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
    @Override
    protected void onNpcLevelApplied() {
        this.healthMax = HEALTH_BASE + HEALTH_PER_LEVEL * level;
        this.health = healthMax;
        this.gameExp = BASE_GAME_EXP + level * 2;
    }

    /** 当前治疗间隔(秒):随等级缩短,下限 1.0 秒 */
    private double healInterval() {
        return Math.max(1, HEAL_INTERVAL - HEAL_INTERVAL_PER_LEVEL * level);
    }

    /** 当前治疗范围(px):随等级扩大 */
    public double healRange() {
        return HEAL_RANGE_BASE + HEAL_RANGE_PER_LEVEL * level;
    }

    /** 当前单次治疗量(点):1 级起 +1(最高 2 点) */
    private double healAmount() {
        return HEAL_AMOUNT_BASE + (level >= 1 ? 1 : 0);
    }

    /** 主循环:按节奏为范围内所有受伤玩家治疗 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        if (healPulseTimer > 0) {
            healPulseTimer = Math.max(0, healPulseTimer - context.deltaTime);
        }
        healCooldownRemaining -= getActionDelta(context.deltaTime);
        while (healCooldownRemaining <= 0 && !isDead) {
            action(context);
            healCooldownRemaining += healInterval();
        }
    }

    /** 治疗范围内所有受伤玩家(各自的治疗量不超过其生命上限) */
    public void action(ActionContext context) {
        double range = healRange();
        double rangeSq = range * range;
        boolean healedAny = false;
        for (PlayerEntity player : context.players) {
            if (player.isDead || player.health >= player.healthMax) {
                continue;
            }
            double dx = player.position.x - position.x;
            double dy = player.position.y - position.y;
            if (dx * dx + dy * dy > rangeSq) {
                continue;
            }
            double healed = Math.min(healAmount(), player.healthMax - player.health);
            if (healed <= 0) {
                continue;
            }
            player.health += healed;
            healedAny = true;
        }
        if (healedAny) {
            healPulseTimer = 0.4;
        }
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
