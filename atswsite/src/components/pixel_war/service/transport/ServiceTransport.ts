import type { DataPackage } from '@/components/pixel_war/interface/Interface';
import type { PixelWarConnectionConfig, PixelWarPipeline } from '@/components/pixel_war/config/PixelWarConnectionConfig';
import { loadPixelWarConnectionConfig } from '@/components/pixel_war/config/PixelWarConnectionConfig';
import { WorkerTransport } from '@/components/pixel_war/service/transport/WorkerTransport';
import { WebSocketTransport } from '@/components/pixel_war/service/transport/WebSocketTransport';

/**
 * 服务端通道抽象。
 *
 * 前端只依赖该接口收发数据包,因此"浏览器内 Worker 单人模拟"与"Java 多人在线服务端"
 * 可以互换;两种实现的对外行为都是:
 * - `postMessage(dpkg)`:发送一个客户端数据包(指令);
 * - `addEventListener('message', cb)`:接收服务端数据包(快照)。
 */
export interface ServiceTransport {
  /** 当前通道类型 */
  readonly kind: PixelWarPipeline;
  /** 发送客户端数据包(内部会按通道做协议转换) */
  postMessage(dataPackage: DataPackage): void;
  /** 监听服务端数据包 */
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  /** 释放连接资源 */
  dispose(): void;
}

/**
 * 创建服务端通道。
 *
 * 默认返回本地 Worker 通道(单人模式),当配置指向 websocket 时返回 Java 服务端通道。
 */
export const createServiceTransport = (
  config: PixelWarConnectionConfig = loadPixelWarConnectionConfig()
): ServiceTransport => {
  if (config.pipeline === 'websocket') {
    console.info('[pixel_war] 使用 Java 服务端(WebSocket):', config.serverUrl, '房间:', config.roomId);
    return new WebSocketTransport(config);
  }
  console.info('[pixel_war] 使用本地 Worker 服务端(单人模式)');
  return new WorkerTransport();
};
