package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 敌对 NPC「CoralRedTentacleT1」(珊瑚红触手 t1,由 TS 版 CoralRedTentacleT1Entity 迁移)。
 *
 * <p>行为循环:移动 → 驻足 → 移动(与其他敌对 NPC 相同的普通随机游走)。</p>
 *
 * <p>攻击方式:本体自带一条「触手」攻击线段(生成时即存在,不是独立实体),</p>
 * <ul>
 *   <li>线段起点恒为<b>本体中心</b>,因此触手随本体移动而同步移动;</li>
 *   <li>线段以本体为中心<b>顺时针全向旋转</b>,初始方向<b>正西</b>,固定 2°/tick;</li>
 *   <li>线段长度随等级成长:Len = 100 + Level × 25(px);</li>
 *   <li>所有碰到线段的玩家实体:首次接触受 1 点伤害,持续接触每 10 tick 再受 1 点伤害
 *       (由 {@link top.atsw.pixelwar.world.World} 逐 tick 结算);</li>
 *   <li>特例:本 NPC 被吸附为从者时不会对主人玩家造成伤害(同队玩家同样不受伤)。</li>
 * </ul>
 *
 * <p>关于「旋转角度」的实现:本体只累计一个 tick 计数 {@link #tentacleTicks}
 * (每 tick +1,等价于"初始生成 tick 与当前 tick 的差值"),当前角度由该计数<b>派生</b>计算
 * (:angle = 180° - ticks × 2°),因此不需要每 tick 更新"旋转角度"字段,也不会累积浮点误差。
 * 该计数随快照下发,客户端据此绘制同一角度。</p>
 *
 * <p>渲染风格(由客户端 TS 版 {@code CoralRedTentacleT1Entity} 负责,服务端不做渲染):
 * 「像素热浪」——复古像素抖动。</p>
 * <ul>
 *   <li>触手由 3px 的方块串构成,边缘用确定性抖动的像素淡出,形成燃烧般的余烬;</li>
 *   <li>整条触手带横向热浪摆动,越靠末端摆幅越大,末端还有随时间向外飘散的火星;</li>
 *   <li>本体采用硬边描边 + 棋盘抖动高光,与复古像素美术保持一致;</li>
 *   <li>触手始终沿「本体中心 → 触手末端」的直线绘制,与权威判定完全一致。</li>
 * </ul>
 *
 * <p>等级差异:掉落经验 exp = 5 + Level;移动速度随等级提升(与其他敌对 NPC 相同,每级 +20);无子弹能力。</p>
 *
 * <p>战利品:不配置任何战利品(仅正常掉落经验球)。</p>
 */
public class CoralRedTentacleT1Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.22;
    /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
    public static final String NAME = "珊瑚红触手";

    /** 主色调 */
    public static final String MAIN_COLOR = "#D96C62";
    /** 辉光色调(同时作为描边色) */
    public static final String GLOW_COLOR = "#F9C8B2";

    /** 触手长度基准(px,等级 0) */
    public static final double TENTACLE_LENGTH_BASE = 100;
    /** 每级增加的触手长度(px) */
    public static final double TENTACLE_LENGTH_PER_LEVEL = 25;
    /** 触手旋转角速度(度/tick):顺时针,1 tick = 20ms → 相当于 100°/秒 */
    public static final double TENTACLE_ROTATION_DEG_PER_TICK = 2;
    /** 触手初始方向(度,世界坐标 y 轴向上):180° 即正西 */
    public static final double TENTACLE_INITIAL_ANGLE_DEG = 180;
    /** 触手判定半宽(px) */
    public static final double TENTACLE_HALF_WIDTH = 4;
    /** 触手首次接触伤害 / 持续接触单次伤害(点) */
    public static final double TENTACLE_DAMAGE = 1;
    /** 触手持续接触的结算间隔(tick):每累计 10 tick 再造成 1 点伤害 */
    public static final int TENTACLE_CONTACT_TICK_INTERVAL = 10;

    /** 基础掉落经验值(exp = 5 + Level) */
    private static final double BASE_GAME_EXP = 5;
    /** 击杀获得的分数 */
    private static final int KILL_SCORE = 5;

    /**
     * 触手旋转相位(tick 计数)。
     *
     * <p>由权威端每 tick +1;当前角度由 {@link #tentacleAngleDeg()} 派生计算,不直接存储角度。</p>
     * <p>该字段随快照下发(多人模式),客户端据此绘制与权威判定完全一致的角度。</p>
     */
    public int tentacleTicks;

    public CoralRedTentacleT1Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "coral_red_tentacle_t1");
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.health = 1;
        this.healthMax = 1;
        this.killScore = KILL_SCORE;
        this.gameExp = BASE_GAME_EXP;
        this.mapColor = MAIN_COLOR;
        // 不配置战利品:击杀后仅正常掉落经验球(掉落经验 = 5 + Level)
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public String displayName() {
        return NAME;
    }

    /** 等级上限:2(与其他上限 2 的 NPC 共用 3 档等级概率表) */
    @Override
    public int maxLevel() {
        return 2;
    }

    /** 等级变化时重算等级相关属性:掉落经验随等级提升(exp = 5 + Level) */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = BASE_GAME_EXP + level;
    }

    /** 主循环:移动 → 驻足 → 移动。触手命中结算由 World 逐 tick 处理,这里无需动作 */
    @Override
    public void actionLoop(ActionContext context) {
        // 无动作:本体不自发产生任何攻击实体
    }

    // ==================================================================
    // 触手(攻击线段)
    // ==================================================================

    /** 当前等级的触手长度(px):Len = 100 + Level × 25 */
    public double tentacleLength() {
        return TENTACLE_LENGTH_BASE + TENTACLE_LENGTH_PER_LEVEL * level;
    }

    /**
     * 当前触手角度(度,世界坐标 y 轴向上)。
     *
     * <p>由"累计 tick 计数"派生:初始 180°(正西),每 tick 顺时针 2°(角度递减)。</p>
     */
    public double tentacleAngleDeg() {
        return TENTACLE_INITIAL_ANGLE_DEG - tentacleTicks * TENTACLE_ROTATION_DEG_PER_TICK;
    }

    /** 触手单位方向向量(世界坐标) */
    public Geometry.Vec2 tentacleDirection() {
        double rad = Math.toRadians(tentacleAngleDeg());
        return new Geometry.Vec2(Math.cos(rad), Math.sin(rad));
    }

    /** 触手线段终点(世界坐标):起点 = 本体中心,终点 = 起点 + 方向 × 当前长度 */
    public Geometry.Vec2 tentacleEnd() {
        Geometry.Vec2 direction = tentacleDirection();
        double length = tentacleLength();
        return new Geometry.Vec2(
                position.x + direction.x * length,
                position.y + direction.y * length);
    }

    // ==================================================================
    // 每帧更新
    // ==================================================================

    /**
     * 每帧更新:
     * <ol>
     *   <li>推进触手旋转相位(仅累计 tick 计数,角度由该计数派生);</li>
     *   <li>被玩家吸附时锁定在主人的从者网格格子上,不自行游走;</li>
     *   <li>无主时走常规随机游走逻辑。</li>
     * </ol>
     */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }

        // 触手持续旋转:只累计 tick 计数,不需要每 tick 记录/更新角度
        tentacleTicks++;

        if (ownerId != null) {
            // 从者:瞬移到主人分配的格子中心,不参与游走(触手仍随本体一起移动)
            followOwner(world);
            return;
        }

        super.update(dt, world, config);
    }

    /** 从者不参与游走目标分配 */
    @Override
    public boolean canGetNewWanderTarget(double dt, WorldView world) {
        if (ownerId != null) {
            return false;
        }
        return super.canGetNewWanderTarget(dt, world);
    }

    /** 从者不参与"长时间未位移"的重新寻路看门狗 */
    @Override
    public boolean updateNoMovementWatchdog(double dt) {
        if (ownerId != null) {
            return false;
        }
        return super.updateNoMovementWatchdog(dt);
    }
}
