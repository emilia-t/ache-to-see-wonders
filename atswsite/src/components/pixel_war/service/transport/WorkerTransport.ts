import ServiceWorker from '@/components/pixel_war/service/Service?worker';
import type { DataPackage } from '@/components/pixel_war/interface/Interface';
import type { PixelWarPipeline } from '@/components/pixel_war/config/PixelWarConnectionConfig';
import type { ServiceTransport } from '@/components/pixel_war/service/transport/ServiceTransport';

/**
 * 本地 Worker 通道(单人模式)。
 *
 * 直接包装 Vite 的 Worker 构造器,保持与历史版本完全一致的行为:
 * 权威模拟运行在浏览器 Worker 内,消息格式为前端自有的 DataPackage。
 */
export class WorkerTransport implements ServiceTransport {
  public readonly kind: PixelWarPipeline = 'worker';
  private readonly worker: Worker;
  private readonly listeners: Array<(event: MessageEvent) => void> = [];

  constructor() {
    this.worker = new ServiceWorker();
    this.worker.addEventListener('message', (event: MessageEvent) => {
      for (const listener of this.listeners) {
        listener(event);
      }
    });
  }

  public postMessage(dataPackage: DataPackage): void {
    this.worker.postMessage(dataPackage);
  }

  public addEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    if (type !== 'message') return;
    this.listeners.push(listener);
  }

  public dispose(): void {
    this.listeners.length = 0;
    this.worker.terminate();
  }
}
