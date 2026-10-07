package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;
import top.atsw.pixelwar.game.Inventory;
import top.atsw.pixelwar.game.Research;
import top.atsw.pixelwar.game.Skill;
import top.atsw.pixelwar.registry.ItemDefinition;
import top.atsw.pixelwar.registry.ItemRegistry;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 玩家实体(由前端 TS 版 class/Entity/DynamicEntity/PlayerDynamicEntity 迁移)。
 *
 * <p>包含 WASD 移动、疾跑体力、闪避无敌、从者网格(吸附 NPC)、背包与技能、
 * 等级/经验/击杀积分以及死亡结算。</p>
 */
public final class PlayerEntity extends DynamicEntity {

    public static final double WIDTH = 25;
    public static final double HEIGHT = 25;
    public static final double MOVE_SPEED = 410;
    public static final double MIN_MOVE_SPEED = 50;
    /** 玩家生命值上限 */
    public static final double HEALTH_MAX = 10;
    /** 出生时的默认当前子弹数 */
    public static final int BASE_BULLET_COUNT = 50;
    /** 出生时的默认最大子弹数 */
    public static final int BASE_BULLET_MAX = 50;
    /** 玩家移动阻尼,值越大松手后减速越快 */
    public static final double MOTION_DAMPING = 8.5;
    /** 玩家转向响应,值越大移动转向越跟手 */
    public static final double MOTION_TURN_RESPONSE = 10.5;

    /** 单次闪避距离(px) */
    public static final double DODGE_DISTANCE = 300;
    /** 闪避位移持续时间(秒) */
    public static final double DODGE_SLIDE_DURATION = 0.2;

    /** 疾跑速度倍率(相对基础移动速度) */
    public static final double SPRINT_SPEED_MULTIPLIER = 1.6;
    /** 疾跑体力消耗速率(点/秒) */
    public static final double SPRINT_STAMINA_DRAIN_PER_SECOND = 30;
    /** 非疾跑体力恢复速率(点/秒) */
    public static final double STAMINA_RECOVER_PER_SECOND = 15;
    /** 体力低于该值时疾跑开始逐渐减速 */
    public static final double SPRINT_LOW_STAMINA_THRESHOLD = 20;
    /** 体力高于该值时才能(重新)开始疾跑 */
    public static final double SPRINT_START_MIN_STAMINA = 20;
    /** 体力完全耗尽后的恢复延迟(秒) */
    public static final double STAMINA_EXHAUST_RECOVERY_DELAY = 5;
    /** 基础开火冷却(秒),实际冷却由专研(射速/冷却)在此基础上缩放 */
    public static final double BASE_FIRE_COOLDOWN = 0.5;
    /** 基础体力上限(未叠加专研前) */
    public static final double BASE_STAMINA_MAX = 100;
    /** 死亡掉落经验系数:按(等级折算总经验 + 当前经验)的该比例掉落 */
    public static final double DEATH_DROP_COEFFICIENT = 0.6;
    /** 单次死亡掉落经验的上限(避免高等级玩家爆炸式掉落导致卡顿) */
    public static final double DEATH_DROP_EXP_MAX = 215;
    /** 复活等待时间基准(秒):X = 3 + 等级 / 3 */
    public static final int RESPAWN_DELAY_BASE_SECONDS = 3;
    /** 复活等待时间的等级除数(等级 / 该值向下取整) */
    public static final int RESPAWN_DELAY_LEVEL_DIVISOR = 3;
    /** 复活等待时间上限(秒) */
    public static final int RESPAWN_DELAY_MAX_SECONDS = 30;
    /** 玩家脱离地图范围后,每受到 1 点伤害所需的游戏刻数 */
    public static final int OUT_OF_MAP_TICKS_PER_DAMAGE = 10;
    /** 玩家脱离地图范围后,每次结算受到的伤害值 */
    public static final double OUT_OF_MAP_DAMAGE = 1;
    /** 玩家脱离地图范围致死时,死亡界面展示的击杀者名称 */
    public static final String OUT_OF_MAP_KILLER_NAME = "地图边界";

    /** 从者网格边长(15 × 15,中心格 (7,7) 为玩家本体不可占用) */
    public static final int SERVANT_GRID_SIZE = 15;
    private static final int SERVANT_GRID_CENTER = 7;

    /** 玩家按键状态(由客户端 move_input 指令刷新) */
    public static final class MoveState {
        public boolean w;
        public boolean a;
        public boolean s;
        public boolean d;
        public boolean shift;

        public void set(boolean w, boolean a, boolean s, boolean d, boolean shift) {
            this.w = w;
            this.a = a;
            this.s = s;
            this.d = d;
            this.shift = shift;
        }
    }

    /** 玩家战斗规则(开火冷却等) */
    public static final class PlayerRule {
        public String bulletColor = "rgba(255, 255, 255, 0.9)";
        /** 下一次开火还需要等待的时长(秒) */
        public double fireCooldownNow;
        /** 开火 CD(秒) */
        public double fireCooldownMax = 0.5;
    }

    /** 从者网格中的一个格子 */
    public static final class Servant {
        public int row;
        public int col;
        public boolean exist;
        /** 占用该格的 NPC 实体 id,-1 表示空 */
        public long npcId = -1;
        /** 八方向邻居 npcId(顺序:左上、上、右上、左、右、左下、下、右下),-1 表示无 */
        public long[] neighbor = new long[8];
    }

    /** 闪避状态 */
    public static final class DodgeState {
        public Geometry.Vec2 start;
        public Geometry.Vec2 target;
        public Geometry.Vec2 direction;
        public double elapsed;
        public double duration;
    }

    /** 掉落物堆叠(死亡掉落时按 tag 合并) */
    public record ItemStack(String tag, String name, int count) {
    }

    /** 专研降级记录(from > to;to == 0 表示该项被移除) */
    public record ResearchDowngrade(String tag, int from, int to) {
    }

    /** 玩家死亡结算结果:掉落经验值 + 掉落物品堆叠 + 掉落技能标签 + 专研降级明细 */
    public record DeathDrop(double droppedExp, List<ItemStack> items, List<String> skillTags,
                            List<ResearchDowngrade> researchDowngrades) {
    }

    public final MoveState moveState = new MoveState();
    public final PlayerRule playerRule = new PlayerRule();

    /** 玩家名称(客户端展示) */
    public String playerName;
    public Long teamId;
    public long playerScore;
    /** 游戏等级 */
    public int gameLevel;
    /** 当前体力值(0-100) */
    public double stamina;
    /** 体力值上限 */
    public double staminaMax = 100;
    /** 当前子弹数(开火每次消耗 1 发;为 0 时无法开火,由子弹球补充) */
    public int bulletCount = BASE_BULLET_COUNT;
    /** 最大子弹数(基础 50 + 专研「弹量」加成) */
    public int bulletMaxCount = BASE_BULLET_MAX;
    public boolean isSprinting;
    public DodgeState dodgeState;

    /** 玩家背包:持有物品与技能,并保存 10 个技能槽的装配状态 */
    public Inventory.Bag inventory = Inventory.createEmpty();

