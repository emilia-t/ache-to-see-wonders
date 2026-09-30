# pixel_war Java 多人服务端

由前端 TypeScript（`src/components/pixel_war/service/Service.ts` 及其依赖的实体 / 背包 / 技能模块）
迁移而来的独立多人服务端，使用 **Spring Boot 3.3 + 原生 WebSocket + Jackson**。

- 前端单人模式仍使用浏览器内的 Web Worker（`service/Service.ts`），**本服务端只用于多人游戏**；
- 前端通过连接适配层在两种通道之间切换，默认仍是 Worker，见 `src/components/pixel_war/service/transport/`。

## 目录结构

```
java/
├── build.gradle / settings.gradle      Gradle + Spring Boot 构建脚本
├── PROTOCOL.md                         WebSocket 协议说明
└── src/main/
    ├── java/top/atsw/pixelwar/
    │   ├── PixelWarServerApplication   启动类
    │   ├── config/                     配置(WebSocket 端点、可调参数)
    │   ├── core/                       几何/空间索引、全局游戏配置(GCFG)
    │   ├── entity/                     实体体系(与 TS 版 class/Entity/ 分层一致)
    │   │   ├── Entity / WorldView      实体基类、实体层世界视图接口
    │   │   ├── dynamicEntity/          动态实体(对应 DynamicEntity/)
    │   │   │   └── npc/                NPC(对应 NpcDynamicEntity/)
    │   │   ├── itemEntity/             物品实体(对应 ItemEntity/)
    │   │   └── staticEntity/           静态实体(对应 StaticEntity/)
    │   ├── game/                       背包、物品注册表、技能
    │   ├── monitor/                    健康检查(每帧耗时 / tick 频率 / GC / 内存 / CPU)
    │   ├── net/                        WebSocket 接入、房间、快照构建
    │   ├── protocol/                   协议 DTO
    │   └── world/                      世界状态与主循环
    └── resources/application.yml        服务端参数(端口、tick 间隔、视野半径等)
```

## 运行

```bash
cd src/components/pixel_war/java
gradle bootRun          # 启动服务端,默认监听 8080
gradle compileJava      # 仅编译
gradle build -x test    # 构建(不跑测试)
```

## 健康检查

由 `monitor/HealthMonitor` 定时输出到终端日志,默认每 **5 秒**一轮(可用
`pixel-war.health-report-interval-ms` 调整)。报告跑在 Spring 调度线程上,独立于房间 tick 线程,
所以即使主循环被拖慢也能看到“tick 频率低于目标 + 每帧耗时升高”的组合信号。

进程级(每轮一行):

```
[health] 运行 0h00m40s | 房间 1 在线玩家 1 | 堆 23.6/8164.0MB 非堆 43.2MB | 线程 25/25 | GC +1(1ms/5.0s) | CPU 进程 0.1% 系统 22.0% | 物理内存 13.9/31.9GB
```

房间级(每个有玩家/有帧的房间一行):

```
[health][room:health-check-demo] 玩家 1/16 | tick 50.0/s(目标 50.0) | 快照 125 次/5.0s | 每帧 平均 0.42ms 最大 2.07ms P95 0.79ms(世界 0.15 + 快照 0.27) | 超预算帧 0 | 下行 82.8KB/s(3.3KB/次) | 实体 13 [玩家 1 NPC 3 子弹 6 炸弹 0 经验球 0 技能球 0 物品 3] | 空闲 0s
```

| 字段 | 含义 |
| --- | --- |
| 运行 / 房间 / 在线玩家 | 进程运行时长、房间总数、总在线人数 |
| 堆 / 非堆 | 已用/上限堆内存、已用非堆内存 |
| 线程 / GC | 当前与峰值线程数;本周期 GC 次数与停顿时长(增量) |
| CPU / 物理内存 | 进程与系统 CPU 负载、物理内存占用/总量 |
| **每帧 平均/最大/P95** | **单帧主循环耗时(核心指标)**,并拆分为“世界推进 + 快照构建下发” |
| tick x/s(目标 y) | 本周期实际模拟帧率;明显低于目标即为积压/掉帧 |
| 快照 n 次/x s | 本周期实际下发的快照次数(启用快照降频时 < tick 帧数) |
| 超预算帧 | 单帧耗时超过 tick 间隔的帧数 |
| **下行 xKB/s(yKB/次)** | **实际下行带宽(与快照频率无关的口径)**,括号内为每次快照的平均字节数 |
| 实体 | 世界内实体构成(玩家/NPC/子弹/炸弹/经验球/技能球/物品) |
| 空闲 | 距离该房间最后一次客户端活动的时间 |

## 网络开销优化

多人场景下快照会随实体数线性增长(实测 2 人 + 237 NPC + 419 子弹时约 **166.8KB/帧**、建设耗时占每帧 10ms 中的 7ms),以下三项为针对性的瘦身措施:

**1. 浮点量化(2 位小数)** —— `Protocol.Vec` 构造时量化,其余标量在各自 record 的紧凑构造器里量化。
原来 `double` 会被序列化成 16~17 位小数(如 `2764.6261755275023`),量化后为 `2764.63`;坐标/朝向/速度三项原本占快照字节的近四成。
`Tick.tickTime` 同时由 `double` 改为 `long`(避免 `1.759215123456E12` 这种科学计数法占位),前端仍为 JS number,无需改动。

