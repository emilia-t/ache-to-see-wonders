import type { DataPackage, InstructObject } from '@/components/pixel_war/interface/Interface';
import type { PixelWarConnectionConfig, PixelWarPipeline } from '@/components/pixel_war/config/PixelWarConnectionConfig';
import type { ServiceTransport } from '@/components/pixel_war/service/transport/ServiceTransport';
import type {
  JavaClientEnvelope,
  JavaServerEnvelope,
  JavaSnapshot,
  JavaWelcome
} from '@/components/pixel_war/service/transport/JavaProtocol';
import {
  H_toJavaClientMessages,
  H_toMapDataInitialInstruct,
  H_toSnapshotInstruct
} from '@/components/pixel_war/service/transport/ProtocolMapper';

/**
 * Java 服务端通道(多人游戏)。
 *
 * <p>职责:</p>
 * <ul>
 *   <li>维护到 Java 服务端的 WebSocket 连接(含自动重连);</li>
 *   <li>连接建立后自动发送 {@code join} 指令加入房间;</li>
 *   <li>把前端指令转换成 Java 协议消息下发;</li>
 *   <li>把服务端 {@code welcome} / {@code snapshot} 转换成前端渲染管线使用的数据包并派发。</li>
 * </ul>
 */
export class WebSocketTransport implements ServiceTransport {
  public readonly kind: PixelWarPipeline = 'websocket';

  private readonly config: PixelWarConnectionConfig;
  private readonly listeners: Array<(event: MessageEvent) => void> = [];
  private socket: WebSocket | null = null;
  private welcome: JavaWelcome | null = null;
  private disposed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  constructor(config: PixelWarConnectionConfig) {
    this.config = config;
    this.H_connect();
  }

  /** 是否已连接(可用于界面提示) */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public postMessage(dataPackage: DataPackage): void {
    if (!this.isConnected()) {
      // 尚未连接时直接丢弃输入,避免离线输入在重连后集中补发造成角色乱跑
      return;
    }
    for (const message of H_toJavaClientMessages(dataPackage)) {
      this.H_send(message);
    }
  }

  public addEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    if (type !== 'message') {
      return;
    }
    this.listeners.push(listener);
  }

  public dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.listeners.length = 0;
    if (this.socket !== null) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
  }

  // ==================================================================
  // 连接管理
  // ==================================================================

  private H_connect(): void {
    if (this.disposed) {
      return;
    }
    const socket = new WebSocket(this.config.serverUrl);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      console.info('[pixel_war] 已连接 Java 服务端:', this.config.serverUrl);
      this.H_send({
        type: 'join',
        data: {
          roomId: this.config.roomId,
          playerName: this.config.playerName,
          clientId: `web_${Date.now().toString(36)}`
        }
      });
    };

    socket.onmessage = (event: MessageEvent) => {
      this.H_handleServerMessage(event.data);
    };

    socket.onerror = () => {
      console.warn('[pixel_war] WebSocket 连接出错:', this.config.serverUrl);
    };

    socket.onclose = (event: CloseEvent) => {
      this.welcome = null;
      this.socket = null;
      if (this.disposed) {
        return;
      }
      console.warn('[pixel_war] 与服务端连接断开:', event.code, event.reason);
      if (this.config.autoReconnect) {
        this.H_scheduleReconnect();
      }
    };
  }

  private H_scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(10000, 1000 * this.reconnectAttempts);
    console.info(`[pixel_war] ${delay} ms 后尝试第 ${this.reconnectAttempts} 次重连`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.H_connect();
    }, delay);
  }

  private H_send(message: JavaClientEnvelope): void {
    if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  // ==================================================================
  // 服务端消息处理
  // ==================================================================

  private H_handleServerMessage(raw: unknown): void {
    let envelope: JavaServerEnvelope<unknown>;
    try {
      envelope = JSON.parse(String(raw)) as JavaServerEnvelope<unknown>;
    } catch {
      console.warn('[pixel_war] 无法解析服务端消息:', raw);
      return;
    }

    switch (envelope.type) {
      case 'welcome': {
        this.welcome = envelope.data as JavaWelcome;
        console.info('[pixel_war] 已加入房间:', this.welcome.roomId, 'playerId =', this.welcome.playerId);
        // 静态地图只需下发一次
        this.H_dispatchPackage([H_toMapDataInitialInstruct(this.welcome)]);
        break;
      }
      case 'snapshot': {
        const snapshot = envelope.data as JavaSnapshot;
        this.H_dispatchPackage([H_toSnapshotInstruct(snapshot)], snapshot.tick);
        break;
      }
      case 'event':
      case 'player_joined':
      case 'player_left': {
        // 事件类消息暂时只做日志,后续可用于战绩/提示 UI
        console.debug('[pixel_war] 服务端事件:', envelope.type, envelope.data);
        break;
      }
      case 'pong': {
        console.debug('[pixel_war] pong:', envelope.data);
        break;
      }
      case 'error': {
        console.warn('[pixel_war] 服务端返回错误:', envelope.data);
        break;
      }
      default:
        break;
    }
  }

  /** 把前端指令包装成数据包并派发给渲染管线 */
  private H_dispatchPackage(instructs: InstructObject[], tick?: JavaSnapshot['tick']): void {
    const dataPackage: DataPackage = {
      tick: {
        tickCount: tick?.tickCount ?? 0,
        tickTime: tick?.tickTime ?? performance.now()
      },
      data: { instructs }
    };
    const event = new MessageEvent('message', { data: dataPackage });
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
