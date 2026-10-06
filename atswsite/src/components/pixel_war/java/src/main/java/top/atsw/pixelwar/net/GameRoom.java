package top.atsw.pixelwar.net;

import top.atsw.pixelwar.config.PixelWarProperties;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.game.Inventory;
import top.atsw.pixelwar.game.Skill;
import top.atsw.pixelwar.monitor.TickStats;
import top.atsw.pixelwar.protocol.Protocol;
import top.atsw.pixelwar.world.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 一个对局房间:持有独立的世界实例、玩家会话与固定步长主循环。
 *
 * <p>主循环以 {@code pixel-war.tick-interval-ms} 为周期推进世界(权威模拟),
 * 然后为每个在线会话裁剪并下发快照;所有客户端指令都在该房间的线程模型下处理。</p>
 */
public final class GameRoom {

    private static final Logger log = LoggerFactory.getLogger(GameRoom.class);

    /** 会话状态:WebSocket 连接 + 绑定的玩家实体 id */
    public record SessionState(String sessionId, WebSocketSession session, long playerId, String playerName) {
    }

    private final String roomId;
    private final World world;
    private final ObjectMapper mapper;
    private final PixelWarProperties properties;
    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();
    private final Map<Long, String> playerSessionIndex = new ConcurrentHashMap<>();
    private final ScheduledExecutorService ticker;
    private final long createdAt = System.currentTimeMillis();
    private volatile long lastActiveAt = System.currentTimeMillis();
    private volatile boolean closed;
    private double lastTickTime = System.currentTimeMillis();
    /** 主循环耗时统计(供 monitor 包的定时健康检查读取) */
    private final TickStats tickStats = new TickStats();
    /** 本帧尚未随快照下发的游戏事件(快照降频时先在本地积压,避免丢事件) */
    private final List<Protocol.GameEvent> pendingEvents = new ArrayList<>();