    /**
     * 技能装配区各槽位的技能剩余CD(秒),下标与 {@code inventory.equippedSkills} 一致(0 表示就绪)。
     *
     * <p>技能冷却本身按持有者记在共享的技能实例上,客户端拿不到,因此每帧把剩余CD
     * 写进这份快照字段随 {@code PlayerPrivate} 单播下发,仅用于客户端渲染技能冷却。</p>
     */
    public final double[] equippedSkillCooldowns = new double[Inventory.SKILL_SLOT_COUNT];

    /** 已研究的专研项 */
    public final List<Research.State> research = new ArrayList<>();
    /** 待玩家选择的专研选项(空表示无待选界面) */
    public final List<String> researchPendingOptions = new ArrayList<>();
    /**
     * 尚未展示的专研抽取次数。
     *
     * <p>每次升级都会独立进行一次触发判定,成功的次数累计到这里;
     * 这样一次 gainExp 跨越多级时不会因为界面已打开而漏掉后续等级的抽取机会。</p>
     */
    public int researchPendingRolls;

    /** 最近一次死亡结算明细(仅用于死亡界面展示,重生时清空) */
    public DeathDrop lastDeathReport;

    /**
     * 最近一次对玩家造成伤害的来源显示名(用于死亡界面「你被 xxx 击倒了」)。
     * 由 {@code World} 在施加伤害时写入:玩家名 / 从者所属玩家名 / NPC 类型名称 / 「地图边界」。
     */
    public String lastDamagerName = "";
    /** 本次死亡需要等待的复活时间(秒),由死亡时的等级决定;未死亡时为 0 */
    public double deathRespawnDelay;
    /** 复活等待的剩余时间(秒),由权威端每帧递减;未死亡时为 0 */
    public double deathRespawnRemaining;
    /**
     * 地图外伤害计时(累计的游戏刻数)。
     * 玩家脱离地图范围时累加,每达到 {@link #OUT_OF_MAP_TICKS_PER_DAMAGE} 刻结算 1 点伤害;
     * 回到地图内或死亡时清零。
     */
    private int outOfMapTickCounter;

    /** 未疾跑时的基础移动速度(由从者数量决定) */
    private double baseMoveSpeed = MOVE_SPEED;
    /** 体力亏空后等待恢复的剩余时间(秒) */
    private double staminaRecoveryDelayRemaining;

    /** 从者网格与 id -> 格子映射 */
    private Servant[][] servantGrid;
    private final Map<Long, Servant> servantMap = new HashMap<>();

    public PlayerEntity(Geometry.Vec2 position, Long teamId, String playerName) {
        super(position, WIDTH, HEIGHT, playerName, "player", "player");
        this.playerName = playerName;
        this.teamId = teamId;
        this.fillColor = "#2d7ff9a1";
        this.minMoveSpeed = MOVE_SPEED;
        this.maxMoveSpeed = MOVE_SPEED;
        this.speed = MOVE_SPEED;
        this.motionAirDrag = MOTION_DAMPING;
        this.motionTurnResponsiveness = MOTION_TURN_RESPONSE;
        this.wanderRange = 0;
        this.perceptionRange = 0;
        this.health = HEALTH_MAX;
        this.healthMax = HEALTH_MAX;
        this.stamina = staminaMax;
        this.gameExp = 0;
        this.initServantGrid();
        this.stop();
    }

    // ==================================================================
    // 等级与经验
    // ==================================================================

    /**
     * 从当前等级升到下一等级所需的游戏经验。
     * 0~20 级:2×等级+6;21~40 级:3×等级+6;41~60 级:5×等级+6;61 级以上:7×等级+6。
     */
    public static double getExpToNextLevel(int level) {
        if (level <= 20) {
            return 2.0 * level + 6;
        }
        if (level <= 40) {
            return 3.0 * level + 6;
        }
        if (level <= 60) {
            return 5.0 * level + 6;
        }
        return 7.0 * level + 6;
    }

    public double expToNextLevel() {
        return getExpToNextLevel(gameLevel);
    }

    /**
     * 把「等级 + 当前经验」折算成玩家累计获得的总经验值。
     * 即:累加 0 ~ level-1 每一级所需的升级经验,再加上当前等级内已积累的经验。
     * 用于死亡掉落经验的计算。
     */
    public static double getTotalAccumulatedExp(int level, double currentExp) {
        int safeLevel = Math.max(0, level);
        double total = 0;
        for (int l = 0; l < safeLevel; l++) {
            total += getExpToNextLevel(l);
        }
        return total + Math.max(0, currentExp);
    }

    /**
     * 计算玩家死亡后的复活等待时间(秒):X = 3 + 等级 / 3。
     * 结果取整且不超过 {@link #RESPAWN_DELAY_MAX_SECONDS}。
     *
     * @param level 死亡时的游戏等级
     */
    public static int getRespawnDelaySeconds(int level) {
        int safeLevel = Math.max(0, level);
        int seconds = RESPAWN_DELAY_BASE_SECONDS + safeLevel / RESPAWN_DELAY_LEVEL_DIVISOR;
        return Math.min(RESPAWN_DELAY_MAX_SECONDS, seconds);
    }

    /** 增加游戏经验,经验足够时自动提升游戏等级 */
    public void gainExp(double amount) {
        if (amount <= 0 || isDead) {
            return;
        }
        gameExp += amount;
        while (gameExp >= getExpToNextLevel(gameLevel)) {
            gameExp -= getExpToNextLevel(gameLevel);
            gameLevel += 1;
            // 每次升级都有概率触发专研界面
            rollResearchOnLevelUp();
        }
    }

    // ==================================================================
    // 背包与技能
    // ==================================================================

    /** 是否已持有该技能(背包中或已装配) */
    public boolean hasSkill(String skillTag) {
        return Inventory.hasSkill(inventory, skillTag);
    }

    /** 是否已装备该技能(仅看技能装配区) */
    public boolean hasEquippedSkill(String skillTag) {
        if (skillTag == null) {
            return false;
        }
        for (String tag : inventory.equippedSkills) {
            if (skillTag.equals(tag)) {
                return true;
            }
        }
        return false;
    }

    /** 当前生效的开火技能:取技能装配区中第一个已装配的技能 */
    public Skill getActiveFireSkill(Skill.Provider skills) {
        for (String tag : inventory.equippedSkills) {
            if (tag == null) {
                continue;
            }
            Skill skill = skills.byTag(tag);
            // 仅开火技能决定开火方式(闪现技能由空格触发,不参与)
            if (skill != null && skill.trigger() == Skill.Trigger.FIRE) {
                return skill;
            }
        }
        return null;
    }

    /** 当前生效的闪现技能:取技能装配区中第一个由"闪现"触发的技能,未装配返回 null */
    public Skill getEquippedDodgeSkill(Skill.Provider skills) {
        if (skills == null) {
            return null;
        }
        for (String tag : inventory.equippedSkills) {
            if (tag == null) {
                continue;
            }
            Skill skill = skills.byTag(tag);
            if (skill != null && skill.trigger() == Skill.Trigger.DODGE) {
                return skill;
            }
        }
        return null;
    }

