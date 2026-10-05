package top.atsw.pixelwar.world;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BombEntity;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.ExpOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.LaserBulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.dynamicEntity.SkillOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.npc.GoldenDodgeXa4Npc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.NpcEntity;
import top.atsw.pixelwar.entity.dynamicEntity.npc.OnahauLoneLs1Npc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.PurpleFireworkOa18Npc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.PurpleShieldNpc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.RedPixelNpc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.SkyBluePixelNpc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.WhitePixelNpc;
import top.atsw.pixelwar.entity.dynamicEntity.npc.WhitePixelVa2Npc;
import top.atsw.pixelwar.entity.itemEntity.ItemEntity;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;
import top.atsw.pixelwar.game.DodgeSkill;
import top.atsw.pixelwar.game.Inventory;
import top.atsw.pixelwar.game.NpcLevelTable;
import top.atsw.pixelwar.game.Skill;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

/**
 * 世界状态与主循环(由前端 TS 版 Service.ts 的 MAP_DATA + updateGame 及各子系统迁移)。
 *
 * <p>单个 {@code World} 实例即一个"房间"的权威模拟:静态地图、动态实体、物品、
 * 刷怪节奏、掉落结算与玩家指令处理都在这里推进。所有变更都发生在房间自身的 tick 线程内。</p>
 */
public final class World implements WorldView {

    /** NPC 刷新权重表(按声明顺序与权重随机) */
    private static final List<java.util.function.BiFunction<Geometry.Vec2, Long, NpcEntity>> NPC_FACTORIES = List.of(
            (pos, team) -> new WhitePixelNpc(pos, null, null),
            (pos, team) -> new SkyBluePixelNpc(pos, null, null));

    private final GameConfig config;
    private final Skill.Provider skills;
    private final long roomSeed;

    private final List<StaticEntity> staticEntities = new ArrayList<>();
    private final Geometry.StaticGrid staticGrid = new Geometry.StaticGrid(400);

    private final List<PlayerEntity> players = new ArrayList<>();
    private final List<NpcEntity> npcs = new ArrayList<>();
    private final List<BulletEntity> bullets = new ArrayList<>();
    private final List<BombEntity> bombs = new ArrayList<>();
    /**
     * 激光弹的持续接触计时:子弹 id -&gt; (目标实体 id -&gt; 已累计接触 tick 数)。
     * 仅服务端使用,不参与协议;
     * 目标离开线段后对应条目会被清除,从而"再次接触时重新触发首次接触伤害"。
     */
    private final Map<Long, Map<Long, Integer>> laserContactTicks = new HashMap<>();
    private final List<ExpOrbEntity> expOrbs = new ArrayList<>();
    private final List<SkillOrbEntity> skillOrbs = new ArrayList<>();
    private final List<ItemEntity> items = new ArrayList<>();

    /** 每个玩家的刷怪计时器 */
    private final Map<Long, SpawnTimers> spawnTimers = new HashMap<>();
    /** 暂停状态(对应 TS 版 gamePaused) */
    private boolean paused;
    /** 最近的游戏事件(供房间广播后清空) */
    private final List<top.atsw.pixelwar.protocol.Protocol.GameEvent> pendingEvents = new ArrayList<>();
    private long tickCount;

    private static final class SpawnTimers {
        double npcHigh;
        double npcMedium;
        double npcLow;
        double itemHigh;
        double itemMedium;
        double itemLow;

        SpawnTimers(GameConfig config) {
            npcHigh = config.npcSpawnHighInterval;
            npcMedium = config.npcSpawnMediumInterval;
            npcLow = config.npcSpawnLowInterval;
            itemHigh = config.itemSpawnHighInterval;
            itemMedium = config.itemSpawnMediumInterval;
            itemLow = config.itemSpawnLowInterval;
        }
    }

    public World(GameConfig config, Skill.Provider skills, long roomSeed) {
        this.config = config;
        this.skills = skills;
        this.roomSeed = roomSeed;
        initStaticMap();
    }

    public GameConfig config() {
        return config;
    }

    // ==================================================================
    // 世界视图(WorldView)
    // ==================================================================

    @Override
    public List<StaticEntity> staticEntities() {
        return staticEntities;
    }

