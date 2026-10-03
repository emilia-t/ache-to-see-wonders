package top.atsw.pixelwar.net;

import top.atsw.pixelwar.config.PixelWarProperties;
import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.game.Skill;
import top.atsw.pixelwar.registry.SkillRegistry;
import top.atsw.pixelwar.world.World;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 房间管理器:按 roomId 维护对局房间的生命周期。
 *
 * <p>房间在第一名玩家加入时创建并启动主循环;当房间内没有任何玩家且空闲超过
 * {@code pixel-war.room-idle-timeout-ms} 时被自动回收,避免线程与内存泄漏。</p>
 */
@Component
public class RoomManager {

    private static final Logger log = LoggerFactory.getLogger(RoomManager.class);

    /** 默认房间号 */
    public static final String DEFAULT_ROOM = "default";

    private final Map<String, GameRoom> rooms = new ConcurrentHashMap<>();
    private final ObjectMapper mapper;
    private final PixelWarProperties properties;
    private final GameConfig gameConfig;
    private final Skill.Provider skills = new SkillRegistry();

    public RoomManager(ObjectMapper mapper, PixelWarProperties properties) {
        this.mapper = mapper;
        this.properties = properties;
        this.gameConfig = new GameConfig(properties);
    }

    /** 取得房间,不存在则创建并启动 */
    public GameRoom getOrCreate(String roomId) {
        String id = normalize(roomId);
        return rooms.computeIfAbsent(id, key -> {
            GameRoom room = new GameRoom(key, new World(gameConfig, skills, System.nanoTime()), mapper, properties);
            room.start();
            return room;
        });
    }

    /** 查找房间(不存在返回 null) */
    public GameRoom find(String roomId) {
        return rooms.get(normalize(roomId));
    }

    public int roomCount() {
        return rooms.size();
    }

    /** 当前所有房间(只读用途:健康检查遍历等) */
    public Collection<GameRoom> rooms() {
        return rooms.values();
    }

    private String normalize(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return DEFAULT_ROOM;
        }
        return roomId.trim();
    }

    /** 定期回收空闲房间 */
    @Scheduled(fixedDelay = 15000)
    public void cleanupIdleRooms() {
        long now = System.currentTimeMillis();
        rooms.entrySet().removeIf(entry -> {
            GameRoom room = entry.getValue();
            boolean idle = room.isEmpty() && (now - room.lastActiveAt()) > properties.roomIdleTimeoutMs();
            if (idle) {
                room.shutdown();
                log.info("[rooms] 已回收空闲房间 {}", entry.getKey());
            }
            return idle;
        });
    }
}