    /**
     * 推进技能装配区中所有技能的内置CD计时器(每帧调用),并把剩余CD写入快照字段。
     * 技能冷却按玩家实体 id 分别记录,因此多个玩家装配同一技能时互不影响。
     * 同时在此推进持续型技能(如「环射烟花」的逐发扫射)。
     */
    private void updateEquippedSkillCooldowns(double dt, Skill.Provider skills) {
        for (int slot = 0; slot < equippedSkillCooldowns.length; slot++) {
            String tag = slot < inventory.equippedSkills.length ? inventory.equippedSkills[slot] : null;
            Skill skill = (tag == null || skills == null) ? null : skills.byTag(tag);
            if (skill == null) {
                equippedSkillCooldowns[slot] = 0;
                continue;
            }
            // 推进持续型技能(如「环射烟花」的逐发扫射)
            skill.tickCast(id, dt);
            if (!skill.hasCooldown()) {
                equippedSkillCooldowns[slot] = 0;
                continue;
            }
            equippedSkillCooldowns[slot] = skill.tickCooldown(id, dt);
        }
    }

    /** 清空技能装配区中所有技能的内置CD与持续施法状态(重生时调用) */
    private void resetEquippedSkillCooldowns(Skill.Provider skills) {
        Arrays.fill(equippedSkillCooldowns, 0);
        if (skills == null) {
            return;
        }
        for (String tag : inventory.equippedSkills) {
            if (tag == null) {
                continue;
            }
            Skill skill = skills.byTag(tag);
            if (skill != null) {
                skill.clearCooldown(id);
                skill.clearCast(id);
            }
        }
    }

    /**
     * 获得一个技能(来自技能球):加入背包并自动装配到第一个空槽。
     *
     * @return 调用后玩家是否持有该技能(重复获得时返回 true,但不会重复添加)
     */
    public boolean acquireSkill(String skillTag, Skill.Provider skills) {
        Skill skill = skills.byTag(skillTag);
        if (skill == null) {
            return false;
        }
        if (Inventory.hasSkill(inventory, skillTag)) {
            return true;
        }
        if (!Inventory.addSkill(inventory, skill.tag(), skill.name(), skill.color())) {
            return false;
        }
        Inventory.autoEquipSkill(inventory, skillTag, skills);
        return true;
    }

    /** 判断背包是否还能容纳指定物品 */
    public boolean canAcceptItem(String itemTag) {
        return Inventory.canAcceptItem(inventory, itemTag);
    }

    /**
     * 获得指定数量的物品。
     *
     * @return 实际放入背包的数量(背包空间不足时会小于 count)
     */
    public int acquireItemCount(String itemTag, String itemName, int count) {
        if (count <= 0) {
            return 0;
        }
        ItemDefinition definition = ItemRegistry.get(itemTag);
        return Inventory.addItem(inventory, itemTag, itemName, count, definition.color, definition.maxStack);
    }

    /**
     * 使用背包中的物品(按 uid 定位),物品产生效果后消耗 1 个。
     *
     * @return 是否成功使用
     */
    public boolean useInventoryItem(String uid) {
        if (isDead) {
            return false;
        }
        Inventory.Entry entry = Inventory.findEntry(inventory, uid);
        if (entry == null || !Inventory.KIND_ITEM.equals(entry.kind)) {
            return false;
        }
        ItemDefinition definition = ItemRegistry.get(entry.tag);
        if (definition.heal > 0) {
            if (health >= healthMax) {
                return false;
            }
            health = Math.min(healthMax, health + definition.heal);
        }
        Inventory.removeEntry(inventory, uid, 1);
        return true;
    }

    /** 应用来自客户端提交的背包状态(装配调整/卸下/销毁等操作),数据会先规范化 */
    public void applyInventoryState(List<Inventory.Entry> entries, List<String> equippedSkills) {
        this.inventory = Inventory.normalize(entries, equippedSkills);
    }

    /**
     * 取出背包与技能装配区中需要掉落的内容(仅供死亡结算使用)。
     *
     * <p>专研"死亡不掉落"生效时,按当前等级逐条判断物品与技能是否被保护:
     * 被保护的条目留在原格子中,未被保护的按原有规则掉落。</p>
     */
    private void takeInventoryForDeathDrop(List<ItemStack> itemStacks, List<String> skillTags) {
        double keepChance = getDeathKeepChance();
        Map<String, ItemStack> stackMap = new LinkedHashMap<>();

        Inventory.Bag kept = Inventory.createEmpty();
        for (int i = 0; i < inventory.entries.length; i++) {
            Inventory.Entry entry = inventory.entries[i];
            if (entry == null) {
                continue;
            }
            // 死亡不掉落:按概率保护该条目
            if (keepChance > 0 && Math.random() < keepChance) {
                kept.entries[i] = entry;
                continue;
            }
            if (Inventory.KIND_ITEM.equals(entry.kind)) {
                ItemStack existing = stackMap.get(entry.tag);
                if (existing != null) {
                    stackMap.put(entry.tag, new ItemStack(existing.tag(), existing.name(), existing.count() + entry.count));
                } else {
                    stackMap.put(entry.tag, new ItemStack(entry.tag, entry.name, entry.count));
                }
                continue;
            }
            skillTags.add(entry.tag);
        }
        for (int i = 0; i < inventory.equippedSkills.length; i++) {
            String tag = inventory.equippedSkills[i];
            if (tag == null) {
                continue;
            }
            if (keepChance > 0 && Math.random() < keepChance) {
                kept.equippedSkills[i] = tag;
                continue;
            }
            skillTags.add(tag);
        }
        itemStacks.addAll(stackMap.values());
        this.inventory = kept;
    }

    /**
     * 玩家死亡事件:统一处理玩家死亡后需要做的事情。
     *
     * <ul>
     *   <li>清空背包:背包中的物品全部取出并掉落(受专研"死亡不掉落"保护的部分保留);</li>
     *   <li>清空技能:技能装配区中已装配的技能与背包中的技能条目一并取出并掉落;</li>
     *   <li>专研惩罚:所有专研项降低 1 级,降至 0 级则直接移除该项;</li>
     *   <li>清空经验:按"(等级折算总经验 + 当前经验) × 掉落系数"掉落经验球,上限 215;</li>
     *   <li>清空等级:游戏等级归零;</li>
     *   <li>清空积分:击杀积分归零。</li>
     * </ul>
     *
     * <p>本方法只修改玩家自身状态并产出掉落清单,地面实体由世界模块依据返回值生成。</p>
     */
    public DeathDrop onDeath() {
        List<ItemStack> items = new ArrayList<>();
        List<String> skillTags = new ArrayList<>();
        // 死亡时清空待选的专研选项与未展示的抽取次数(死亡后不再保留专研界面)
        researchPendingOptions.clear();
        researchPendingRolls = 0;

        // 复活等待时间:X = 3 + 等级 / 3(整数,上限 30 秒)。
        // 必须在等级被清零之前按「死亡时的等级」计算,否则重生等待时间恒为基础值。
        deathRespawnDelay = getRespawnDelaySeconds(gameLevel);
        deathRespawnRemaining = deathRespawnDelay;
        // 死亡后不再累计地图外伤害
        outOfMapTickCounter = 0;

        // 死亡不掉落:按当前等级决定背包条目是否被保护(读取发生在专研降级之前)
        takeInventoryForDeathDrop(items, skillTags);

        // 死亡惩罚:所有专研项降低 1 级;降至 0 级则移除该项
        List<ResearchDowngrade> researchDowngrades = new ArrayList<>();
        for (Research.State state : new ArrayList<>(research)) {
            int from = Math.max(0, state.level);
            if (from <= 0) {
                continue;
            }
            int to = from - 1;
            if (to <= 0) {
                research.remove(state);
            } else {
                state.level = to;
                if ("immovable_fortress".equals(state.tag)) {
                    // 降级后吸收池不应超过新等级的上限
                    state.value = Math.min(state.value, Research.FORTRESS_ABSORB_PER_LEVEL * to);
                }
            }
            researchDowngrades.add(new ResearchDowngrade(state.tag, from, to));
        }
        refreshResearchModifiers();

        // 掉落经验 = (等级折算总经验 + 当前经验) × 掉落系数(向上取整),上限 215
        double totalAccumulatedExp = getTotalAccumulatedExp(gameLevel, gameExp);
        double droppedExp = Math.min(
                DEATH_DROP_EXP_MAX,
                Math.ceil(totalAccumulatedExp * DEATH_DROP_COEFFICIENT));
        this.gameExp = 0;
        this.gameLevel = 0;
        this.playerScore = 0;

        DeathDrop report = new DeathDrop(droppedExp, items, skillTags, researchDowngrades);
        // 记录本次死亡明细,供死亡界面展示(重生时清空)
        this.lastDeathReport = report;
        return report;
    }