    public GameRoom(String roomId, World world, ObjectMapper mapper, PixelWarProperties properties) {
        this.roomId = roomId;
        this.world = world;
        this.mapper = mapper;
        this.properties = properties;
        this.ticker = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "pixel-war-room-" + roomId);
            thread.setDaemon(true);
            return thread;
        });
    }

    public String roomId() {
        return roomId;
    }

    public World world() {
        return world;
    }

    public int playerCount() {
        return sessions.size();
    }

    public boolean isEmpty() {
        return sessions.isEmpty();
    }

    public long lastActiveAt() {
        return lastActiveAt;
    }

    public long createdAt() {
        return createdAt;
    }

    /** 主循环耗时统计累加器 */
    public TickStats tickStats() {
        return tickStats;
    }

    /** 单帧预算(tick 间隔,毫秒) */
    public int tickIntervalMs() {
        return properties.tickIntervalMs();
    }

    /** 房间人数上限 */
    public int maxPlayersPerRoom() {
        return properties.maxPlayersPerRoom();
    }

    /** 启动房间主循环 */
    public void start() {
        int interval = properties.tickIntervalMs();
        ticker.scheduleAtFixedRate(this::tickSafely, interval, interval, TimeUnit.MILLISECONDS);
        log.info("[room:{}] 房间已启动,tick 间隔 {} ms,快照间隔 {} 帧(= {} Hz)",
                roomId, interval, Math.max(1, properties.snapshotIntervalTicks()),
                Math.max(1, 1000 / Math.max(1, interval * Math.max(1, properties.snapshotIntervalTicks()))));
    }

    /** 关闭房间并释放线程 */
    public void shutdown() {
        if (closed) {
            return;
        }
        closed = true;
        ticker.shutdownNow();
        log.info("[room:{}] 房间已关闭(存活 {} 秒)", roomId, (System.currentTimeMillis() - createdAt) / 1000);
    }

    // ==================================================================
    // 会话管理
    // ==================================================================

    /** 玩家加入房间 */
    public synchronized SessionState join(WebSocketSession session, String playerName) {
        lastActiveAt = System.currentTimeMillis();
        if (sessions.size() >= properties.maxPlayersPerRoom()) {
            sendDirect(session, new Protocol.ServerEnvelope(Protocol.ServerType.ERROR,
                    new Protocol.ErrorMessage("房间人数已满")));
            return null;
        }
        WebSocketSession decorated = new ConcurrentWebSocketSessionDecorator(session, 5000, 512 * 1024);
        long teamId = System.nanoTime();
        PlayerEntity player = world.addPlayer(teamId, playerName);
        SessionState state = new SessionState(session.getId(), decorated, player.id, playerName);
        sessions.put(session.getId(), state);
        playerSessionIndex.put(player.id, session.getId());

        send(state, new Protocol.ServerEnvelope(Protocol.ServerType.WELCOME,
                SnapshotBuilder.buildWelcome(world, player, roomId, properties.tickIntervalMs())));
        // 通知其他玩家有新玩家加入
        broadcastExcept(state, new Protocol.ServerEnvelope(Protocol.ServerType.PLAYER_JOINED,
                Map.of("playerId", player.id, "name", playerName)));
        log.info("[room:{}] 玩家 {} 已加入(id={}, 在线 {})", roomId, playerName, player.id, sessions.size());
        return state;
    }

    /** 玩家离开房间 */
    public synchronized void leave(String sessionId) {
        SessionState state = sessions.remove(sessionId);
        if (state == null) {
            return;
        }
        lastActiveAt = System.currentTimeMillis();
        world.removePlayer(state.playerId());
        playerSessionIndex.remove(state.playerId());
        broadcastExcept(null, new Protocol.ServerEnvelope(Protocol.ServerType.PLAYER_LEFT,
                Map.of("playerId", state.playerId(), "name", state.playerName())));
        log.info("[room:{}] 玩家 {} 已离开(在线 {})", roomId, state.playerName(), sessions.size());
    }

    public SessionState sessionOf(String sessionId) {
        return sessions.get(sessionId);
    }

    // ==================================================================
    // 指令处理
    // ==================================================================

    /** 处理一条客户端指令 */
    public void handleInstruct(SessionState state, Protocol.ClientEnvelope envelope) {
        lastActiveAt = System.currentTimeMillis();
        JsonNode data = envelope.data();
        long playerId = state.playerId();
        try {
            switch (envelope.type()) {
                case Protocol.ClientType.MOVE_INPUT -> {
                    Protocol.MoveInput input = mapper.treeToValue(data, Protocol.MoveInput.class);
                    PlayerEntity player = world.getPlayerById(playerId);
                    if (player != null && input != null && input.moveState() != null) {
                        Protocol.MoveState move = input.moveState();
                        player.moveState.set(move.w(), move.a(), move.s(), move.d(), move.shift());
                    }
                }
                case Protocol.ClientType.FIRE_INPUT -> {
                    Protocol.FireInput input = mapper.treeToValue(data, Protocol.FireInput.class);
                    if (input != null && input.target() != null) {
                        world.playerFire(playerId, new Geometry.Vec2(input.target().x(), input.target().y()));
                    }
                }
                case Protocol.ClientType.DODGE_INPUT -> {
                    Protocol.DodgeInput input = mapper.treeToValue(data, Protocol.DodgeInput.class);
                    if (input != null && input.direction() != null) {
                        world.playerDodge(playerId, new Geometry.Vec2(input.direction().x(), input.direction().y()));
                    }
                }
                case Protocol.ClientType.RESPAWN -> world.respawnPlayer(playerId);
                case Protocol.ClientType.INVENTORY_UPDATE -> {
                    Protocol.InventoryUpdate input = mapper.treeToValue(data, Protocol.InventoryUpdate.class);
                    if (input != null && input.inventory() != null) {
                        world.applyInventoryState(playerId,
                                toEntries(input.inventory().entries()),
                                input.inventory().equippedSkills());
                    }
                }
                case Protocol.ClientType.INVENTORY_USE_ITEM -> {
                    Protocol.InventoryUseItem input = mapper.treeToValue(data, Protocol.InventoryUseItem.class);
                    if (input != null) {
                        world.playerUseItem(playerId, input.uid());
                    }
                }
                case Protocol.ClientType.INVENTORY_DROP -> {
                    Protocol.InventoryDrop input = mapper.treeToValue(data, Protocol.InventoryDrop.class);
                    if (input != null) {
                        world.dropInventoryEntry(playerId, input);
                    }
                }
                case Protocol.ClientType.RESEARCH_CHOOSE -> {
                    Protocol.ResearchChoose input = mapper.treeToValue(data, Protocol.ResearchChoose.class);
                    if (input != null) {
                        world.chooseResearch(playerId, input.tag());
                    }
                }
                case Protocol.ClientType.TICK_PAUSE -> {
                    Protocol.TickPause input = data == null ? null : mapper.treeToValue(data, Protocol.TickPause.class);
                    if (input == null || input.paused() == null) {
                        world.togglePaused();
                    } else {
                        world.setPaused(input.paused());
                    }
                }
                case Protocol.ClientType.PING -> {
                    Protocol.Ping ping = mapper.treeToValue(data, Protocol.Ping.class);
                    send(state, new Protocol.ServerEnvelope(Protocol.ServerType.PONG,
                            new Protocol.Pong(ping == null ? 0 : ping.clientTime(),
                                    System.currentTimeMillis())));
                }
                default -> log.debug("[room:{}] 忽略未知指令 {}", roomId, envelope.type());
            }
        } catch (Exception e) {
            log.warn("[room:{}] 指令处理失败 type={} err={}", roomId, envelope.type(), e.toString());
            send(state, new Protocol.ServerEnvelope(Protocol.ServerType.ERROR,
                    new Protocol.ErrorMessage("指令处理失败: " + envelope.type())));
        }
    }

    /** 把协议条目转换为背包条目(规范化在 Inventory 层完成) */
    private List<Inventory.Entry> toEntries(List<Protocol.InventoryEntryDto> dtos) {
        List<Inventory.Entry> entries = new ArrayList<>();
        if (dtos == null) {
            return entries;
        }
        for (Protocol.InventoryEntryDto dto : dtos) {
            if (dto == null) {
                entries.add(null);
                continue;
            }
            Inventory.Entry entry = new Inventory.Entry();
            entry.uid = dto.uid();
            entry.kind = dto.kind();
            entry.tag = dto.tag();
            entry.name = dto.name();
            entry.count = dto.count();
            entry.maxStack = dto.maxStack();
            entry.color = dto.color();
            entries.add(entry);
        }
        return entries;
    }

    // ==================================================================
    // 主循环
    // ==================================================================

    private void tickSafely() {
        try {
            tick();
        } catch (Exception e) {
            log.error("[room:{}] tick 异常", roomId, e);
        }
    }

    private void tick() {
        if (closed || sessions.isEmpty()) {
            return;
        }
        long tickStartNs = System.nanoTime();
        long now = System.currentTimeMillis();
        double dt = Geometry.clamp((now - lastTickTime) / 1000.0, 0, 0.05);
        lastTickTime = now;

        world.tick(dt);
        long worldEndNs = System.nanoTime();

        // 事件每帧都收,但只在真正下发快照的那一帧一并发出,避免降频时丢事件
        pendingEvents.addAll(world.drainEvents());
        long tickCount = world.tickCount();
        boolean sendSnapshot = tickCount % Math.max(1, properties.snapshotIntervalTicks()) == 0;

        long downstreamBytes = 0;
        if (sendSnapshot) {
            List<Protocol.GameEvent> events = List.copyOf(pendingEvents);
            pendingEvents.clear();
            for (SessionState state : sessions.values()) {
                PlayerEntity player = world.getPlayerById(state.playerId());
                if (player == null) {
                    continue;
                }
                Protocol.Snapshot snapshot = SnapshotBuilder.build(
                        world, player, properties.snapshotViewRadius(), tickCount, now);
                downstreamBytes += send(state, new Protocol.ServerEnvelope(Protocol.ServerType.SNAPSHOT, snapshot));
                for (Protocol.GameEvent event : events) {
                    downstreamBytes += send(state, new Protocol.ServerEnvelope(Protocol.ServerType.EVENT, event));
                }
            }
        }
        long endNs = System.nanoTime();
        tickStats.record(endNs - tickStartNs, worldEndNs - tickStartNs, endNs - worldEndNs,
                downstreamBytes, properties.tickIntervalMs() * 1_000_000L, sendSnapshot);
    }

    // ==================================================================
    // 发送
    // ==================================================================

    /** 发送一条消息,返回实际下发的字节数(失败返回 0);字节数用于健康检查统计下行带宽 */
    private int send(SessionState state, Protocol.ServerEnvelope envelope) {
        try {
            TextMessage message = new TextMessage(mapper.writeValueAsString(envelope));
            state.session().sendMessage(message);
            return message.getPayloadLength();
        } catch (IOException e) {
            log.warn("[room:{}] 发送失败,关闭会话 {}: {}", roomId, state.sessionId(), e.toString());
            leave(state.sessionId());
            return 0;
        }
    }

    /** 直接向尚未加入房间的连接发送消息(如房间已满) */
    private void sendDirect(WebSocketSession session, Protocol.ServerEnvelope envelope) {
        try {
            session.sendMessage(new TextMessage(mapper.writeValueAsString(envelope)));
        } catch (IOException e) {
            log.warn("[room:{}] 直接发送失败: {}", roomId, e.toString());
        }
    }

    private void broadcastExcept(SessionState excluded, Protocol.ServerEnvelope envelope) {
        for (SessionState state : sessions.values()) {
            if (excluded != null && state.sessionId().equals(excluded.sessionId())) {
                continue;
            }
            send(state, envelope);
        }
    }
}