**2. 剔除按类型恒定的字段** —— 这些值在服务端是常量,改由前端 `ProtocolMapper` 补默认值(`H_FIXED_SIZE`):

| 字段 | 恒定值 |
| --- | --- |
| 各实体 `width`/`height` | 玩家/NPC/物品 25、子弹 8、炸弹 10、经验球 12、技能球 14 |
| 子弹 `tag`/`damage`/`teamId` | `ordinary_bullet` / 1 / 客户端渲染不用(命中由服务端裁决) |
| NPC `name`(空)、`deathEffectTimer`(0) | 为默认值时不再下发 |

**3. 快照降频(`pixel-war.snapshot-interval-ticks`,默认 2)** —— 世界仍然 50Hz 推进(物理与命中判定不变),
只是每 2 帧才下发一次快照(25Hz)。事件每帧都收集、随下一次快照一并发出,不会丢事件。
若觉得画面更新不够顺滑,把它改回 `1` 即可恢复“每帧都发”。

各实体实测降幅(单条 JSON 字节数):

| 实体 | 优化前 | 优化后 | 降幅 |
| --- | --- | --- | --- |
| NPC | 317 B | 221 B | -30% |
| 子弹 | 243 B | 138 B | -43% |
| 地面物品 | 170 B | 114 B | -33% |
| 经验球 | 100 B | 59 B | -41% |
| 玩家公开状态 | 328 B | 257 B | -22% |

叠加降频后,总下行约降到原来的 **1/3**。

**还可继续压的两处(未做,按需选):**

- `pixel-war.snapshot-view-radius` 目前 **2400px**,而客户端可见区域只有约 530×368 CSS px(半宽约 265px),
  即下发范围比实际可视范围大一个量级。降到 `800~1000` 实体数可再降数倍;
  代价是小地图上的点会变稀疏(小地图映射的是 20100px 的整个世界,数据只来自快照)。
- 子弹的 `bulletColor`(每条 46 B,占子弹字节的 1/3)与 `teamId` 仍在下发;若改成色板索引/小序号还能再省一截。

前端可以在URL末尾添加参数进行连接

参数
pixelWarPipeline: websocket 

pixelWarServer: ws://127.0.0.1:8080/ws/pixel-war

pixelWarRoom: room-1 // 房间名称

pixelWarName: PlayerA // 玩家名称

http://localhost:5173/pixel-war?pixelWarPipeline=websocket&pixelWarServer=ws://127.0.0.1:8080/ws/pixel-war&pixelWarRoom=room-1&pixelWarName=PlayerA


## 与 TS 版的对齐关系

| 概念 | TS 版(`Service.ts` / `class/**`) | Java 版 |
| --- | --- | --- |
| 主循环 | `TICK_TIMER` + `updateGame` | `world.World#tick` + `net.GameRoom` 的定时线程 |
| 全局配置 | `GCFG` | `core.GameConfig` + `application.yml` |
| 世界数据 | `MAP_DATA` | `world.World` 的各实体集合 |
| 玩家 | `PlayerDynamicEntity` | `entity.dynamic.PlayerEntity` |
| 动态实体 | `DynamicEntity` | `entity.dynamic.DynamicEntity` |
| NPC | `WhitePixel*` / `RedPixel` / `SkyBluePixel` | `entity.dynamic.npc.*` |
| 物品实体 | `ItemEntity` / `FoodItemEntity` | `entity.item.GroundItemEntity` |
| 静态实体 | `StaticEntity` / `CurbStaticEntity` | `entity.staticentity.StaticEntity` |
| 背包/技能 | `class/Inventory`、`class/Skill` | `game.Inventory`、`game.Skill`、`game.Va2ShootSkill` |
| 指令 | `instruct/Instruct.ts` | `protocol.Protocol.ClientType` |

多人化差异：

1. 每个客户端连接对应一个玩家实体，指令不再携带 `playerId`（服务端按会话绑定，防止越权）；
2. 静态地图（边界围墙等 204 个实体）只在 `welcome` 中下发一次；
3. 快照按 `pixel-war.snapshot-view-radius`（默认 2400px）以自己为中心裁剪动态实体；
4. 背包 / 等级 / 经验 / 击杀积分等私有数据只在 `selfPrivate` 中单播；
5. 刷怪节奏（高频/中频/低频环带）按“每名玩家一组计时器”推进；
6. 房间（`net.GameRoom`）在第一名玩家加入时创建，空闲超时后自动回收。

## 可调参数(`application.yml`)

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `pixel-war.tick-interval-ms` | 20 | 主循环间隔，与 TS 版 `TICK_TIMER.interval` 一致 |
| `pixel-war.max-players-per-room` | 16 | 单房间最大玩家数 |
| `pixel-war.snapshot-view-radius` | 2400 | 快照视野裁剪半径(px) |
| `pixel-war.room-idle-timeout-ms` | 60000 | 空房间回收时间 |
| `pixel-war.world.*` | 20000 / ±10000 | 世界尺寸，与 `GCFG.world*` 一致 |
