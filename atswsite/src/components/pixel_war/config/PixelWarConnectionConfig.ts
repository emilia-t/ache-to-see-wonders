/**
 * pixel_war 服务端连接配置。
 *
 * 服务端有两种实现:
 * - `worker`:浏览器内的 Web Worker 单人权威模拟(默认,行为与历史版本一致);
 * - `websocket`:连接到 Java 多人服务端(java/ 目录,Spring Boot + WebSocket)。
 *
 * 配置优先级(从高到低):
 * 1. URL 查询参数:?pixelWarPipeline=websocket&pixelWarServer=ws://127.0.0.1:8080/ws/pixel-war&pixelWarRoom=default&pixelWarName=Player
 * 2. 宿主页面注入的全局变量:window.__PIXEL_WAR_CONNECTION__ = { pipeline, serverUrl, roomId, playerName }
 * 3. localStorage 键 `pixelWarPipeline` / `pixelWarServerUrl` / `pixelWarRoomId` / `pixelWarPlayerName`
 * 4. 默认值:worker(单人模式)
 */

/** 服务端通道类型 */
export type PixelWarPipeline = 'worker' | 'websocket';

export interface PixelWarConnectionConfig {
  /** 使用哪种服务端通道 */
  pipeline: PixelWarPipeline;
  /** Java 服务端 WebSocket 地址(仅 websocket 通道使用) */
  serverUrl: string;
  /** 房间号(仅 websocket 通道使用) */
  roomId: string;
  /** 玩家名称(仅 websocket 通道使用) */
  playerName: string;
  /** 是否在连接断开后自动重连 */
  autoReconnect: boolean;
}

/** 默认配置:保持单人模式(浏览器内 Worker) */
export const PIXEL_WAR_DEFAULT_CONFIG: PixelWarConnectionConfig = {
  pipeline: 'worker',
  serverUrl: 'ws://127.0.0.1:8080/ws/pixel-war',
  roomId: 'default',
  playerName: 'Player',
  autoReconnect: true
};

type RawConfig = Partial<{
  pipeline: string;
  serverUrl: string;
  roomId: string;
  playerName: string;
  autoReconnect: boolean;
}>;

const H_readLocalStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const H_readInjectedConfig = (): RawConfig => {
  const injected = (window as unknown as { __PIXEL_WAR_CONNECTION__?: RawConfig }).__PIXEL_WAR_CONNECTION__;
  return injected ?? {};
};

const H_readQueryConfig = (): RawConfig => {
  try {
    const params = new URLSearchParams(window.location.search);
    const config: RawConfig = {};
    const pipeline = params.get('pixelWarPipeline');
    const serverUrl = params.get('pixelWarServer');
    const roomId = params.get('pixelWarRoom');
    const playerName = params.get('pixelWarName');
    if (pipeline) config.pipeline = pipeline;
    if (serverUrl) config.serverUrl = serverUrl;
    if (roomId) config.roomId = roomId;
    if (playerName) config.playerName = playerName;
    return config;
  } catch {
    return {};
  }
};

const H_normalizePipeline = (value: unknown): PixelWarPipeline | null => {
  if (value === 'websocket' || value === 'ws' || value === 'java') return 'websocket';
  if (value === 'worker' || value === 'local') return 'worker';
  return null;
};

/**
 * 读取当前生效的连接配置。
 */
export const loadPixelWarConnectionConfig = (): PixelWarConnectionConfig => {
  const query = H_readQueryConfig();
  const injected = H_readInjectedConfig();

  const pipeline =
    H_normalizePipeline(query.pipeline) ??
    H_normalizePipeline(injected.pipeline) ??
    H_normalizePipeline(H_readLocalStorage('pixelWarPipeline')) ??
    PIXEL_WAR_DEFAULT_CONFIG.pipeline;

  const serverUrl =
    query.serverUrl ??
    injected.serverUrl ??
    H_readLocalStorage('pixelWarServerUrl') ??
    PIXEL_WAR_DEFAULT_CONFIG.serverUrl;

  const roomId =
    query.roomId ??
    injected.roomId ??
    H_readLocalStorage('pixelWarRoomId') ??
    PIXEL_WAR_DEFAULT_CONFIG.roomId;

  const playerName =
    query.playerName ??
    injected.playerName ??
    H_readLocalStorage('pixelWarPlayerName') ??
    PIXEL_WAR_DEFAULT_CONFIG.playerName;

  const autoReconnect =
    injected.autoReconnect ??
    PIXEL_WAR_DEFAULT_CONFIG.autoReconnect;

  return { pipeline, serverUrl, roomId, playerName, autoReconnect };
};