    @Override
    public boolean isPointCollidingStatic(double x, double y) {
        return staticGrid.isPointColliding(x, y);
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<StaticEntity> staticEntitiesInRect(double x, double y, double width, double height) {
        List<Object> raw = staticGrid.getEntitiesInRect(x, y, width, height);
        List<StaticEntity> result = new ArrayList<>(raw.size());
        for (Object o : raw) {
            result.add((StaticEntity) o);
        }
        return result;
    }

    @Override
    public List<PlayerEntity> players() {
        return players;
    }

    @Override
    public List<DynamicEntity> npcEntities() {
        return new ArrayList<>(npcs);
    }

    @Override
    public Skill.Provider skills() {
        return skills;
    }

    // ==================================================================
    // 集合访问
    // ==================================================================

    public List<NpcEntity> npcs() {
        return npcs;
    }

    public List<BulletEntity> bullets() {
        return bullets;
    }

    public List<BombEntity> bombs() {
        return bombs;
    }

    public List<ExpOrbEntity> expOrbs() {
        return expOrbs;
    }

    public List<SkillOrbEntity> skillOrbs() {
        return skillOrbs;
    }

    public List<ItemEntity> items() {
        return items;
    }

    public long tickCount() {
        return tickCount;
    }

    public boolean isPaused() {
        return paused;
    }

    public void setPaused(boolean paused) {
        this.paused = paused;
        pushEvent("tick_pause", Map.of("paused", paused));
    }

    public void togglePaused() {
        setPaused(!paused);
    }

    public List<top.atsw.pixelwar.protocol.Protocol.GameEvent> drainEvents() {
        List<top.atsw.pixelwar.protocol.Protocol.GameEvent> copy = new ArrayList<>(pendingEvents);
        pendingEvents.clear();
        return copy;
    }

    private void pushEvent(String event, Map<String, Object> data) {
        pendingEvents.add(new top.atsw.pixelwar.protocol.Protocol.GameEvent(event, data));
    }

    // ==================================================================
    // 玩家管理
    // ==================================================================

    /** 加入一名玩家,返回新玩家实体 */
    public PlayerEntity addPlayer(Long teamId, String playerName) {
        PlayerEntity player = new PlayerEntity(resolveSpawnPointForNewPlayer(), teamId, playerName);
        players.add(player);
        spawnTimers.put(player.id, new SpawnTimers(config));
        pushEvent("player_joined", Map.of("playerId", player.id, "name", playerName));
        return player;
    }

    /**
     * 新玩家的出生点。
     *
     * <p>房间内已有玩家时,优先在其附近(150 ~ 配置半径,默认 300px)找一个安全出生点。
     * 该距离明显小于客户端画面可视半径(约 530×368px),使多人进房即可在画面上看到彼此;
     * 否则使用地图内随机出生点。</p>
     */
    private Geometry.Vec2 resolveSpawnPointForNewPlayer() {
        if (!config.spawnNearPlayers || players.isEmpty()) {
            return randomSpawnPoint();
        }
        PlayerEntity anchor = players.get(0);
        double minRadius = 150;
        double maxRadius = Math.max(minRadius + 100, config.spawnNearPlayersRadius);
        for (int i = 0; i < 40; i++) {
            double angle = Math.random() * Math.PI * 2;
            double radius = minRadius + Math.random() * (maxRadius - minRadius);
            Geometry.Vec2 candidate = new Geometry.Vec2(
                    anchor.position.x + Math.cos(angle) * radius,
                    anchor.position.y + Math.sin(angle) * radius);
            if (isSpawnPointUsable(candidate)) {
                return candidate;
            }
        }
        return randomSpawnPoint();
    }

    /** 出生点是否可用:在世界范围内、不与静态实体碰撞、且不与其他玩家重叠 */
    private boolean isSpawnPointUsable(Geometry.Vec2 point) {
        double margin = Math.max(PlayerEntity.WIDTH, PlayerEntity.HEIGHT) + 25;
        if (point.x < config.worldMinX + margin || point.x > config.worldMaxX - margin
                || point.y < config.worldMinY + margin || point.y > config.worldMaxY - margin) {
            return false;
        }
        double halfW = PlayerEntity.WIDTH / 2;
        double halfH = PlayerEntity.HEIGHT / 2;
        double[][] probes = {
                {point.x - halfW, point.y - halfH},
                {point.x + halfW, point.y - halfH},
                {point.x - halfW, point.y + halfH},
                {point.x + halfW, point.y + halfH}};
        for (double[] probe : probes) {
            if (staticGrid.isPointColliding(probe[0], probe[1])) {
                return false;
            }
        }
        for (PlayerEntity other : players) {
            // 仅避免与其他玩家重叠(两个 25px 方块间距 120px 已足够分开)
            if (Geometry.distance(point.x, point.y, other.position.x, other.position.y) < 120) {
                return false;
            }
        }
        return true;
    }

    /** 移除一名玩家 */
    public void removePlayer(long playerId) {
        PlayerEntity player = getPlayerById(playerId);
        if (player == null) {
            return;
        }
        // 释放该玩家所有从者
        for (Long npcId : player.getAllServantIds()) {
            NpcEntity npc = getNpcById(npcId);
            if (npc != null) {
                npc.releaseOwner();
            }
        }
        players.remove(player);
        spawnTimers.remove(playerId);
        pushEvent("player_left", Map.of("playerId", playerId));
    }

    public PlayerEntity getPlayerById(long playerId) {
        for (PlayerEntity player : players) {
            if (player.id == playerId) {
                return player;
            }
        }
        return null;
    }

    public NpcEntity getNpcById(long npcId) {
        for (NpcEntity npc : npcs) {
            if (npc.id == npcId) {
                return npc;
            }
        }
        return null;
    }

    /** 重生玩家(随机出生点)。死亡等待时间(X = 3 + 等级 / 3,上限 30 秒)未结束时忽略请求。 */
    public void respawnPlayer(long playerId) {
        PlayerEntity player = getPlayerById(playerId);
        if (player == null) {
            return;
        }
        if (!player.canRespawnNow()) {
            return;
        }
        player.respawn(randomSpawnPoint(), skills);
    }

    /**
     * 把「造成伤害的实体 id」(子弹 / 炸弹的 ownerId)解析为死亡界面要展示的名称。
     *
     * <ul>
     *   <li>玩家 → 玩家名;</li>
     *   <li>玩家的从者 NPC → 该从者所属玩家名;</li>
     *   <li>无主 NPC → 该 NPC 类型的显示名称(静态 NAME,例如「红色像素」)。</li>
     * </ul>
     *
     * @return 展示名称;来源为 null 或无法解析时返回空串(由调用方决定兜底文案)
     */
    private String resolveDamagerName(Long sourceEntityId) {
        if (sourceEntityId == null) {
            return "";
        }
        PlayerEntity player = getPlayerById(sourceEntityId);
        if (player != null) {
            return player.playerName == null ? "" : player.playerName;
        }
        NpcEntity npc = getNpcById(sourceEntityId);
        if (npc != null) {
            if (npc.ownerId != null) {
                PlayerEntity owner = getPlayerById(npc.ownerId);
                if (owner != null) {
                    return owner.playerName == null ? "" : owner.playerName;
                }
            }
            return npc.displayName();
        }
        return "";
    }

    /** 记录玩家受到的伤害来源(用于死亡界面「你被 xxx 击倒了」) */
    private void recordDamageSource(PlayerEntity target, Long sourceEntityId) {
        String name = resolveDamagerName(sourceEntityId);
        if (!name.isEmpty()) {
            target.lastDamagerName = name;
        }
    }

    /**
     * 在地图范围内随机生成一个重生点,并避免与静态实体重叠。
     */
    public Geometry.Vec2 randomSpawnPoint() {
        double margin = Math.max(PlayerEntity.WIDTH, PlayerEntity.HEIGHT) + 25;
        double minX = config.worldMinX + margin;
        double maxX = config.worldMaxX - margin;
        double minY = config.worldMinY + margin;
        double maxY = config.worldMaxY - margin;
        for (int i = 0; i < 30; i++) {
            Geometry.Vec2 point = new Geometry.Vec2(
                    minX + Math.random() * (maxX - minX),
                    minY + Math.random() * (maxY - minY));
            if (!staticGrid.isPointColliding(point.x, point.y)) {
                return point;
            }
        }
        return new Geometry.Vec2(0, 0);
    }

    // ==================================================================
    // 静态地图初始化
    // ==================================================================

    /** 构建边界围墙(四条长条 + 四个角块),与 TS 版 initMapData 完全一致 */
    private void initStaticMap() {
        double curbHalfSide = config.worldSize / 2;
        double unit = StaticEntity.TILE * StaticEntity.LENGTH;
        double start = -curbHalfSide + unit / 2;
        double end = curbHalfSide - unit / 2;

        double topY = -curbHalfSide - 25;
        double bottomY = curbHalfSide + 25;
        for (double x = start; x <= end; x += unit) {
            staticEntities.add(StaticEntity.curb8(new Geometry.Vec2(x, topY), "up"));
            staticEntities.add(StaticEntity.curb8(new Geometry.Vec2(x, bottomY), "down"));
        }
        double leftX = -curbHalfSide - 25;
        double rightX = curbHalfSide + 25;
        for (double y = start; y <= end; y += unit) {
            staticEntities.add(StaticEntity.curb8(new Geometry.Vec2(leftX, y), "left"));
            staticEntities.add(StaticEntity.curb8(new Geometry.Vec2(rightX, y), "right"));
        }
        staticEntities.add(StaticEntity.curb(new Geometry.Vec2(-curbHalfSide - 25, -curbHalfSide - 25)));
        staticEntities.add(StaticEntity.curb(new Geometry.Vec2(curbHalfSide + 25, -curbHalfSide - 25)));
        staticEntities.add(StaticEntity.curb(new Geometry.Vec2(-curbHalfSide - 25, curbHalfSide + 25)));
        staticEntities.add(StaticEntity.curb(new Geometry.Vec2(curbHalfSide + 25, curbHalfSide + 25)));

        staticGrid.index(staticEntities, e -> ((StaticEntity) e).collisionBox);
    }

    // ==================================================================
    // 主循环
    // ==================================================================

    /** 推进一个 tick(对应 TS 版 updateGame) */
    public void tick(double dt) {
        if (paused) {
            return;
        }
        tickCount++;
        beginTick(dt);
        updateItemLifetimes(dt);
        updateDynamicEntities(dt);
        updateItemPickups();
        updateBullets(dt);
        updateBombs(dt);
        settleDeaths();
        updateOrbs(dt);
        runNpcActionLoops();
        spawnAroundPlayers(dt);
        removeFinishedDeadEntities();
        resolveDynamicEntityCollisions();
    }

    /** 玩家与 NPC 的位置更新、死亡特效推进、从者断连处理 */
    private void updateDynamicEntities(double dt) {
        for (PlayerEntity player : players) {
            // 复活等待时间与地图外伤害:死亡期间 update() 会直接返回,必须在这里单独推进
            player.updateDeathAndOutOfMapState(dt, config);
            player.update(dt, this, config);
            player.updateDamageEffect(dt);
            player.updateDeathEffect(dt);
        }
        for (NpcEntity npc : npcs) {
            npc.update(dt, this, config);
            npc.updateDamageEffect(dt);
            npc.updateDeathEffect(dt);
            if (npc.isDead) {
                resolvePlayerServantDead(npc);
            }
        }
    }

    /** 地面物品寿命 */
    private void updateItemLifetimes(double dt) {
        for (ItemEntity item : items) {
            item.updateLifetime(dt);
        }
        items.removeIf(ItemEntity::isReadyToRemove);
    }

    /** 玩家拾取地面物品(按堆叠数量结算,装不下的继续留在地上) */
    private void updateItemPickups() {
        if (items.isEmpty() || players.isEmpty()) {
            return;
        }
        for (ItemEntity item : items) {
            if (item.isDisappearing) {
                continue;
            }
            for (PlayerEntity player : players) {
                if (player.isDead) {
                    continue;
                }
                double pickupRadius = (player.width + item.width) / 2;
                if (Geometry.distance(player.position.x, player.position.y, item.position.x, item.position.y) > pickupRadius) {
                    continue;
                }
                if (!player.canAcceptItem(item.tag)) {
                    break;
                }
                int accepted = player.acquireItemCount(item.tag, item.name, item.count);
                if (accepted <= 0) {
                    break;
                }
                item.count -= accepted;
                if (item.count <= 0) {
                    item.beginDisappear();
                }
                pushEvent("item_picked", Map.of(
                        "playerId", player.id, "tag", item.tag, "count", accepted));
                break;
            }
        }
    }

    /** 子弹飞行与命中判定(空间哈希加速) */
    private void updateBullets(double dt) {
        if (bullets.isEmpty()) {
            return;
        }
        List<DynamicEntity> aliveTargets = new ArrayList<>();
        for (PlayerEntity player : players) {
            if (!player.isDead) {
                aliveTargets.add(player);
            }
        }
        for (NpcEntity npc : npcs) {
            if (!npc.isDead) {
                aliveTargets.add(npc);
            }
        }

        final double cellSize = 64;
        Map<Long, List<DynamicEntity>> spatial = new HashMap<>();
        for (DynamicEntity entity : aliveTargets) {
            long key = cellKey((int) Math.floor(entity.position.x / cellSize), (int) Math.floor(entity.position.y / cellSize));
            spatial.computeIfAbsent(key, k -> new ArrayList<>()).add(entity);
        }

        for (BulletEntity bullet : bullets) {
            bullet.updateBullet(dt, this);
            if (bullet.shouldRemove) {
                continue;
            }
            // 激光弹为线段型子弹:命中/持续伤害走独立分支,且不会因命中而消失
            if (bullet instanceof LaserBulletEntity laserBullet) {
                // 发射者一旦移动(被推动/瞬移/重新游走)先前的激光即失去源头,必须立刻移除
                if (isLaserDetachedFromShooter(laserBullet)) {
                    laserBullet.shouldRemove = true;
                    continue;
                }
                updateLaserHits(laserBullet, aliveTargets);
                continue;
            }
            int bx = (int) Math.floor(bullet.position.x / cellSize);
            int by = (int) Math.floor(bullet.position.y / cellSize);
            List<DynamicEntity> candidates = new ArrayList<>();
            for (int dx = -1; dx <= 1; dx++) {
                for (int dy = -1; dy <= 1; dy++) {
                    List<DynamicEntity> list = spatial.get(cellKey(bx + dx, by + dy));
                    if (list != null) {
                        candidates.addAll(list);
                    }
                }
            }

            for (DynamicEntity entity : candidates) {
                if (entity.isDead) {
                    continue;
                }
                if (bullet.ownerId != null && bullet.ownerId == entity.id) {
                    continue;// 避免自残
                }
                if (bullet.teamId != null && bullet.teamId.equals(entityTeamId(entity))) {
                    continue;// 避免误伤队友
                }
                // 敌对 NPC 发射的子弹(teamId == null)与敌对 NPC(teamId == null)之间直接穿透
                if (bullet.teamId == null && entity instanceof NpcEntity npcEntity && npcEntity.teamId == null) {
                    continue;
                }

                double hitDistance = Geometry.distance(entity.position.x, entity.position.y,
                        bullet.position.x, bullet.position.y);
                double hitRadius = entity.width * 0.45 + bullet.width * 0.5;
                if (hitDistance <= hitRadius) {
                    applyBulletDamage(bullet.ownerId, bullet.teamId, entity, bullet.damage);
                    bullet.shouldRemove = true;
                    break;
                }
            }
        }
        bullets.removeIf(b -> b.shouldRemove);

        // 清理已消失激光弹的持续接触计时(避免长期运行下残留无用条目)
        if (!laserContactTicks.isEmpty()) {
            Set<Long> aliveBulletIds = new HashSet<>();
            for (BulletEntity bullet : bullets) {
                aliveBulletIds.add(bullet.id);
            }
            laserContactTicks.keySet().removeIf(id -> !aliveBulletIds.contains(id));
        }
    }

    /**
     * 对目标施加一次子弹伤害,并结算击杀归属(玩家积分 / 幸运之星的击杀者记录)。
     * 普通子弹与激光弹共用,避免两处重复。
     */
    private void applyBulletDamage(Long attackerOwnerId, Long attackerTeamId,
                                   DynamicEntity entity, double damage) {
        boolean wasAlive = !entity.isDead;
        // 记录伤害来源(用于死亡界面「你被 xxx 击倒了」)
        if (entity instanceof PlayerEntity playerTarget) {
            recordDamageSource(playerTarget, attackerOwnerId);
        }
        entity.applyDamage(damage);
        if (wasAlive && entity.isDead && entity instanceof NpcEntity killerTarget) {
            creditKill(attackerOwnerId, attackerTeamId, killerTarget);
        }
    }

    /** 激光"失去源头"的判定容差(px):发射者离开锚点超过该距离即视为已经移动 */
    private static final double LASER_ANCHOR_TOLERANCE = 0.5;

    /**
     * 判断一束激光是否已"失去源头"而应立刻移除。
     *
     * <p>激光的设定是"从固定炮位射出的静止光束":无论发射者是玩家还是 NPC,
     * 在光束存活期间都必须原地不动。因此只要发射者离开发射点——被其它实体推动、
     * 玩家移动/闪现、NPC 被吸附为从者后瞬移回网格、被释放后重新开始游走等——
     * 这束激光就失去了源头,必须立刻移除,否则会留下一道与发射者脱节的无源光束
     * (表现为"镭射弹留在原地")。</p>
     *
     * @param laser 待判断的激光弹
     * @return 是否需要立刻移除该激光
     */
    private boolean isLaserDetachedFromShooter(LaserBulletEntity laser) {
        Geometry.Vec2 anchor = laser.laserAnchor;
        if (anchor == null || laser.ownerId == null) {
            return false;// 未写锚点的激光不处理
        }
        // 发射者既可能是玩家(技能「激光束」),也可能是 NPC(幽蓝孤光)
        DynamicEntity owner = getNpcById(laser.ownerId);
        if (owner == null) {
            owner = getPlayerById(laser.ownerId);
        }
        if (owner == null) {
            return true;// 发射者已不存在(被击杀/清理/断线)
        }
        // 发射者一旦移动(含被推动、玩家移动/闪现、从者瞬移回网格)即视为失去源头
        return Geometry.distance(owner.position.x, owner.position.y, anchor.x, anchor.y) > LASER_ANCHOR_TOLERANCE;
    }

    /**
     * 激光弹命中结算(线段型子弹,规则与 TS 版 Service.updateLaserBulletHits 对齐):
     * <ul>
     *   <li>目标碰到线段即受伤(可同时命中多个目标,激光不会因命中消失);</li>
     *   <li>首次接触立即造成 1 次基础伤害;</li>
     *   <li>持续接触每累计 CONTACT_TICK_INTERVAL(20) 刻,再造成 基础伤害 × 2;</li>
     *   <li>目标离开线段后计时重置,再次接触时重新触发首次接触伤害。</li>
     * </ul>
     */
    private void updateLaserHits(LaserBulletEntity laser, List<DynamicEntity> targets) {
        Geometry.Vec2 dir = laser.unitDirection();
        double length = laser.lengthAt(laser.laserElapsed);
        double startX = laser.position.x;
        double startY = laser.position.y;
        double endX = startX + dir.x * length;
        double endY = startY + dir.y * length;

        Map<Long, Integer> perTarget = laserContactTicks.computeIfAbsent(laser.id, k -> new HashMap<>());
        Set<Long> touched = new HashSet<>();

        for (DynamicEntity entity : targets) {
            if (entity.isDead) {
                continue;
            }
            if (laser.ownerId != null && laser.ownerId == entity.id) {
                continue;// 避免自残
            }
            if (laser.teamId != null && laser.teamId.equals(entityTeamId(entity))) {
                continue;// 避免误伤队友
            }
            // 敌对 NPC 发射的激光(teamId == null)与敌对 NPC(teamId == null)之间直接穿透
            if (laser.teamId == null && entity instanceof NpcEntity npcEntity && npcEntity.teamId == null) {
                continue;
            }

            double distance = distancePointToSegment(
                    entity.position.x, entity.position.y, startX, startY, endX, endY);
            double hitRadius = entity.width * 0.45 + LaserBulletEntity.HIT_HALF_WIDTH;
            if (distance > hitRadius) {
                continue;
            }

            touched.add(entity.id);
            Integer ticks = perTarget.get(entity.id);
            if (ticks == null) {
                // 首次接触:立即造成 1 次基础伤害
                perTarget.put(entity.id, 0);
                applyBulletDamage(laser.ownerId, laser.teamId, entity, laser.damage);
                continue;
            }

            int next = ticks + 1;
            if (next >= LaserBulletEntity.CONTACT_TICK_INTERVAL) {
                perTarget.put(entity.id, 0);
                applyBulletDamage(laser.ownerId, laser.teamId, entity,
                        laser.damage * LaserBulletEntity.CONTACT_DAMAGE_MULTIPLIER);
            } else {
                perTarget.put(entity.id, next);
            }
        }

        // 离开线段的目标重置计时
        perTarget.keySet().removeIf(id -> !touched.contains(id));
    }

    /** 点到线段的最短距离(线段退化为点时即点到点距离) */
    private static double distancePointToSegment(double px, double py,
                                                double x1, double y1, double x2, double y2) {
        double segX = x2 - x1;
        double segY = y2 - y1;
        double segLengthSq = segX * segX + segY * segY;
        if (segLengthSq < 1e-6) {
            return Math.hypot(px - x1, py - y1);
        }
        double t = ((px - x1) * segX + (py - y1) * segY) / segLengthSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + segX * t), py - (y1 + segY * t));
    }

    private Long entityTeamId(DynamicEntity entity) {
        if (entity instanceof PlayerEntity player) {
            return player.teamId;
        }
        if (entity instanceof NpcEntity npc) {
            return npc.teamId;
        }
        return null;
    }

    /** 击杀计分:玩家击杀直接加分;从者击杀则给其主人加分 */
    private void creditKill(Long killerOwnerId, Long killerTeamId, NpcEntity victim) {
        pushEvent("npc_killed", Map.of(
                "npcId", victim.id, "tag", victim.tag, "killScore", victim.killScore));
        if (killerOwnerId == null) {
            return;
        }
        PlayerEntity owner = getPlayerById(killerOwnerId);
        if (owner != null) {
            owner.playerScore += victim.killScore;
            victim.lastKillerPlayerId = owner.id;
        }
        if (killerTeamId != null) {
            NpcEntity killerNpc = getNpcById(killerOwnerId);
            if (killerNpc != null && killerNpc.ownerId != null) {
                PlayerEntity npcOwner = getPlayerById(killerNpc.ownerId);
                if (npcOwner != null) {
                    npcOwner.playerScore += victim.killScore;
                    victim.lastKillerPlayerId = npcOwner.id;
                }
            }
        }
    }

    /** 炸弹倒计时与范围爆炸 */
    private void updateBombs(double dt) {
        if (bombs.isEmpty()) {
            return;
        }
        Iterator<BombEntity> iterator = bombs.iterator();
        List<BombEntity> exploded = new ArrayList<>();
        while (iterator.hasNext()) {
            BombEntity bomb = iterator.next();
            if (bomb.updateBomb(dt)) {
                exploded.add(bomb);
                iterator.remove();
            }
        }
        for (BombEntity bomb : exploded) {
            bomb.isDead = true;
            bomb.deathEffectTimer = 0;
            for (PlayerEntity player : players) {
                if (player.isDead || (bomb.ownerId != null && bomb.ownerId == player.id)) {
                    continue;
                }
                if (Geometry.distance(player.position.x, player.position.y, bomb.position.x, bomb.position.y)
                        <= bomb.explosionRadius) {
                    // 记录伤害来源(用于死亡界面「你被 xxx 击倒了」):
                    // 优先按 ownerId 解析,生成者已被清理时退回生成时记录的名称
                    String damagerName = resolveDamagerName(bomb.ownerId);
                    if (damagerName.isEmpty()) {
                        damagerName = bomb.damageSourceName;
                    }
                    if (!damagerName.isEmpty()) {
                        player.lastDamagerName = damagerName;
                    }
                    player.applyDamage(bomb.explosionDamage);
                }
            }
            for (NpcEntity npc : npcs) {
                if (npc.isDead || (bomb.ownerId != null && bomb.ownerId == npc.id)) {
                    continue;
                }
                if (Geometry.distance(npc.position.x, npc.position.y, bomb.position.x, bomb.position.y)
                        <= bomb.explosionRadius) {
                    npc.applyDamage(bomb.explosionDamage);
                }
            }
            pushEvent("bomb_exploded", Map.of("x", bomb.position.x, "y", bomb.position.y));
        }
    }

    /**
     * 死亡结算:
     * <ul>
     *   <li>NPC:60% 经验掉落为经验球 + 按战利品配置掉落技能球(死亡特效钩子后执行);</li>
     *   <li>玩家:从者跟随死亡 + 调用玩家实体的死亡事件(清空背包/技能/等级/经验/积分)并把掉落物落在地面。</li>
     * </ul>
     */
    private void settleDeaths() {
        for (NpcEntity npc : npcs) {
            if (npc.isDead && npc instanceof RedPixelNpc redPixel) {
                redPixel.onDeathEffects(buildActionContext());
            }
            if (!npc.isDead || npc.deathExpProcessed) {
                continue;
            }
            npc.deathExpProcessed = true;
            double dropExp = Math.ceil(npc.gameExp * 0.6);
            npc.gameExp = 0;
            if (dropExp > 0) {
                spawnExpOrbs(npc.position, dropExp);
            }
        }

        for (NpcEntity npc : npcs) {
            if (!npc.isDead || npc.deathLootProcessed) {
                continue;
            }
            npc.deathLootProcessed = true;
            if (npc.ownerId != null || npc.loot.isEmpty()) {
                continue;// 玩家从者不产出战利品
            }
            // 专研"幸运之星":按击杀者(或其从者主人)的等级提升逐条掉落概率
            PlayerEntity killer = npc.lastKillerPlayerId != null
                    ? getPlayerById(npc.lastKillerPlayerId) : null;
            double luckyBonus = killer != null ? killer.getLuckyStarBonus() : 0;
            for (NpcEntity.Loot loot : npc.loot) {
                if (!"skillOrb".equals(loot.type())) {
                    continue;
                }
                double odds = Geometry.clamp(loot.odds() + luckyBonus, 0, 1);
                if (Math.random() < odds) {
                    spawnSkillOrb(npc.position, loot.tag());
                }
            }
        }

        for (PlayerEntity player : players) {
            if (!player.isDead || player.deathExpProcessed) {
                continue;
            }
            player.deathExpProcessed = true;
            killPlayerServantsOnPlayerDeath(player);
            PlayerEntity.DeathDrop drop = player.onDeath();
            spawnPlayerDeathDrops(player.position, drop);
            if (drop.droppedExp() > 0) {
                spawnExpOrbs(player.position, drop.droppedExp());
            }
            pushEvent("player_died", Map.of("playerId", player.id));
        }
    }

    /** 玩家死亡掉落:物品按堆叠落地,技能落成技能球 */
    private void spawnPlayerDeathDrops(Geometry.Vec2 position, PlayerEntity.DeathDrop drop) {
        Geometry.Vec2 origin = position.copy();
        for (PlayerEntity.ItemStack stack : drop.items()) {
            items.add(new ItemEntity(randomDropPosition(origin), stack.tag(), stack.name(), stack.count()));
        }
        for (String skillTag : drop.skillTags()) {
            spawnSkillOrb(origin, skillTag);
        }
    }

    /** 掉落物落点:在中心位置周围随机散布,尽量避开静态实体 */
    private Geometry.Vec2 randomDropPosition(Geometry.Vec2 origin) {
        for (int i = 0; i < 12; i++) {
            double angle = Math.random() * Math.PI * 2;
            double dist = 8 + Math.random() * 30;
            Geometry.Vec2 position = new Geometry.Vec2(
                    origin.x + Math.cos(angle) * dist,
                    origin.y + Math.sin(angle) * dist);
            if (!staticGrid.isPointColliding(position.x, position.y)) {
                return position;
            }
        }
        return origin.copy();
    }

    /** 玩家死亡时其所有从者跟随死亡 */
    private void killPlayerServantsOnPlayerDeath(PlayerEntity player) {
        for (Long npcId : player.getAllServantIds()) {
            player.removeServant(npcId);
            NpcEntity npc = getNpcById(npcId);
            if (npc != null && !npc.isDead) {
                npc.releaseOwner();
                npc.health = 0;
                npc.triggerDeath();
            }
        }
    }

    /** 从者死亡后的断连释放(网格断连的从者一并释放并停止跟随) */
    private void resolvePlayerServantDead(NpcEntity npcEntity) {
        if (npcEntity.ownerId == null) {
            return;
        }
        PlayerEntity owner = getPlayerById(npcEntity.ownerId);
        if (owner == null) {
            return;
        }
        PlayerEntity.Servant deadServant = owner.selectServantByID(npcEntity.id);
        if (deadServant == null) {
            return;
        }
        List<Long> disconnected = owner.releaseDisconnectedServants(deadServant, npcId -> {
            NpcEntity npc = getNpcById(npcId);
            if (npc != null) {
                npc.releaseOwner();
            }
        });
        for (Long id : disconnected) {
            owner.removeServant(id);
        }
    }

    /** 经验球与技能球更新(吸引 / 拾取 / 超时消失) */
    private void updateOrbs(double dt) {
        for (ExpOrbEntity orb : expOrbs) {
            orb.updateOrb(dt, players);
        }
        expOrbs.removeIf(orb -> orb.isPickedUp || orb.isDeathEffectFinished() && orb.isDead);

        for (SkillOrbEntity orb : skillOrbs) {
            orb.updateOrb(dt, players, skills);
        }
        skillOrbs.removeIf(orb -> orb.isPickedUp);
    }

    /** 在指定位置随机爆出经验球 */
    public void spawnExpOrbs(Geometry.Vec2 position, double totalValue) {
        if (totalValue <= 0) {
            return;
        }
        for (int value : ExpOrbEntity.splitExpValueIntoOrbs(totalValue)) {
            double angle = Math.random() * Math.PI * 2;
            double dist = Math.random() * 36;
            ExpOrbEntity orb = new ExpOrbEntity(new Geometry.Vec2(
                    position.x + Math.cos(angle) * dist,
                    position.y + Math.sin(angle) * dist), value);
            double burstAngle = Math.random() * Math.PI * 2;
            double burstSpeed = 60 + Math.random() * 100;
            orb.motionVelocity = new Geometry.Vec2(
                    Math.cos(burstAngle) * burstSpeed,
                    Math.sin(burstAngle) * burstSpeed);
            expOrbs.add(orb);
        }
    }

    /** 在指定位置爆出一个技能球 */
    public void spawnSkillOrb(Geometry.Vec2 position, String skillTag) {
        double angle = Math.random() * Math.PI * 2;
        double dist = 10 + Math.random() * 26;
        SkillOrbEntity orb = new SkillOrbEntity(new Geometry.Vec2(
                position.x + Math.cos(angle) * dist,
                position.y + Math.sin(angle) * dist), skillTag, skills);
        double burstAngle = Math.random() * Math.PI * 2;
        double burstSpeed = 50 + Math.random() * 90;
        orb.motionVelocity = new Geometry.Vec2(
                Math.cos(burstAngle) * burstSpeed,
                Math.sin(burstAngle) * burstSpeed);
        skillOrbs.add(orb);
    }

    /** 移除已结束死亡特效的 NPC(玩家实体保留快照以便重生) */
    private void removeFinishedDeadEntities() {
        npcs.removeIf(DynamicEntity::isDeathEffectFinished);
    }

    // ==================================================================
    // 刷怪
    // ==================================================================

    private void spawnAroundPlayers(double dt) {
        for (PlayerEntity player : players) {
            if (player.isDead) {
                continue;
            }
            SpawnTimers timers = spawnTimers.computeIfAbsent(player.id, id -> new SpawnTimers(config));
            if (npcs.size() < config.npcSpawnMaxCount) {
                timers.npcHigh = spawnNpcInRing(player, timers.npcHigh, dt, config.npcSpawnHighInterval,
                        config.npcSpawnNoSpawnRadius, config.npcSpawnHighRadius);
                timers.npcMedium = spawnNpcInRing(player, timers.npcMedium, dt, config.npcSpawnMediumInterval,
                        config.npcSpawnHighRadius, config.npcSpawnMediumRadius);
                timers.npcLow = spawnNpcInRing(player, timers.npcLow, dt, config.npcSpawnLowInterval,
                        config.npcSpawnMediumRadius, config.npcSpawnLowRadius);
            }
            if (items.size() < config.itemSpawnMaxCount) {
                timers.itemHigh = spawnItemInRing(player, timers.itemHigh, dt, config.itemSpawnHighInterval,
                        config.itemSpawnNoSpawnRadius, config.itemSpawnHighRadius);
                timers.itemMedium = spawnItemInRing(player, timers.itemMedium, dt, config.itemSpawnMediumInterval,
                        config.itemSpawnHighRadius, config.itemSpawnMediumRadius);
                timers.itemLow = spawnItemInRing(player, timers.itemLow, dt, config.itemSpawnLowInterval,
                        config.itemSpawnMediumRadius, config.itemSpawnLowRadius);
            }
        }
    }

    private double spawnNpcInRing(PlayerEntity player, double timer, double dt, double interval,
                                  double minRadius, double maxRadius) {
        double next = timer - dt;
        while (next <= 0 && npcs.size() < config.npcSpawnMaxCount) {
            trySpawnNpc(player.position, minRadius, maxRadius);
            next += interval;
        }
        return next;
    }

    private double spawnItemInRing(PlayerEntity player, double timer, double dt, double interval,
                                   double minRadius, double maxRadius) {
        double next = timer - dt;
        while (next <= 0 && items.size() < config.itemSpawnMaxCount) {
            trySpawnItem(player.position, minRadius, maxRadius);
            next += interval;
        }
        return next;
    }

    private void trySpawnNpc(Geometry.Vec2 center, double minRadius, double maxRadius) {
        for (int i = 0; i < config.npcSpawnMaxAttempts; i++) {
            Geometry.Vec2 position = randomPointInRing(center, minRadius, maxRadius);
            if (!canSpawnAt(position, false, true)) {
                continue;
            }
            // 多人刷怪交叉区域降刷怪率:被 n 个玩家的刷怪区域同时覆盖时,仅以 1/n 概率生成,
            // 使重叠区域的总刷怪率回到单人水平(否则每个玩家各有一套计时器会导致刷怪量成倍增加)。
            int coverage = countPlayersCovering(position, config.npcSpawnLowRadius);
            if (coverage > 1 && Math.random() > 1.0 / coverage) {
                continue;
            }
            NpcEntity npc = createRandomNpc(position);
            npc.setTarget(position, this, true);
            npcs.add(npc);
            return;
        }
    }

    private void trySpawnItem(Geometry.Vec2 center, double minRadius, double maxRadius) {
        for (int i = 0; i < config.itemSpawnMaxAttempts; i++) {
            Geometry.Vec2 position = randomPointInRing(center, minRadius, maxRadius);
            if (!canSpawnAt(position, true, false)) {
                continue;
            }
            // 与刷怪同理:交叉区域按覆盖人数下调生成概率
            int coverage = countPlayersCovering(position, config.itemSpawnLowRadius);
            if (coverage > 1 && Math.random() > 1.0 / coverage) {
                continue;
            }
            // 目前物品注册表中只有"治疗宝石"
            items.add(new ItemEntity(position, "healing_gem", "治疗宝石", 1));
            return;
        }
    }

    /** 统计有多少个存活玩家的刷怪区域(以玩家为圆心的 radius 圆)覆盖该点 */
    private int countPlayersCovering(Geometry.Vec2 position, double radius) {
        int count = 0;
        double radiusSquared = radius * radius;
        for (PlayerEntity player : players) {
            if (player.isDead) {
                continue;
            }
            double dx = player.position.x - position.x;
            double dy = player.position.y - position.y;
            if (dx * dx + dy * dy <= radiusSquared) {
                count++;
            }
        }
        return count;
    }

    /**
     * 按权重随机创建一个 NPC。
     * 权重与 TS 版一致:白像素 0.8、va2 0.4、天蓝像素 0.2、红像素 0.1、紫盾 0.08、
     * 金色闪避者 0.11、紫色烟花 oa18 0.21、幽蓝孤光 ls1 0.14。
     */
    private NpcEntity createRandomNpc(Geometry.Vec2 position) {
        double total = 0.2 + 0.1 + 0.4 + 0.8 + 0.08 + 0.11 + 0.21 + 0.14;
        double random = Math.random() * total;
        NpcEntity npc;
        if (random < 0.8) {
            npc = new WhitePixelNpc(position, null, null);
        } else if ((random -= 0.8) < 0.4) {
            npc = new WhitePixelVa2Npc(position, null, null);
        } else if ((random -= 0.4) < 0.2) {
            npc = new SkyBluePixelNpc(position, null, null);
        } else if ((random -= 0.2) < 0.1) {
            npc = new RedPixelNpc(position, null, null);
        } else if ((random -= 0.1) < 0.11) {
            npc = new GoldenDodgeXa4Npc(position, null, null);
        } else if ((random -= 0.11) < 0.21) {
            npc = new PurpleFireworkOa18Npc(position, null, null);
        } else if ((random -= 0.21) < 0.14) {
            npc = new OnahauLoneLs1Npc(position, null, null);
        } else {
            npc = new PurpleShieldNpc(position, null, null);
        }
        // 按等级概率表随机等级(等级越高能力越强;默认等级 0)
        npc.applyNpcLevel(NpcLevelTable.rollLevel(npc.maxLevel()));
        return npc;
    }

    /** 环形范围内的随机点(面积均匀) */
    private Geometry.Vec2 randomPointInRing(Geometry.Vec2 center, double minRadius, double maxRadius) {
        double angle = Math.random() * Math.PI * 2;
        double minSquare = minRadius * minRadius;
        double maxSquare = maxRadius * maxRadius;
        double radius = Math.sqrt(minSquare + Math.random() * (maxSquare - minSquare));
        return new Geometry.Vec2(
                center.x + Math.cos(angle) * radius,
                center.y + Math.sin(angle) * radius);
    }

    /** 生成点是否可用:避开世界边界、静态实体与其他动态实体 */
    private boolean canSpawnAt(Geometry.Vec2 position, boolean spawnItem, boolean spawnNpc) {
        if (!spawnItem && !spawnNpc) {
            return false;
        }
        if (position.x <= config.worldMinX || position.x >= config.worldMaxX
                || position.y <= config.worldMinY || position.y >= config.worldMaxY) {
            return false;
        }
        double halfW = NpcEntity.WIDTH / 2;
        double halfH = NpcEntity.HEIGHT / 2;
        // 保守检测:包围盒四角与中心点都不能落在静态实体内
        double[][] probePoints = {
                {position.x - halfW, position.y - halfH},
                {position.x + halfW, position.y - halfH},
                {position.x - halfW, position.y + halfH},
                {position.x + halfW, position.y + halfH},
                {position.x, position.y}};
        for (double[] p : probePoints) {
            if (staticGrid.isPointColliding(p[0], p[1])) {
                return false;
            }
        }

        double padding = (spawnItem && spawnNpc)
                ? Math.max(config.npcSpawnPadding, config.itemSpawnPadding)
                : (spawnItem ? config.itemSpawnPadding : config.npcSpawnPadding);
        for (PlayerEntity player : players) {
            if (player.isDead) {
                continue;
            }
            double minDistance = Math.max(NpcEntity.WIDTH, NpcEntity.HEIGHT) / 2
                    + Math.max(player.width, player.height) / 2 + padding;
            if (Geometry.distance(position.x, position.y, player.position.x, player.position.y) < minDistance) {
                return false;
            }
        }
        for (NpcEntity npc : npcs) {
            if (npc.isDead) {
                continue;
            }
            double minDistance = Math.max(NpcEntity.WIDTH, NpcEntity.HEIGHT) / 2
                    + Math.max(npc.width, npc.height) / 2 + padding;
            if (Geometry.distance(position.x, position.y, npc.position.x, npc.position.y) < minDistance) {
                return false;
            }
        }
        return true;
    }

    // ==================================================================
    // 动态实体碰撞(玩家吸附 NPC 为从者 + NPC 相互分离)
    // ==================================================================

    private void resolveDynamicEntityCollisions() {
        List<DynamicEntity> alive = new ArrayList<>();
        for (PlayerEntity player : players) {
            if (!player.isDead) {
                alive.add(player);
            }
        }
        for (NpcEntity npc : npcs) {
            if (!npc.isDead) {
                alive.add(npc);
            }
        }
        if (alive.size() < 2) {
            return;
        }

        final double cellSize = 64;
        Map<Long, List<DynamicEntity>> spatial = new HashMap<>();
        for (DynamicEntity entity : alive) {
            long key = cellKey((int) Math.floor(entity.position.x / cellSize), (int) Math.floor(entity.position.y / cellSize));
            spatial.computeIfAbsent(key, k -> new ArrayList<>()).add(entity);
        }

        Set<String> processed = new HashSet<>();
        for (DynamicEntity entityA : alive) {
            int ax = (int) Math.floor(entityA.position.x / cellSize);
            int ay = (int) Math.floor(entityA.position.y / cellSize);
            List<DynamicEntity> candidates = new ArrayList<>();
            for (int dx = -1; dx <= 1; dx++) {
                for (int dy = -1; dy <= 1; dy++) {
                    List<DynamicEntity> list = spatial.get(cellKey(ax + dx, ay + dy));
                    if (list != null) {
                        candidates.addAll(list);
                    }
                }
            }
            for (DynamicEntity entityB : candidates) {
                if (entityB.id <= entityA.id) {
                    continue;
                }
                String pairKey = entityA.id + ":" + entityB.id;
                if (!processed.add(pairKey)) {
                    continue;
                }

                // player <-> player:两个玩家互相挤压分离(多人模式下才会出现)
                if (entityA instanceof PlayerEntity && entityB instanceof PlayerEntity) {
                    separatePair(entityA, entityB, false, false);
                    continue;
                }

                // player <-> npc:无主 NPC 优先吸附为从者;吸附失败或已是从者时做碰撞分离
                if ((entityA instanceof PlayerEntity || entityB instanceof PlayerEntity)
                        && (entityA instanceof NpcEntity || entityB instanceof NpcEntity)) {
                    PlayerEntity player = entityA instanceof PlayerEntity ? (PlayerEntity) entityA : (PlayerEntity) entityB;
                    NpcEntity npc = entityA instanceof NpcEntity ? (NpcEntity) entityA : (NpcEntity) entityB;
                    if (npc.ownerId == null) {
                        tryAbsorbServant(player, npc);
                        if (npc.ownerId != null) {
                            continue;// 吸附成功:该 NPC 已进入从者网格
                        }
                        // 吸附未成功(格子被占/超出网格)时仍要分离,避免穿插
                        separatePair(player, npc, false, false);
                        continue;
                    }
                    if (npc.ownerId == player.id) {
                        continue;// 主人与自己从者重叠属于正常(从者位于网格格内)
                    }
                    // 他人的从者:位置由主人网格锁定,自身推不动,把推挤传递给主人
                    separatePlayerFromForeignServant(player, npc);
                    continue;
                }

                // npc <-> npc:若某方是从者,先由它的主人尝试收纳另一方;否则做碰撞分离
                if (entityA instanceof NpcEntity && entityB instanceof NpcEntity) {
                    NpcEntity npcA = (NpcEntity) entityA;
                    NpcEntity npcB = (NpcEntity) entityB;
                    if (absorbByServant(npcA, npcB) || absorbByServant(npcB, npcA)) {
                        continue;
                    }
                    // 从者位置被主人网格锁定,分离时视为不可推动
                    separatePair(npcA, npcB, npcA.ownerId != null, npcB.ownerId != null);
                }
            }
        }
    }

    /** 尝试把重叠的无主 NPC 吸附为玩家的从者 */
    private void tryAbsorbServant(PlayerEntity player, NpcEntity npc) {
        if (player.isDead || npc.isDead || npc.ownerId != null) {
            return;
        }
        if (player.selectServantByID(npc.id) != null) {
            return;
        }
        if (separationOffset(player, npc) == null) {
            return;
        }
        // 从者网格是 15×15,内圈占满后向外扩展,而不是只能占玩家周围八格
        int[] rc = player.findServantSlot(npc.position);
        if (rc == null) {
            return;
        }
        if (!player.setServant(rc[0], rc[1], npc.id)) {
            return;
        }
        npc.ownerId = player.id;
        npc.teamId = player.teamId;
        pushEvent("servant_absorbed", Map.of("playerId", player.id, "npcId", npc.id));
    }

    /**
     * 从者触碰到无主 NPC 时,由它的主人把对方也收纳为从者。
     *
     * <p>对应 TS 版 Service.ts 中「已归属 NPC 收纳另一 NPC」的分支:Java 版此前只做了
     * 碰撞分离,导致从者无法“越级”收纳,玩家只能靠自己撞 NPC,可用的吸附范围因此被
     * 卡死在紧贴玩家的 8 个格子内。</p>
     *
     * @param servant 已归属的 NPC
     * @param target  候选的被收纳 NPC
     * @return 是否收纳成功
     */
    private boolean absorbByServant(NpcEntity servant, NpcEntity target) {
        if (servant.ownerId == null || target.ownerId != null || servant.isDead || target.isDead) {
            return false;
        }
        PlayerEntity owner = getPlayerById(servant.ownerId);
        if (owner == null || owner.isDead) {
            return false;
        }
        if (owner.selectServantByID(target.id) != null) {
            return false;
        }
        if (separationOffset(servant, target) == null) {
            return false;
        }
        int[] rc = owner.findServantSlot(target.position);
        if (rc == null || !owner.setServant(rc[0], rc[1], target.id)) {
            return false;
        }
        target.ownerId = owner.id;
        target.teamId = owner.teamId;
        pushEvent("servant_absorbed", Map.of("playerId", owner.id, "npcId", target.id));
        return true;
    }

    /**
     * 计算「把 b 推离 a」的位移矢量(沿重叠较小的轴,带 0.1 余量);无重叠时返回 null。
     *
     * <p>返回值的含义是 b 应该移动的位移,a 沿相反方向移动。</p>
     */
    private static double[] separationOffset(DynamicEntity a, DynamicEntity b) {
        Geometry.Box boxA = a.collisionBox;
        Geometry.Box boxB = b.collisionBox;
        double overlapX = Math.min(boxA.maxX(), boxB.maxX()) - Math.max(boxA.x, boxB.x);
        double overlapY = Math.min(boxA.maxY(), boxB.maxY()) - Math.max(boxA.y, boxB.y);
        if (overlapX <= 0 || overlapY <= 0) {
            return null;
        }
        if (overlapX < overlapY) {
            double push = overlapX + 0.1;
            return new double[]{a.position.x <= b.position.x ? push : -push, 0};
        }
        double push = overlapY + 0.1;
        return new double[]{0, a.position.y <= b.position.y ? push : -push};
    }

    /**
     * 两个动态实体的碰撞分离(沿重叠较小的轴推开)。
     *
     * @param aImmovable a 是否不可推动(例如位置被主人网格锁定的从者)
     * @param bImmovable b 是否不可推动
     */
    private void separatePair(DynamicEntity a, DynamicEntity b, boolean aImmovable, boolean bImmovable) {
        if (aImmovable && bImmovable) {
            return;
        }
        double[] offset = separationOffset(a, b);
        if (offset == null) {
            return;
        }

        // 可推动的一方承担全部位移;双方都可推动时各担一半
        double shareA = aImmovable ? 0 : (bImmovable ? 1 : 0.5);
        double shareB = bImmovable ? 0 : (aImmovable ? 1 : 0.5);

        // offset 是「把 b 推离 a」的位移,a 沿反方向移动
        if (shareA > 0) {
            moveIfFreeOfStatic(a, -offset[0] * shareA, -offset[1] * shareA);
        }
        if (shareB > 0) {
            moveIfFreeOfStatic(b, offset[0] * shareB, offset[1] * shareB);
        }
    }

    /**
     * 玩家与「他人的从者」的碰撞分离。
     *
     * <p>从者的位置每帧由主人的从者网格决定,不能独立位移,因此应把它看作
     * <b>主人身体的延伸</b>:本方法把「玩家 ↔ 从者」的重叠按「玩家 ↔ 主人」的
     * 普通碰撞结算——双方各担一半,主人位移后其从者随网格一起移动。</p>
     *
     * <p>两种偏颇的做法都会造成可复现的卡死:</p>
     * <ul>
     *   <li>只把玩家推开(把从者当不可推动的死墙):主人不动时,别人永远推不到主人;</li>
     *   <li>只把主人推开:主人也无法用自己的从者去推别人,从者反而像弹簧一样把主人弹回去。</li>
     * </ul>
     *
     * <p>若主人不存在(已离线),或其中一方被围墙挡住无法位移,则由可移动的一方
     * 承担剩余位移,避免两者互相穿插。</p>
     */
    private void separatePlayerFromForeignServant(PlayerEntity player, NpcEntity servant) {
        double[] offset = separationOffset(player, servant);
        if (offset == null) {
            return;
        }
        double dx = offset[0];
        double dy = offset[1];

        PlayerEntity owner = servant.ownerId == null ? null : getPlayerById(servant.ownerId);
        if (owner == null || owner.isDead) {
            // 主人不在:只能把玩家推开
            moveIfFreeOfStatic(player, -dx, -dy);
            return;
        }

        // 主人承担一半位移(从者随后随网格一起移动)
        if (!moveIfFreeOfStatic(owner, dx * 0.5, dy * 0.5)) {
            // 主人被围墙挡住:玩家承担全部位移
            moveIfFreeOfStatic(player, -dx, -dy);
            return;
        }
        resyncServantsOf(owner);

        // 玩家承担另一半;若玩家也被挡住,剩余位移再交还给主人
        if (!moveIfFreeOfStatic(player, -dx * 0.5, -dy * 0.5)
                && moveIfFreeOfStatic(owner, dx * 0.5, dy * 0.5)) {
            resyncServantsOf(owner);
        }
    }

    /** 把某个玩家的全部从者立即重新锁回它的从者网格(主人位置发生变化后调用) */
    private void resyncServantsOf(PlayerEntity owner) {
        for (NpcEntity npc : npcs) {
            if (npc.ownerId != null && npc.ownerId == owner.id) {
                npc.followOwner(this);
            }
        }
    }

    /**
     * 按位移移动实体;若移动后会压入静态实体则回滚。
     * 避免碰撞分离把实体挤进围墙里导致持续受到挤压伤害。
     *
     * @return 是否真正完成了位移(false 表示因压入静态实体而回滚)
     */
    private boolean moveIfFreeOfStatic(DynamicEntity entity, double dx, double dy) {
        double oldX = entity.position.x;
        double oldY = entity.position.y;
        entity.position.x += dx;
        entity.position.y += dy;
        entity.updateCollisionBox();

        double halfW = entity.width / 2;
        double halfH = entity.height / 2;
        double minX = entity.position.x - halfW;
        double maxX = entity.position.x + halfW;
        double minY = entity.position.y - halfH;
        double maxY = entity.position.y + halfH;
        for (StaticEntity staticEntity : staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            Geometry.Box box = staticEntity.collisionBox;
            boolean separated = maxX <= box.x || minX >= box.maxX() || maxY <= box.y || minY >= box.maxY();
            if (!separated) {
                entity.position.x = oldX;
                entity.position.y = oldY;
                entity.updateCollisionBox();
                return false;
            }
        }
        return true;
    }

    private static long cellKey(int cx, int cy) {
        return ((long) cx << 32) ^ (cy & 0xffffffffL);
    }

    // ==================================================================
    // 玩家指令:开火 / 闪避 / 从者编辑器
    // ==================================================================

    /** 玩家开火(装配了技能时按技能方式开火,否则默认单发) */
    public void playerFire(long playerId, Geometry.Vec2 target) {
        if (paused) {
            return;
        }
        PlayerEntity player = getPlayerById(playerId);
        if (player == null || player.isDead || player.playerRule.fireCooldownNow > 0) {
            return;
        }
        double dx = target.x - player.position.x;
        double dy = target.y - player.position.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            return;
        }
        Geometry.Vec2 direction = new Geometry.Vec2(dx / len, dy / len);
        double spawnDistance = player.width * 0.6;
        String bulletColor = player.playerRule.bulletColor;

        Skill activeSkill = player.getActiveFireSkill(skills);
        if (activeSkill != null) {
            Skill.CastContext context = new Skill.CastContext();
            context.position = player.position.copy();
            context.direction = direction;
            context.ownerId = player.id;
            context.teamId = player.teamId;
            context.bulletColor = bulletColor;
            context.spawnDistance = spawnDistance;
            context.bulletSpawner = (position, dir, color) -> bullets.add(new BulletEntity(
                    position, dir, player.id, player.teamId, "", color));
            // 激光生成回调:供「激光束」等线段型技能使用
            context.laserSpawner = (position, dir, color, length, expandSpeed, durationTicks, damage, glowColor) -> {
                LaserBulletEntity laser = new LaserBulletEntity(
                        position, dir, player.id, player.teamId, "", color,
                        length, expandSpeed, durationTicks, damage, glowColor);
                // 记录发射位置:与 NPC 激光同规则——玩家一旦移动,该光束立刻失去源头并被移除
                laser.laserAnchor = new Geometry.Vec2(player.position.x, player.position.y);
                bullets.add(laser);
            };
            activeSkill.cast(context);
            // 开火冷却取「基础开火冷却 / 技能冷却(受专研降低) / 技能持续施法时长」的最大值,
            // 保证持续型技能(如环射烟花的逐发扫射)在扫射结束前不会被下一次开火打断
            player.playerRule.fireCooldownNow = Math.max(
                    Math.max(player.playerRule.fireCooldownMax,
                            activeSkill.cooldown() * player.getCooldownMultiplier()),
                    activeSkill.getCastDuration());
            return;
        }

        bullets.add(new BulletEntity(
                new Geometry.Vec2(
                        player.position.x + direction.x * spawnDistance,
                        player.position.y + direction.y * spawnDistance),
                direction,
                player.id,
                player.teamId,
                "",
                bulletColor));
        player.playerRule.fireCooldownNow = player.playerRule.fireCooldownMax;
    }

    /** 玩家闪现:必须装备闪现技能后才能使用 */
    public void playerDodge(long playerId, Geometry.Vec2 direction) {
        if (paused) {
            return;
        }
        PlayerEntity player = getPlayerById(playerId);
        if (player == null || player.isDead || !player.hasEquippedSkill(DodgeSkill.TAG)) {
            return;
        }
        player.dodge(direction, this);
    }

    /** 构建 NPC 行动上下文 */
    public NpcEntity.ActionContext buildActionContext() {
        NpcEntity.ActionContext context = new NpcEntity.ActionContext();
        context.world = this;
        context.skills = skills;
        context.players = players;
        context.spawnBullet = bullets::add;
        context.spawnBomb = bombs::add;
        return context;
    }

    /** 背包使用物品(带玩家死亡保护) */
    public void playerUseItem(long playerId, String uid) {
        if (paused) {
            return;
        }
        PlayerEntity player = getPlayerById(playerId);
        if (player != null && !player.isDead) {
            player.useInventoryItem(uid);
        }
    }

    /** 应用客户端提交的背包状态(玩家死亡时忽略滞后提交) */
    public void applyInventoryState(long playerId, List<Inventory.Entry> entries, List<String> equippedSkills) {
        PlayerEntity player = getPlayerById(playerId);
        if (player != null && !player.isDead) {
            player.applyInventoryState(entries, equippedSkills);
        }
    }

    /** 玩家选择一项专研(由客户端 research_choose 指令触发) */
    public void chooseResearch(long playerId, String tag) {
        PlayerEntity player = getPlayerById(playerId);
        if (player != null && !player.isDead) {
            player.chooseResearch(tag);
        }
    }

    /** 房间标识(用于日志与调试) */
    public long roomSeed() {
        return roomSeed;
    }

    /** 供调试:当前实体总数 */
    public int entityCount() {
        return players.size() + npcs.size() + bullets.size() + bombs.size()
                + expOrbs.size() + skillOrbs.size() + items.size();
    }

    /** 对每个 NPC 执行行为循环(在世界 tick 中调用,便于统一注入上下文) */
    public void runNpcActionLoops() {
        if (paused) {
            return;
        }
        double dt = this.lastDeltaTime;
        if (dt <= 0) {
            return;
        }
        List<NpcEntity> snapshot = new ArrayList<>(npcs);
        NpcEntity.ActionContext context = buildActionContext();

        // 同步从者射速倍率(主人的专研"射速"):从者开火节奏随之加快
        for (NpcEntity npc : npcs) {
            if (npc.ownerId == null) {
                npc.ownerFireRateMultiplier = 1;
                continue;
            }
            PlayerEntity owner = getPlayerById(npc.ownerId);
            npc.ownerFireRateMultiplier = owner != null ? owner.getFireRateMultiplier() : 1;
        }
        context.deltaTime = dt;
        for (NpcEntity npc : snapshot) {
            if (npc.isDead) {
                continue;
            }
            if (npc.isServant()) {
                npc.actionLoop(context);
                continue;
            }
            npc.updateCrowdStuckState(dt);
            npc.updateStayDuration(dt);
            npc.updateStaticCompressionEffects(dt, this);
            if (npc.updateNoMovementWatchdog(dt)) {
                wildTarget(npc);
                continue;
            }
            if (npc.canGetNewWanderTarget(dt, this)) {
                wildTarget(npc);
            }
            npc.actionLoop(context);
        }
    }

    private double lastDeltaTime;

    /** 在 tick 开始时记录本帧时长,供行为循环使用 */
    public void beginTick(double dt) {
        this.lastDeltaTime = dt;
    }

    /** 为无主 NPC 分配随机游走目标(权重游走,失败则退化到近邻点) */
    private void wildTarget(NpcEntity npc) {
        double radius = Math.max(1, npc.wanderRange);
        Geometry.Vec2 center = npc.position.copy();
        for (int attempt = 0; attempt < Math.max(1, config.setRandomTargetMaxAttempts); attempt++) {
            double angle = Math.random() * Math.PI * 2;
            double dist = radius * Math.sqrt(Math.random());
            Geometry.Vec2 target = new Geometry.Vec2(
                    center.x + Math.cos(angle) * dist,
                    center.y + Math.sin(angle) * dist);
            if (!staticGrid.isPointColliding(target.x, target.y) && npc.setTarget(target, this, false)) {
                return;
            }
        }
        npc.tryFallbackTarget(this);
    }

    /** 预留:批量遍历 NPC 的回调接口(供未来扩展系统使用) */
    public void forEachNpc(Consumer<NpcEntity> consumer) {
        for (NpcEntity npc : new ArrayList<>(npcs)) {
            consumer.accept(npc);
        }
    }
}
