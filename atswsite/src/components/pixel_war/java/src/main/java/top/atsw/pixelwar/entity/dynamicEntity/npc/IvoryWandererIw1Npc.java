package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PiercingBulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;

/**
 * 象牙游荡者(由前端 TS 版 IvoryWandererIw1Entity 迁移)。
 *
 * <p>行为:<b>和平游荡</b> —— 不会主动攻击任何人。</p>
 *
 * <p><b>关键特性:被打会记仇并主动追击。</b>一旦受到任意伤害(见 {@link #applyDamage} 覆写),
 * 它会立刻"激怒",<b>锁定本次伤害的来源实体</b>并一路追击:</p>
 * <ul>
 *   <li>移动:以仇家当前位置为移动目标(允许弯曲路径绕开障碍),不再随机游荡;</li>
 *   <li>攻击:按固定节奏朝<b>仇家方向</b>发射穿甲弹(可贯穿多个目标);</li>
 *   <li>仇家死亡/离开世界后放弃追击并<b>恢复中立</b>,回到和平游荡;</li>
 * </ul>
 * <p><b>激怒与从者状态互斥(硬性规则):</b>激怒期间不会被任何玩家吸附为从者
 * (见 {@link #canBeAbsorbedAsServant()});若在成为从者之后被击伤,则立即解除激怒回到中立。</p>
 * <p>激怒后外观会转为亮红脉动描边作为警告;失去仇家即解除,再次被击伤会重新激怒。</p>
 *
 * <p>等级差异:生命 4 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 激怒后的射击间隔随等级缩短(2.0 - 0.2 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
public class IvoryWandererIw1Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.06;
    /** NPC 类型显示名称 */
    public static final String NAME = "象牙游荡者";

    /** 主色调(象牙白) */
    public static final String MAIN_COLOR = "#F3EEDB";
    /** 和平状态描边色 */
    public static final String GLOW_COLOR = "#C8BC9A";

    /** 基准生命值 */
    public static final double HEALTH_BASE = 4;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 3;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 3;
    /** 每级移动速度增益 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 55;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 85;
    /** 激怒后的基准射击间隔(秒) */
    public static final double ENRAGED_INTERVAL = 2;
    /** 每级缩短的射击间隔(秒) */
    public static final double ENRAGED_INTERVAL_PER_LEVEL = 0.2;
    /** 与仇家保持的弹性距离(px):过远则逼近、过近则后撤 */
    public static final double STANDOFF_DISTANCE = 120;
    /** 弹性距离的容差(px):偏差在容差内即原地射击,避免不断抽撞 */
    public static final double STANDOFF_DEADZONE = 25;
    /** 追击时的重新寻路间隔(秒),避免每帧重建路径 */
    public static final double CHASE_RETARGET_INTERVAL = 0.2;

    /** 是否已被激怒(受到过伤害) */
    public boolean enraged = false;
    /** 激怒后的射击冷却剩余(秒) */
    private double actionCooldownRemaining = 0;
    /** 仇家实体 id(激怒时锁定本次伤害来源;为空表示无追击目标) */
    private Long enemyId = null;
    /** 仇家当前位置(每帧由 update 解析;为空表示不追击) */
    private Geometry.Vec2 enemyPosition = null;
    /** 追击时的重新寻路冷却剩余(秒) */
    private double chaseRetargetCooldown = 0;

    public IvoryWandererIw1Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "neutral", 0, "ivory_wanderer_iw1");
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

    /**
     * 追击:激怒且仇家仍在时,忽略外部下发的游走目标,改为以<b>弹性站位点</b>为移动目标
     * (允许弯曲路径以绕开障碍),从而与仇家保持 {@link #STANDOFF_DISTANCE} 附近的距离。
     */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        Geometry.Vec2 enemyPos = enemyPosition;
        if (enemyPos != null) {
            return super.setTarget(standoffPoint(enemyPos), world, false);
        }
        return super.setTarget(target, world, preferStraight);
    }

    /**
     * 弹性站位点:以仇家为圆心、沿「仇家 → 自己」方向、距离为 {@link #STANDOFF_DISTANCE} 的点。
     *
     * <p>离仇家过远时该点落在两者之间(于是向前逼近),过近时落在更外侧(于是后撤),
     * 于是与自己位置的偏差 |d - STANDOFF| 被逐步消化,形成有弹性的站位距离。</p>
     */
    private Geometry.Vec2 standoffPoint(Geometry.Vec2 enemyPos) {
        double dx = position.x - enemyPos.x;
        double dy = position.y - enemyPos.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            // 与仇家完全重合:退化为朝当前朝向的反方向后撤
            Geometry.Vec2 back = normalizedFacingDirection();
            return new Geometry.Vec2(enemyPos.x - back.x * STANDOFF_DISTANCE,
                    enemyPos.y - back.y * STANDOFF_DISTANCE);
        }
        return new Geometry.Vec2(enemyPos.x + (dx / len) * STANDOFF_DISTANCE,
                enemyPos.y + (dy / len) * STANDOFF_DISTANCE);
    }

    /**
     * 激怒状态下拒绝被任何玩家吸附为从者(<b>硬性规则</b>)。
     * 由吸附逻辑统一门禁,单人(Worker)与多人(Java)两侧行为一致。
     */
    @Override
    public boolean canBeAbsorbedAsServant() {
        return !enraged;
    }

    /**
     * 受伤即"记仇":把和平状态切换为激怒,并锁定本次伤害的来源实体作为仇家。
     *
     * <p>仇家被击败或离开世界后由 {@link #resolveEnemyPosition} 恢复中立(再次被击伤会重新激怒)。</p>
     *
     * <p>来源 id 由权威端在结算伤害前写入 {@code DynamicEntity.lastDamagerId}
     * (见 {@code World.applyBulletDamage}),因此这里直接读取即可。</p>
     */
    @Override
    public void applyDamage(double amount) {
        super.applyDamage(amount);
        if (isDead || amount <= 0) {
            return;
        }
        enraged = true;
        Long attackerId = lastDamagerId;
        if (attackerId != null && attackerId != id) {
            enemyId = attackerId;
        }
    }

    /** 激怒后的射击间隔(秒):随等级缩短,下限 0.5 秒 */
    private double actionInterval() {
        return Math.max(0.5, ENRAGED_INTERVAL - ENRAGED_INTERVAL_PER_LEVEL * level);
    }

    /** 主循环:和平状态下什么都不做;激怒后按节奏发射穿甲弹 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead || !enraged) {
            return;
        }
        actionCooldownRemaining -= getActionDelta(context.deltaTime);
        while (actionCooldownRemaining <= 0 && !isDead) {
            action(context);
            actionCooldownRemaining += actionInterval();
        }
    }

    /** 朝<b>仇家方向</b>发射一发穿甲弹(无仇家时退回当前朝向) */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = shotDirection();
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

    /** 射击方向:优先瞬向仇家,无仇家时退回当前朝向 */
    private Geometry.Vec2 shotDirection() {
        Geometry.Vec2 enemyPos = enemyPosition;
        if (enemyPos == null) {
            return normalizedFacingDirection();
        }
        double dx = enemyPos.x - position.x;
        double dy = enemyPos.y - position.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            return normalizedFacingDirection();
        }
        return new Geometry.Vec2(dx / len, dy / len);
    }

    /** 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上;否则解析仇家并走追击/游走 */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        if (ownerId != null) {
            // 从者由主人网格控制、不参与追击:与「激怒」互斥,这里恢复中立
            revertToNeutral();
            followOwner(world);
            return;
        }
        if (enraged) {
            // 激怒后:每帧定位仇家,并朝弹性站位点重新寻路(仇家消失则在此恢复中立)
            enemyPosition = resolveEnemyPosition(world);
            refreshChaseRetarget(dt, world);
        } else {
            enemyPosition = null;
        }
        super.update(dt, world, config);
    }

    /**
     * 追击寻路:与仇家的距离偏差超出弹性容差时,按固定间隔重新下发目标
     * (setTarget 覆写会把它改写为弹性站位点),避免每帧重建路径。
     */
    private void refreshChaseRetarget(double dt, WorldView world) {
        Geometry.Vec2 enemyPos = enemyPosition;
        if (enemyPos == null) {
            chaseRetargetCooldown = 0;
            return;
        }
        double distance = Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y);
        if (Math.abs(distance - STANDOFF_DISTANCE) <= STANDOFF_DEADZONE) {
            // 已在弹性区间内:原地射击,不再调整站位
            chaseRetargetCooldown = 0;
            return;
        }
        chaseRetargetCooldown -= dt;
        if (chaseRetargetCooldown > 0) {
            return;
        }
        chaseRetargetCooldown = CHASE_RETARGET_INTERVAL;
        setTarget(enemyPos, world, false);
    }

    /**
     * 解析仇家当前位置:依次在玩家 / NPC 列表中按 id 查找。
     *
     * <p>仇家死亡或被移出世界时清除锁定并<b>恢复中立</b>(停止追击与射击,回到和平游荡;
     * 此后再次被击伤会重新激怒)。无仇家可追时同样恢复中立。</p>
     */
    private Geometry.Vec2 resolveEnemyPosition(WorldView world) {
        Long targetId = enemyId;
        if (targetId == null) {
            revertToNeutral();
            return null;
        }
        for (PlayerEntity player : world.players()) {
            if (!targetId.equals(player.id)) {
                continue;
            }
            if (player.isDead) {
                break;
            }
            return new Geometry.Vec2(player.position.x, player.position.y);
        }
        for (DynamicEntity npc : world.npcEntities()) {
            if (!targetId.equals(npc.id)) {
                continue;
            }
            if (npc.isDead) {
                break;
            }
            return new Geometry.Vec2(npc.position.x, npc.position.y);
        }
        // 仇家已消失(死亡/被移出世界):放弃追击并恢复中立
        revertToNeutral();
        return null;
    }

    /** 解除激怒,回到中立游荡状态(清除仇家锁定与追击目标) */
    private void revertToNeutral() {
        enraged = false;
        enemyId = null;
        enemyPosition = null;
    }
}
