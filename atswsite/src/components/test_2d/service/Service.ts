const service: Worker = self as any;

// 游戏刻配置：每 20 毫秒触发一次
const TICK_INTERVAL_MS = 20;
let tickTimer: number | null = null;

// 启动游戏刻循环
tickTimer = setInterval(() => {
  service.postMessage('hello');
}, TICK_INTERVAL_MS) as unknown as number;

// 保留原有的消息接收与回显功能
service.addEventListener('message', (e) => {
  const jsonString = e.data;
  
});

// 当 Worker 内部主动关闭时（self.close），清理定时器
self.addEventListener('close', () => {
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
});