    /** 重生玩家并重置临时战斗状态 */
    public void respawn(Geometry.Vec2 position, Skill.Provider skills) {
        this.position = position.copy();
        this.nextTarget = position.copy();
        this.targetHistory = new ArrayList<>(List.of(position.copy()));
        this.curvePoints = new ArrayList<>(List.of(position.copy()));
        this.currentCurveIndex = 0;
        this.health = this.healthMax;
        this.isDead = false;
        this.deathEffectTimer = 0;
        this.damageFlashTimer = 0;
        this.isMoving = false;
        // 重生视为重新出生:子弹补满
        this.bulletCount = this.bulletMaxCount;
        this.stamina = staminaMax;
        this.isSprinting = false;
        this.staminaRecoveryDelayRemaining = 0;
        this.dodgeState = null;
        this.playerRule.fireCooldownNow = 0;
        // 清空上一次死亡明细(死亡界面随重生关闭)
        this.lastDeathReport = null;
        this.researchPendingRolls = 0;
        // 清空死亡等待与伤害来源记录
        this.lastDamagerName = "";
        this.deathRespawnDelay = 0;
        this.deathRespawnRemaining = 0;
        this.outOfMapTickCounter = 0;
        // 重生后技能内置CD一并清空(无敌时长已从玩家规则中移除)
        resetEquippedSkillCooldowns(skills);
        this.resetServantGrid();
        this.stop();
        this.updateCollisionBox();
    }

    // ==================================================================
    // 每帧更新
    // ==================================================================

    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        playerRule.fireCooldownNow = Math.max(0, playerRule.fireCooldownNow - dt);
        refreshSpeedByServantCount();
        // 技能冷却:装配区中每个技能的内置CD计时器各自由玩家推进(闪避CD即来自闪现技能)
        updateEquippedSkillCooldowns(dt, world.skills());

        if (updateDodgeMovement(dt, world)) {
            return;
        }

        double dx = 0;
        double dy = 0;
        if (moveState.w) {
            dy += 1;
        }
        if (moveState.s) {
            dy -= 1;
        }
        if (moveState.a) {
            dx -= 1;
        }
        if (moveState.d) {
            dx += 1;
        }
        double len = Math.hypot(dx, dy);

        updateSprintState(dt, len > 0.0001);

        if (len < 0.0001) {
            updateMotionVelocity(null, speed, dt);
        } else {
            updateMotionVelocity(new Geometry.Vec2(dx / len, dy / len), speed, dt);
        }

        Geometry.Vec2 displacement = getMotionDisplacement(dt);
        if (Math.hypot(displacement.x, displacement.y) < 0.0001) {
            isMoving = false;
            nextTarget = position.copy();
            targetHistory = new ArrayList<>(List.of(position.copy()));
            curvePoints = new ArrayList<>(List.of(position.copy()));
            currentCurveIndex = 0;
            return;
        }

        Geometry.Vec2 nextPosX = new Geometry.Vec2(position.x + displacement.x, position.y);
        Geometry.Vec2 nextPosY = new Geometry.Vec2(position.x, position.y + displacement.y);
        boolean moved = false;

        if (!collidesWithStatic(nextPosX, world)) {
            position.x = nextPosX.x;
            moved = true;
        } else {
            motionVelocity.x = 0;
        }
        if (!collidesWithStatic(nextPosY, world)) {
            position.y = nextPosY.y;
            moved = true;
        } else {
            motionVelocity.y = 0;
        }

        updateCollisionBox();
        isMoving = moved || hasMotionVelocity();
        nextTarget = position.copy();
        targetHistory = new ArrayList<>(List.of(position.copy()));
        curvePoints = new ArrayList<>(List.of(position.copy()));
        currentCurveIndex = 0;

