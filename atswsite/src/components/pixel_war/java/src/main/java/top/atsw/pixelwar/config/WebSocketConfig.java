package top.atsw.pixelwar.config;

import top.atsw.pixelwar.net.GameWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket 端点注册。
 *
 * <p>前端通过 {@code ws://<host>:8080/ws/pixel-war} 建立连接,使用 JSON 文本消息通信
 * (协议见 java/PROTOCOL.md)。</p>
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    /** WebSocket 端点路径 */
    public static final String ENDPOINT = "/ws/pixel-war";

    private final GameWebSocketHandler handler;

    public WebSocketConfig(GameWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, ENDPOINT).setAllowedOriginPatterns("*");
    }
}
