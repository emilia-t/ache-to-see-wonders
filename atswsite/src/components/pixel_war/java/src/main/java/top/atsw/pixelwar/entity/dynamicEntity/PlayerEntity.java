package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;
import top.atsw.pixelwar.game.Inventory;
import top.atsw.pixelwar.game.Skill;

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
    public static final double HEALTH_MAX = 100;
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

    /** 玩家死亡结算结果:掉落经验值 + 掉落物品堆叠 + 掉落技能标签 */
    public record DeathDrop(double droppedExp, List<ItemStack> items, List<String> skillTags) {
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

    /** 增加游戏经验,经验足够时自动提升游戏等级 */
    public void gainExp(double amount) {
        if (amount <= 0 || isDead) {
            return;
        }
        gameExp += amount;
        while (gameExp >= getExpToNextLevel(gameLevel)) {
            gameExp -= getExpToNextLevel(gameLevel);
            gameLevel += 1;
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
     */
    private void updateEquippedSkillCooldowns(double dt, Skill.Provider skills) {
        for (int slot = 0; slot < equippedSkillCooldowns.length; slot++) {
            String tag = slot < inventory.equippedSkills.length ? inventory.equippedSkills[slot] : null;
            Skill skill = (tag == null || skills == null) ? null : skills.byTag(tag);
            if (skill == null || !skill.hasCooldown()) {
                equippedSkillCooldowns[slot] = 0;
                continue;
            }
            equippedSkillCooldowns[slot] = skill.tickCooldown(id, dt);
        }
    }

    /** 清空技能装配区中所有技能的内置CD(重生时调用) */
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

    /** 获得物品:放入背包(自动按堆叠上限堆叠) */
    public int acquireItem(String itemTag, String itemName) {
        return acquireItemCount(itemTag, itemName, 1);
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
        Inventory.ItemDefinition definition = Inventory.ItemRegistry.get(itemTag);
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
        Inventory.ItemDefinition definition = Inventory.ItemRegistry.get(entry.tag);
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
     * 取出背包与技能装配区中的全部内容,并清空背包(仅供死亡结算使用)。
     */
    private void takeInventoryForDeathDrop(List<ItemStack> itemStacks, List<String> skillTags) {
        Map<String, ItemStack> stackMap = new LinkedHashMap<>();
        for (Inventory.Entry entry : inventory.entries) {
            if (entry == null) {
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
        for (String tag : inventory.equippedSkills) {
            if (tag != null) {
                skillTags.add(tag);
            }
        }
        itemStacks.addAll(stackMap.values());
        // 背包整体清空:死亡后不再保留任何物品与技能
        this.inventory = Inventory.createEmpty();
    }

    /**
     * 玩家死亡事件:统一处理玩家死亡后需要做的事情。
     *
     * <ul>
     *   <li>清空背包:背包中的物品全部取出并掉落;</li>
     *   <li>清空技能:技能装配区中已装配的技能与背包中的技能条目一并取出并掉落;</li>
     *   <li>清空经验:结算经验掉落后经验归零(掉落经验 = ceil(经验 × 60%));</li>
     *   <li>清空等级:游戏等级归零;</li>
     *   <li>清空积分:击杀积分归零。</li>
     * </ul>
     *
     * <p>本方法只修改玩家自身状态并产出掉落清单,地面实体由世界模块依据返回值生成。</p>
     */
    public DeathDrop onDeath() {
        List<ItemStack> items = new ArrayList<>();
        List<String> skillTags = new ArrayList<>();
        takeInventoryForDeathDrop(items, skillTags);

        double droppedExp = Math.ceil(gameExp * 0.6);
        this.gameExp = 0;
        this.gameLevel = 0;
        this.playerScore = 0;

        return new DeathDrop(droppedExp, items, skillTags);
    }

    /** 重生玩家并重置临时战斗状态 */
    public void respawn(Geometry.Vec2 position, Skill.Provider skills) {
        this.position = position.copy();
        this.nextTarget = position.copy();
        this.targetHistory = new ArrayList<>(List.of(position.copy()));
        this.curvePoints = new ArrayList<>(List.of(position.copy()));
        this.currentCurveIndex = 0;
        this.health = healthMax;
        this.isDead = false;
        this.deathEffectTimer = 0;
        this.damageFlashTimer = 0;
        this.isMoving = false;
        this.stamina = staminaMax;
        this.isSprinting = false;
        this.staminaRecoveryDelayRemaining = 0;
        this.dodgeState = null;
        this.playerRule.fireCooldownNow = 0;
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
        super.applyDamage(amount);
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
            stamina = Math.max(0, stamina - SPRINT_STAMINA_DRAIN_PER_SECOND * dt);
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
        baseMoveSpeed = Math.max(MIN_MOVE_SPEED, MOVE_SPEED - servantCount * 4);
        speed = baseMoveSpeed;
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
        // 释放成功后进入技能内置冷却(冷却时长由技能自己的 maxCooldown 决定)
        dodgeSkill.startCooldown(id);
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