        if (moved) {
            noMoveDuration = 0;
            noMoveLastPos = position.copy();
            crowdStuckTimer = 0;
            insideStaticBlockedTimer = 0;
            double faceLen = len > 0.0001 ? len : Math.hypot(displacement.x, displacement.y);
            if (faceLen > 0.0001) {
                facingDirection = len > 0.0001
                        ? new Geometry.Vec2(dx / faceLen, dy / faceLen)
                        : new Geometry.Vec2(displacement.x / faceLen, displacement.y / faceLen);
                lastMoveDirection = facingDirection.copy();
            }
        }
    }

    /** 玩家不受 NPC 的群体停滞/游走逻辑影响,直接空实现 */
    @Override
    public void updateCrowdStuckState(double dt) {
        // 玩家不参与 NPC 群体停滞检测
    }

    @Override
    public boolean updateNoMovementWatchdog(double dt) {
        return false;
    }

    @Override
    public void updateStayDuration(double dt) {
        // 玩家到点不使用驻足逻辑
    }

    @Override
    public boolean canGetNewWanderTarget(double dt, WorldView world) {
        return false;
    }

    @Override
    public void applyDamage(double amount) {
        if (amount > 0 && !isDead) {
            double remaining = absorbDamageWithFortress(amount);
            if (remaining <= 0) {
                return;
            }
            super.applyDamage(remaining);
            return;
        }
        super.applyDamage(amount);
    }

    /**
     * 推进与死亡相关的玩家状态(由世界 tick 每帧调用;即使玩家已死亡也必须调用,
     * 因为死亡期间 {@link #update} 会直接返回):
     * <ul>
     *   <li>递减复活等待时间;</li>
     *   <li>玩家位于地图范围外时,按「每 10 游戏刻 1 点伤害」结算越界惩罚。</li>
     * </ul>
     */
    public void updateDeathAndOutOfMapState(double dt, GameConfig config) {
        if (isDead) {
            // 剩余时间量化到 2 位小数。
            // 协议下发时本字段会被量化到 2 位小数,若权威端保留全精度残留值(例如 3.0 连续
            // 减去 0.02 后只剩 8.9E-16),客户端会读到 0 并请求复活,而权威端判定 "> 0" 拒绝,
            // 表现为"自动复活偶发失效"。统一按同一精度推进即可消除该竞态。
            deathRespawnRemaining = Math.max(0, Math.round((deathRespawnRemaining - dt) * 100.0) / 100.0);
            outOfMapTickCounter = 0;
            return;
        }
        updateOutOfMapDamage(config);
    }

    /** 是否可以复活:玩家已死亡,且复活等待时间已结束 */
    public boolean canRespawnNow() {
        return isDead && deathRespawnRemaining <= 0;
    }

    /**
     * 地图外伤害:玩家离开地图范围(穿越 Curb)后,每 10 游戏刻受到 1 点伤害。
     * 伤害来源记为「地图边界」,用于死亡界面提示。
     */
    private void updateOutOfMapDamage(GameConfig config) {
        if (isDead) {
            outOfMapTickCounter = 0;
            return;
        }
        boolean outside =
                position.x < config.worldMinX || position.x > config.worldMaxX
                        || position.y < config.worldMinY || position.y > config.worldMaxY;
        if (!outside) {
            outOfMapTickCounter = 0;
            return;
        }
        outOfMapTickCounter++;
        while (outOfMapTickCounter >= OUT_OF_MAP_TICKS_PER_DAMAGE) {
            outOfMapTickCounter -= OUT_OF_MAP_TICKS_PER_DAMAGE;
            lastDamagerName = OUT_OF_MAP_KILLER_NAME;
            applyDamage(OUT_OF_MAP_DAMAGE);
            if (isDead) {
                outOfMapTickCounter = 0;
                break;
            }
        }
    }

    /** 疾跑必须满足:按住 Shift 且处于移动过程中 */
    private void updateSprintState(double dt, boolean isMoving) {
        boolean wantSprint = moveState.shift && isMoving;

        if (isSprinting && !wantSprint) {
            isSprinting = false;
        }
        if (!isSprinting && wantSprint && stamina > SPRINT_START_MIN_STAMINA) {
            isSprinting = true;
        }

        if (isSprinting) {
            stamina = Math.max(0, stamina - getSprintStaminaDrainPerSecond() * dt);
            if (stamina <= 0) {
                stamina = 0;
                isSprinting = false;
                staminaRecoveryDelayRemaining = STAMINA_EXHAUST_RECOVERY_DELAY;
            }
        } else if (staminaRecoveryDelayRemaining > 0) {
            staminaRecoveryDelayRemaining = Math.max(0, staminaRecoveryDelayRemaining - dt);
        } else {
            stamina = Math.min(staminaMax, stamina + STAMINA_RECOVER_PER_SECOND * dt);
        }

        double speedMultiplier = 1;
        if (isSprinting) {
            if (stamina >= SPRINT_LOW_STAMINA_THRESHOLD) {
                speedMultiplier = SPRINT_SPEED_MULTIPLIER;
            } else {
                double ratio = Math.max(0, stamina / SPRINT_LOW_STAMINA_THRESHOLD);
                speedMultiplier = 1 + (SPRINT_SPEED_MULTIPLIER - 1) * ratio;
            }
        }
        speed = baseMoveSpeed * speedMultiplier;
    }

    /** 根据当前从者数量刷新玩家移动速度:每增加一个从者降低 4,最低不低于 MIN_MOVE_SPEED */
    private void refreshSpeedByServantCount() {
        int servantCount = servantMap.size();
        double base = Math.max(MIN_MOVE_SPEED, MOVE_SPEED - servantCount * 4);
        // 专研"移速"按百分比提升基础移动速度
        baseMoveSpeed = base * getMoveSpeedMultiplier();
        speed = baseMoveSpeed;
    }

    /** 专研"移速"的移动速度倍率(1 表示无加成) */
    public double getMoveSpeedMultiplier() {
        return 1 + Research.MOVE_SPEED_BONUS_PER_LEVEL * Research.getLevel(research, "move_speed");
    }

    /** 专研"射速"的开火速度倍率(1 表示无加成) */
    public double getFireRateMultiplier() {
        return 1 + Research.FIRE_RATE_BONUS_PER_LEVEL * Research.getLevel(research, "fire_rate");
    }

    /** 专研"冷却"的技能冷却倍率(1 表示无减少,最低 0.5) */
    public double getCooldownMultiplier() {
        double reduction = Math.min(
                Research.COOLDOWN_REDUCTION_MAX,
                Research.COOLDOWN_REDUCTION_PER_LEVEL * Research.getLevel(research, "cooldown"));
        return 1 - reduction;
    }

    /** 当前疾跑体力消耗速率(点/秒,受专研"体力"降低) */
    private double getSprintStaminaDrainPerSecond() {
        return Math.max(
                Research.STAMINA_DRAIN_MIN,
                SPRINT_STAMINA_DRAIN_PER_SECOND
                        - Research.STAMINA_DRAIN_REDUCTION_PER_LEVEL * Research.getLevel(research, "stamina"));
    }

    /** 专研"幸运之星"提供的战利品掉落概率加成(0~0.25) */
    public double getLuckyStarBonus() {
        return Research.LUCKY_STAR_BONUS_PER_LEVEL * Research.getLevel(research, "lucky_star");
    }

    /** 专研"死亡不掉落"当前等级对应的保护概率(0~1) */
    public double getDeathKeepChance() {
        return Math.min(1, Research.DEATH_KEEP_CHANCE_PER_LEVEL * Research.getLevel(research, "death_keep"));
    }

    /** 专研"弹量"提供的最大子弹数加成(各等级增量之和) */
    public int getAmmoResearchBonus() {
        return Research.ammoMaxBonus(Research.getLevel(research, "ammo"));
    }

    /** 当前剩余的子弹容量(已满时为 0) */
    public int getBulletCapacity() {
        return Math.max(0, bulletMaxCount - bulletCount);
    }

    /** 是否还有子弹可以开火 */
    public boolean hasBullet() {
        return bulletCount > 0;
    }

    /**
     * 消耗子弹(开火时调用)。
     *
     * @param amount 消耗数量(默认 1)
     * @return 是否消耗成功(子弹不足时不消耗并返回 false)
     */
    public boolean consumeBullet(int amount) {
        int need = Math.max(1, amount);
        if (bulletCount < need) {
            return false;
        }
        bulletCount -= need;
        return true;
    }

    /**
     * 补充子弹(吸收子弹球时调用)。
     * 已达上限时不吸收;剩余容量不足时仅补充容量允许的部分。
     *
     * @param amount 期望补充的数量
     * @return 实际补充的数量
     */
    public int addBulletCount(int amount) {
        if (amount <= 0 || isDead) {
            return 0;
        }
        int accepted = Math.min(getBulletCapacity(), amount);
        if (accepted <= 0) {
            return 0;
        }
        bulletCount += accepted;
        return accepted;
    }

    /**
     * 根据当前专研重新计算受其影响的派生属性:生命/体力上限与开火冷却,
     * 并刷新移动速度。生命/体力上限提升时把增量直接补进当前值。
     */
    public void refreshResearchModifiers() {
        int healthLevel = Research.getLevel(research, "health");
        double newHealthMax = HEALTH_MAX + Research.HEALTH_MAX_BONUS_PER_LEVEL * healthLevel;
        double healthDelta = newHealthMax - healthMax;
        healthMax = newHealthMax;
        if (healthDelta > 0 && !isDead) {
            health = Math.min(healthMax, health + healthDelta);
        }
        if (health > healthMax) {
            health = healthMax;
        }

        int staminaLevel = Research.getLevel(research, "stamina");
        double newStaminaMax = BASE_STAMINA_MAX + Research.STAMINA_MAX_BONUS_PER_LEVEL * staminaLevel;
        double staminaDelta = newStaminaMax - staminaMax;
        staminaMax = newStaminaMax;
        if (staminaDelta > 0 && !isDead) {
            stamina = Math.min(staminaMax, stamina + staminaDelta);
        }
        if (stamina > staminaMax) {
            stamina = staminaMax;
        }

        // 专研"弹量":提升最大子弹数;上限提升时把增量直接补进当前子弹数
        int ammoLevel = Research.getLevel(research, "ammo");
        int newBulletMax = BASE_BULLET_MAX + Research.ammoMaxBonus(ammoLevel);
        int bulletDelta = newBulletMax - bulletMaxCount;
        bulletMaxCount = newBulletMax;
        if (bulletDelta > 0 && !isDead) {
            bulletCount = Math.min(bulletMaxCount, bulletCount + bulletDelta);
        }
        if (bulletCount > bulletMaxCount) {
            bulletCount = bulletMaxCount;
        }

        // 开火冷却 = 基础冷却 ÷ 射速倍率 × 冷却倍率
        playerRule.fireCooldownMax = BASE_FIRE_COOLDOWN / getFireRateMultiplier() * getCooldownMultiplier();

        refreshSpeedByServantCount();
    }

    /**
     * 升级时按概率触发专研:p = (64 - 等级)/100,最低 5%。
     *
     * <p>每次升级都独立判定;判定成功的次数累计到 {@link #researchPendingRolls},
     * 再逐次展示待选项——一次跨多级升级时不会漏掉抽取机会。</p>
     */
    private void rollResearchOnLevelUp() {
        if (Math.random() >= Research.triggerProbability(gameLevel)) {
            return;
        }
        researchPendingRolls = Math.max(0, researchPendingRolls) + 1;
        presentPendingResearchOptions();
    }

    /**
     * 从累计的待抽取次数中取出一次生成待选研究项。
     * 已有待选项(界面尚未选择)时不重复生成,等玩家选择后由 chooseResearch 再次调用补发。
     */
    private void presentPendingResearchOptions() {
        int remaining = Math.max(0, researchPendingRolls);
        if (remaining <= 0 || !researchPendingOptions.isEmpty()) {
            return;
        }
        List<String> options = Research.rollOptions(research, Research.OPTION_COUNT);
        researchPendingRolls = remaining - 1;
        if (options.isEmpty()) {
            // 可研究项已全部叠满,清空剩余次数避免界面空转
            researchPendingRolls = 0;
            return;
        }
        researchPendingOptions.clear();
        researchPendingOptions.addAll(options);
    }

    /**
     * 玩家从待选专研项中选择一项(由服务端权威结算)。
     * 若仍有跨级升级累计下来的抽取次数,立即补发下一次待选项。
     *
     * @return 是否选择成功
     */
    public boolean chooseResearch(String tag) {
        if (tag == null || !researchPendingOptions.contains(tag)) {
            return false;
        }
        applyResearch(tag);
        researchPendingOptions.clear();
        // 补发跨级升级时累计的抽取机会
        presentPendingResearchOptions();
        return true;
    }

    /** 应用一次研究:等级 +1(已持有则叠加),并刷新派生属性 */
    private void applyResearch(String tag) {
        Research.Definition definition = Research.byTag(tag);
        if (definition == null) {
            return;
        }
        Research.State state = Research.getState(research, tag);
        if (state == null) {
            research.add(new Research.State(tag, 1,
                    "immovable_fortress".equals(tag) ? Research.FORTRESS_ABSORB_PER_LEVEL : 0));
        } else {
            Integer maxLevel = definition.maxLevel();
            if (maxLevel != null && state.level >= maxLevel) {
                return;
            }
            state.level += 1;
            if ("immovable_fortress".equals(tag)) {
                // 研究升级时自动恢复到该等级的最大吸收值
                state.value = Research.FORTRESS_ABSORB_PER_LEVEL * state.level;
            }
        }
        refreshResearchModifiers();
    }

    /** 移除某个研究项(死亡不掉落降级至 0 / 不动堡垒吸收耗尽) */
    private void removeResearch(String tag) {
        research.removeIf(state -> state.tag.equals(tag));
        refreshResearchModifiers();
    }

    /**
     * 专研"不动堡垒":玩家保持不动时吸收受到的伤害。
     *
     * @return 未被吸收的剩余伤害
     */
    private double absorbDamageWithFortress(double amount) {
        Research.State state = Research.getState(research, "immovable_fortress");
        if (state == null || state.level <= 0) {
            return amount;
        }
        // 仅在玩家保持不动时生效(移动/闪避中不吸收)
        if (isMoving || dodgeState != null) {
            return amount;
        }
        int level = state.level;
        double pool = Math.max(0, state.value);
        if (pool <= 0) {
            removeResearch("immovable_fortress");
            return amount;
        }
        double absorbed = Math.min(pool, amount);
        pool -= absorbed;
        state.value = pool;

        // 降级/移除判定:1 级归零即移除;≥2 级降至下一等级上限则降 1 级
        if (pool <= 0) {
            removeResearch("immovable_fortress");
        } else if (level >= 2 && pool <= Research.FORTRESS_ABSORB_PER_LEVEL * (level - 1)) {
            state.level = level - 1;
        }
        return amount - absorbed;
    }

    /** 玩家与静态实体的碰撞检测 */
    private boolean collidesWithStatic(Geometry.Vec2 newPos, WorldView world) {
        double halfW = width / 2;
        double halfH = height / 2;
        double minX = newPos.x - halfW;
        double maxX = newPos.x + halfW;
        double minY = newPos.y - halfH;
        double maxY = newPos.y + halfH;

        for (StaticEntity staticEntity : world.staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            Geometry.Box box = staticEntity.collisionBox;
            boolean separated = maxX <= box.x
                    || minX >= box.maxX()
                    || maxY <= box.y
                    || minY >= box.maxY();
            if (!separated) {
                return true;
            }
        }
        return false;
    }

    // ==================================================================
    // 闪避
    // ==================================================================

    /**
     * 执行闪避:向指定方向进行短促冲刺。
     * 闪避能力与冷却都由玩家装配区中的"闪现技能"决定(技能内置CD计时器),
     * 不再附带无敌效果——未装备闪现技能或技能处于冷却中时均不可释放。
     */
    public void dodge(Geometry.Vec2 direction, WorldView world) {
        double len = Math.hypot(direction.x, direction.y);
        if (len < 0.001) {
            return;
        }
        Skill dodgeSkill = getEquippedDodgeSkill(world.skills());
        if (dodgeSkill == null) {
            return; // 未装备闪现技能
        }
        if (dodgeSkill.isOnCooldown(id)) {
            return; // 技能内置CD中
        }
        if (dodgeState != null) {
            return;
        }

        Geometry.Vec2 dir = new Geometry.Vec2(direction.x / len, direction.y / len);
        Geometry.Vec2 targetPos = getDodgeTarget(dir, world);
        if (targetPos == null) {
            return;
        }

        DodgeState state = new DodgeState();
        state.start = position.copy();
        state.target = targetPos;
        state.direction = dir;
        state.elapsed = 0;
        state.duration = DODGE_SLIDE_DURATION;
        this.dodgeState = state;

        facingDirection = dir.copy();
        lastMoveDirection = dir.copy();
        // 释放成功后进入技能内置冷却(冷却时长由技能自身 maxCooldown 与专研"冷却"共同决定)
        dodgeSkill.setCurrentCooldown(id, dodgeSkill.maxCooldown() * getCooldownMultiplier());
        noMoveDuration = 0;
        noMoveLastPos = position.copy();
    }

    /** 沿闪避方向按步长试探,返回不撞墙的最远落点 */
    private Geometry.Vec2 getDodgeTarget(Geometry.Vec2 direction, WorldView world) {
        int stepCount = 12;
        for (int i = stepCount; i >= 2; i--) {
            double distance = DODGE_DISTANCE * ((double) i / stepCount);
            Geometry.Vec2 target = new Geometry.Vec2(
                    position.x + direction.x * distance,
                    position.y + direction.y * distance);
            if (!collidesWithStatic(target, world)) {
                return target;
            }
        }
        return null;
    }

    private double easeDodgeProgress(double t) {
        double ratio = Geometry.clamp(t, 0, 1);
        return 1 - Math.pow(1 - ratio, 3);
    }

    /** 推进闪避位移,返回是否处于闪避中(闪避中不执行常规移动) */
    private boolean updateDodgeMovement(double dt, WorldView world) {
        if (dodgeState == null) {
            return false;
        }
        DodgeState state = dodgeState;
        state.elapsed = Math.min(state.duration, state.elapsed + dt);
        double progress = easeDodgeProgress(state.elapsed / state.duration);
        Geometry.Vec2 nextPos = new Geometry.Vec2(
                state.start.x + (state.target.x - state.start.x) * progress,
                state.start.y + (state.target.y - state.start.y) * progress);

        if (!collidesWithStatic(nextPos, world)) {
            position.set(nextPos);
            updateCollisionBox();
        } else {
            dodgeState = null;
            return true;
        }

        isMoving = true;
        nextTarget = position.copy();
        targetHistory = new ArrayList<>(List.of(position.copy()));
        curvePoints = new ArrayList<>(List.of(position.copy()));
        currentCurveIndex = 0;
        noMoveDuration = 0;
        noMoveLastPos = position.copy();
        crowdStuckTimer = 0;
        insideStaticBlockedTimer = 0;
        facingDirection = state.direction.copy();
        lastMoveDirection = state.direction.copy();

        if (state.elapsed >= state.duration) {
            dodgeState = null;
        }
        return true;
    }

    // ==================================================================
    // 从者网格
    // ==================================================================

    private void initServantGrid() {
        servantGrid = new Servant[SERVANT_GRID_SIZE][SERVANT_GRID_SIZE];
        for (int r = 0; r < SERVANT_GRID_SIZE; r++) {
            for (int c = 0; c < SERVANT_GRID_SIZE; c++) {
                servantGrid[r][c] = new Servant();
                servantGrid[r][c].row = r;
                servantGrid[r][c].col = c;
                for (int i = 0; i < 8; i++) {
                    servantGrid[r][c].neighbor[i] = -1;
                }
            }
        }
        servantMap.clear();
        refreshSpeedByServantCount();
    }

    /** 重置从者网格(重生时调用) */
    public void resetServantGrid() {
        initServantGrid();
    }

    /** 获取所有从者 id */
    public List<Long> getAllServantIds() {
        return new ArrayList<>(servantMap.keySet());
    }

    public int servantCount() {
        return servantMap.size();
    }

    /** 添加一个从者(占格成功返回 true) */
    public boolean setServant(int row, int col, long npcEntityId) {
        if (servantGrid == null) {
            return false;
        }
        if (row == SERVANT_GRID_CENTER && col == SERVANT_GRID_CENTER) {
            return false;
        }
        if (row < 0 || row >= SERVANT_GRID_SIZE || col < 0 || col >= SERVANT_GRID_SIZE) {
            return false;
        }
        if (servantGrid[row][col].exist) {
            return false;
        }
        servantGrid[row][col].exist = true;
        servantGrid[row][col].npcId = npcEntityId;
        servantMap.put(npcEntityId, servantGrid[row][col]);

        updateNeighborsForCell(row, col);
        refreshSpeedByServantCount();
        return true;
    }

    /** 移除一个从者,返回被移除的行列(不存在返回 null) */
    public int[] removeServant(long npcEntityId) {
        for (int r = 0; r < SERVANT_GRID_SIZE; r++) {
            for (int c = 0; c < SERVANT_GRID_SIZE; c++) {
                if (servantGrid[r][c].npcId == npcEntityId && servantGrid[r][c].exist) {
                    servantGrid[r][c].exist = false;
                    servantGrid[r][c].npcId = -1;
                    for (int i = 0; i < 8; i++) {
                        servantGrid[r][c].neighbor[i] = -1;
                    }
                    servantMap.remove(npcEntityId);
                    updateNeighborsForCell(r, c);
                    refreshSpeedByServantCount();
                    return new int[]{r, c};
                }
            }
        }
        return null;
    }

    /**
     * 从指定从者开始,找出所有与玩家断连的从者并释放它们。
     *
     * @param startServant 起始从者(通常是刚死亡的从者)
     * @param onReleaseNpc  释放回调,用于修改外部 NPC 的 ownerId/teamId
     * @return 被释放的 npcId 列表
     */
    public List<Long> releaseDisconnectedServants(Servant startServant, java.util.function.LongConsumer onReleaseNpc) {
        List<Long> disconnected = new ArrayList<>();
        if (startServant == null || !startServant.exist || startServant.npcId == -1) {
            return disconnected;
        }
        long deadServantId = startServant.npcId;
        disconnected.add(deadServantId);

        // 死亡从者自身必须先移除,否则它仍会被当成桥接节点
        removeServant(deadServantId);

        List<Long> remainingIds = new ArrayList<>(servantMap.keySet());
        for (Long id : remainingIds) {
            Servant servant = servantMap.get(id);
            if (servant != null && !isServantConnectedToPlayer(servant)) {
                disconnected.add(id);
            }
        }

        for (Long id : disconnected) {
            if (id != deadServantId) {
                removeServant(id);
            }
            if (onReleaseNpc != null) {
                onReleaseNpc.accept(id);
            }
        }
        return disconnected;
    }

    /** 检查某个从者是否与玩家连通(通过 neighbor 链路可达玩家中心的邻居格子) */
    private boolean isServantConnectedToPlayer(Servant startServant) {
        int[][] centerNeighbors = {
                {6, 6}, {6, 7}, {6, 8},
                {7, 6}, {7, 8},
                {8, 6}, {8, 7}, {8, 8}
        };
        List<Long> queue = new ArrayList<>();
        Set<Long> visited = new HashSet<>();
        queue.add(startServant.npcId);
        visited.add(startServant.npcId);

        while (!queue.isEmpty()) {
            long currentId = queue.remove(0);
            Servant currentServant = servantMap.get(currentId);
            if (currentServant == null) {
                continue;
            }
            for (int[] rc : centerNeighbors) {
                if (currentServant.row == rc[0] && currentServant.col == rc[1]) {
                    return true;
                }
            }
            for (long neighborId : currentServant.neighbor) {
                if (neighborId != -1 && visited.add(neighborId)) {
                    queue.add(neighborId);
                }
            }
        }
        return false;
    }

    /** 通过行列查询从者 */
    public Servant selectServantByRC(int row, int col) {
        if (row < 0 || row >= SERVANT_GRID_SIZE || col < 0 || col >= SERVANT_GRID_SIZE) {
            return null;
        }
        return servantGrid[row][col];
    }

    /** 通过 npcId 查询从者 */
    public Servant selectServantByID(long npcEntityId) {
        return servantMap.get(npcEntityId);
    }

    /** 世界坐标 -> 从者网格行列(超出范围或落在中心格返回 null) */
    public int[] worldPositionToRowCol(Geometry.Vec2 worldPosition) {
        double deltaX = position.x - worldPosition.x;
        double deltaY = worldPosition.y - position.y;
        double halfCell = 12.5;

        int colOffset = (int) Math.floor((deltaX + halfCell) / 25);
        int rowOffset = (int) Math.floor((deltaY + halfCell) / 25);

        if (colOffset < -7 || colOffset > 7 || rowOffset < -7 || rowOffset > 7) {
            return null;
        }
        int col = 7 - colOffset;
        int row = 7 - rowOffset;
        if (row == SERVANT_GRID_CENTER && col == SERVANT_GRID_CENTER) {
            return null;
        }
        return new int[]{row, col};
    }

    /** 从者网格行列 -> 世界坐标(格子中心点) */
    public Geometry.Vec2 rowColToWorldPosition(int row, int col) {
        if (row < 0 || row >= SERVANT_GRID_SIZE || col < 0 || col >= SERVANT_GRID_SIZE) {
            return null;
        }
        double offsetX = col - 7;
        double offsetY = 7 - row;
        return new Geometry.Vec2(position.x + offsetX * 25, position.y + offsetY * 25);
    }

    /**
     * 为一个待吸附的 NPC 挑选从者落格。
     *
     * <p>优先使用 NPC 世界坐标对应的格子;若该格不可用(中心格、越界或已被占用),
     * 则沿「玩家 → NPC」方向继续向网格外侧找空格,再退化为全网格中离该坐标最近的空格。</p>
     *
     * <p>吸附触发条件是 NPC 与玩家(或已有从者)碰撞盒重叠,而两者都是 25×25,
     * 所以 NPC 的坐标必然紧贴玩家——直接用该坐标取格会把可用的格子锁死在紧贴玩家的
     * 8 格内。本方法让 15×15 网格(最多 224 个从者)真正可用:同一侧的从者可以
     * 沿着该方向一层层叠出去。</p>
     *
     * @param worldPosition 被吸附 NPC 的世界坐标
     * @return {row, col};网格已满时返回 null
     */
    public int[] findServantSlot(Geometry.Vec2 worldPosition) {
        if (servantGrid == null) {
            return null;
        }
        int[] preferred = worldPositionToRowCol(worldPosition);
        if (preferred == null) {
            return nearestFreeServantSlot(worldPosition);
        }
        if (!servantGrid[preferred[0]][preferred[1]].exist) {
            return preferred;
        }

        // 该格已被占用:沿同一方向继续向外扩展,让同一侧的从者叠成一列
        int stepCol = Integer.signum(preferred[1] - SERVANT_GRID_CENTER);
        int stepRow = Integer.signum(SERVANT_GRID_CENTER - preferred[0]);
        if (stepCol != 0 || stepRow != 0) {
            int col = preferred[1];
            int row = preferred[0];
            while (true) {
                col += stepCol;
                row -= stepRow;
                if (col < 0 || col >= SERVANT_GRID_SIZE || row < 0 || row >= SERVANT_GRID_SIZE) {
                    break;
                }
                if (!servantGrid[row][col].exist) {
                    return new int[]{row, col};
                }
            }
        }
        return nearestFreeServantSlot(worldPosition);
    }

    /** 全网格中离指定世界坐标最近的空格(网格已满时返回 null) */
    private int[] nearestFreeServantSlot(Geometry.Vec2 worldPosition) {
        int bestRow = -1;
        int bestCol = -1;
        double bestDistance = Double.MAX_VALUE;
        for (int row = 0; row < SERVANT_GRID_SIZE; row++) {
            for (int col = 0; col < SERVANT_GRID_SIZE; col++) {
                if (row == SERVANT_GRID_CENTER && col == SERVANT_GRID_CENTER) {
                    continue;
                }
                if (servantGrid[row][col].exist) {
                    continue;
                }
                Geometry.Vec2 center = rowColToWorldPosition(row, col);
                double d = Geometry.distance(center.x, center.y, worldPosition.x, worldPosition.y);
                if (d < bestDistance - 1e-9) {
                    bestDistance = d;
                    bestRow = row;
                    bestCol = col;
                }
            }
        }
        return bestRow < 0 ? null : new int[]{bestRow, bestCol};
    }

    /** 获取某格子八个方向的邻居 npcId 数组(顺序:左上、上、右上、左、右、左下、下、右下) */
    private long[] buildNeighborForCell(int row, int col) {
        long[] neighbors = new long[8];
        int[][] directions = {
                {-1, -1}, {-1, 0}, {-1, 1},
                {0, -1}, {0, 1},
                {1, -1}, {1, 0}, {1, 1}
        };
        for (int i = 0; i < directions.length; i++) {
            int nr = row + directions[i][0];
            int nc = col + directions[i][1];
            if (nr >= 0 && nr < SERVANT_GRID_SIZE && nc >= 0 && nc < SERVANT_GRID_SIZE) {
                Servant cell = servantGrid[nr][nc];
                neighbors[i] = (cell.exist && cell.npcId != -1) ? cell.npcId : -1;
            } else {
                neighbors[i] = -1;
            }
        }
        return neighbors;
    }

    /** 更新指定格子及其周围 3x3 范围内所有格子的 neighbor 信息 */
    private void updateNeighborsForCell(int row, int col) {
        int minRow = Math.max(0, row - 1);
        int maxRow = Math.min(SERVANT_GRID_SIZE - 1, row + 1);
        int minCol = Math.max(0, col - 1);
        int maxCol = Math.min(SERVANT_GRID_SIZE - 1, col + 1);
        for (int r = minRow; r <= maxRow; r++) {
            for (int c = minCol; c <= maxCol; c++) {
                servantGrid[r][c].neighbor = buildNeighborForCell(r, c);
            }
        }
    }
}
