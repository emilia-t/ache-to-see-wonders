package top.atsw.pixelwar.net;

import top.atsw.pixelwar.protocol.Protocol;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * pixel_war 多人对局 WebSocket 入口。
 *
 * <p>连接建立后客户端需要先发送 {@code join} 指令加入房间,服务端才会分配玩家实体;
 * 之后的输入指令都由服务端按会话绑定玩家 id 处理(不再信任客户端传入的 playerId)。</p>
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final RoomManager rooms;
    private final ObjectMapper mapper;
    /** sessionId -> 房间 */
    private final Map<String, GameRoom> sessionRooms = new ConcurrentHashMap<>();
    /** sessionId -> 会话状态 */
    private final Map<String, GameRoom.SessionState> sessionStates = new ConcurrentHashMap<>();

    public GameWebSocketHandler(RoomManager rooms, ObjectMapper mapper) {
        this.rooms = rooms;
        this.mapper = mapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // 连接建立后不主动发送任何消息(避免占用错误通道),等待客户端发送 join 指令
        log.info("[ws] 新连接 {} (远端 {})", session.getId(), session.getRemoteAddress());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Protocol.ClientEnvelope envelope;
        try {
            envelope = mapper.readValue(message.getPayload(), Protocol.ClientEnvelope.class);
        } catch (Exception e) {
            log.warn("[ws] 消息解析失败 session={} err={}", session.getId(), e.toString());
            sendError(session, "消息格式错误(需为 JSON)");
            return;
        }
        if (envelope == null || envelope.type() == null) {
            sendError(session, "缺少 type 字段");
            return;
        }

        if (Protocol.ClientType.JOIN.equals(envelope.type())) {
            handleJoin(session, envelope);
            return;
        }

        GameRoom room = sessionRooms.get(session.getId());
        GameRoom.SessionState state = sessionStates.get(session.getId());
        if (room == null || state == null) {
            sendError(session, "尚未加入房间,请先发送 join 指令");
            return;
        }
        room.handleInstruct(state, envelope);
    }

    /** 处理加入房间 */
    private void handleJoin(WebSocketSession session, Protocol.ClientEnvelope envelope) {
        if (sessionRooms.containsKey(session.getId())) {
            sendError(session, "已经在房间中");
            return;
        }
        Protocol.JoinRequest request;
        try {
            request = envelope.data() == null
                    ? new Protocol.JoinRequest(RoomManager.DEFAULT_ROOM, "Player", null)
                    : mapper.treeToValue(envelope.data(), Protocol.JoinRequest.class);
        } catch (Exception e) {
            sendError(session, "join 参数错误");
            return;
        }

        String roomId = request == null ? RoomManager.DEFAULT_ROOM : request.roomId();
        String playerName = (request == null || request.playerName() == null || request.playerName().isBlank())
                ? "Player" : request.playerName().trim();

        GameRoom room = rooms.getOrCreate(roomId);
        GameRoom.SessionState state = room.join(session, playerName);
        if (state == null) {
            return;// 房间已满,join 内部已回错误
        }
        sessionRooms.put(session.getId(), room);
        sessionStates.put(session.getId(), state);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        GameRoom room = sessionRooms.remove(session.getId());
        sessionStates.remove(session.getId());
        if (room != null) {
            room.leave(session.getId());
        }
        log.info("[ws] 连接关闭 {} status={}", session.getId(), status);
    }

    /** 当前在线连接数(健康检查用) */
    public int onlineConnections() {
        return sessionStates.size();
    }

    private void sendError(WebSocketSession session, String message) {
        try {
            session.sendMessage(new TextMessage(mapper.writeValueAsString(
                    new Protocol.ServerEnvelope(Protocol.ServerType.ERROR, new Protocol.ErrorMessage(message)))));
        } catch (Exception e) {
            log.debug("[ws] 错误消息发送失败: {}", e.toString());
        }
    }
}
