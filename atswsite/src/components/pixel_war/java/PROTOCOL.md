# pixel_war 多人对局协议(WebSocket + JSON)

- 端点：`ws://<host>:8080/ws/pixel-war`
- 编码：UTF-8 JSON 文本帧，字段名为小写驼峰；`null` 字段在序列化时被忽略
- 时序：连接建立 → 客户端发 `join` → 服务端回 `welcome`(含静态地图) → 之后每个 tick 下发 `snapshot`

## 1. 客户端 → 服务端

统一信封：`{ "type": "<类型>", "data": { ... } }`。**所有指令都不需要携带玩家 id**，服务端按会话绑定。

| 类型 | data | 说明 |
| --- | --- | --- |
| `join` | `{ roomId?, playerName?, clientId? }` | 加入房间；`roomId` 缺省为 `default` |
| `move_input` | `{ moveState: { W, A, S, D, Shift } }` | WASD 移动与 Shift 疾跑（全量覆盖） |
| `fire_input` | `{ target: { x, y } }` | 向世界坐标瞄准点开火（冷却由服务端裁决） |
| `dodge_input` | `{ direction: { x, y } }` | 朝指定方向闪避（含无敌帧与冷却） |
| `respawn` | `{}` | 死亡后请求重生（服务端随机出生点） |
| `inventory_update` | `{ inventory: { entries, equippedSkills } }` | 客户端背包变更后提交完整背包（服务端会规范化） |
| `inventory_use_item` | `{ uid }` | 使用背包物品 |
| `servant_editor_delete` | `{ npcId }` | 从者编辑器：令指定从者死亡 |
| `servant_editor_rotate` | `{ npcId }` | 从者编辑器：旋转从者朝向 |
| `tick_pause` | `{ paused?: boolean }` | 暂停/恢复；不传 `paused` 时服务端自行切换 |
| `ping` | `{ clientTime }` | 心跳，服务端回 `pong` |

示例：

```json
{ "type": "join", "data": { "roomId": "room-1", "playerName": "Player" } }
{ "type": "move_input", "data": { "moveState": { "W": true, "A": false, "S": false, "D": true, "Shift": true } } }
{ "type": "fire_input", "data": { "target": { "x": 120.5, "y": -88.0 } } }
```

## 2. 服务端 → 客户端

统一信封：`{ "type": "<类型>", "data": { ... } }`。

| 类型 | data | 说明 |
| --- | --- | --- |
| `welcome` | `{ playerId, roomId, playerName, tickIntervalMs, world, staticEntities[], players[] }` | 加入成功；**静态地图只在此下发一次** |
| `snapshot` | 见下 | 每 tick 一帧 |
| `event` | `{ event, data }` | 游戏事件（`player_joined` / `player_left` / `npc_killed` / `item_picked` / `bomb_exploded` / `player_died` / `servant_absorbed` / `tick_pause`） |
| `player_joined` / `player_left` | `{ playerId, name }` | 在线玩家变化（轻量广播，便于 UI 提示） |
| `pong` | `{ clientTime, serverTime }` | 心跳响应 |
| `error` | `{ message }` | 指令或状态错误 |

### snapshot 结构

```jsonc
{
  "tick": { "tickCount": 1234, "tickTime": 1730000000000 },
  "self":        { /* PlayerPublic:自己的公开状态 */ },
  "selfPrivate": { /* PlayerPrivate:背包/经验/冷却/从者,仅单播给自己 */ },
  "players": [ /* PlayerPublic[]:视野内的玩家(含自己,自己的实体固定排在首位的是 self) */ ],
  "npcs":      [ { "id", "tag", "name", "ownerId", "teamId", "attitude", "position", "facingDirection",
                   "width", "height", "health", "healthMax", "dead", "moving", "mapColor", "killScore" } ],
  "bullets":   [ { "id", "tag", "position", "velocity", "ownerId", "teamId", "width", "height", "damage", "bulletColor" } ],
  "grenades":  [ { "id", "tag", "position", "ownerId", "teamId", "width", "height", "fuseRatio" } ],
  "expOrbs":   [ { "id", "position", "value", "width", "height" } ],
  "skillOrbs": [ { "id", "position", "skillTag", "width", "height" } ],
  "items":     [ { "id", "tag", "name", "position", "count", "width", "height", "lifetimeRatio" } ]
}
```

`PlayerPublic`：`id / name / teamId / position / facingDirection / width / height / health / healthMax / dead / moving / sprinting / staminaRatio / servantCount / score / level`

`PlayerPrivate`：`playerId / score / level / exp / expToNextLevel / stamina / staminaMax / sprinting / invincibleTimer / fireCooldownNow / fireCooldownMax / dodgeCooldownNow / dodgeCooldownMax / inventory / servantIds`

`inventory` 与前端结构一致：

```jsonc
{
  "entries": [ { "uid", "kind": "item|skill", "tag", "name", "count", "maxStack", "color" }, null, ... ],
  "equippedSkills": [ "va2_shoot_skill", null, ... ]
}
```

### 多人化设计要点

1. **静态地图仅一次**：`welcome.staticEntities` 为全部静态实体（边界围墙 204 个）；
2. **视野裁剪**：`npcs / bullets / grenades / expOrbs / skillOrbs / items / players` 只包含以 `self` 为中心、
   半径 `pixel-war.snapshot-view-radius`（默认 2400px）矩形范围内的实体；
3. **私有数据单播**：`selfPrivate` 只发送给本人，其他玩家不可见其背包与经验；
4. **服务端权威**：位置、伤害、掉落、冷却、暂停均由服务端裁决，客户端只做输入与插值渲染。

## 3. 前端接入

前端已内置连接适配层，无需改动渲染逻辑：

```
src/components/pixel_war/service/transport/
├── ServiceTransport.ts      通道接口 + 工厂(默认 Worker)
├── WorkerTransport.ts       本地 Web Worker 通道(单人模式)
├── WebSocketTransport.ts    Java 服务端通道(多人模式,含自动重连)
├── JavaProtocol.ts          Java 协议类型
└── ProtocolMapper.ts        Java 协议 <-> 前端 MapData 双向映射
```

切换方式（优先级从高到低）：

1. URL 查询参数：
   `/pixel-war?pixelWarPipeline=websocket&pixelWarServer=ws://127.0.0.1:8080/ws/pixel-war&pixelWarRoom=room-1&pixelWarName=Player`
2. 宿主页面注入：`window.__PIXEL_WAR_CONNECTION__ = { pipeline: 'websocket', serverUrl: '...', roomId: 'room-1' }`
3. `localStorage`：`pixelWarPipeline` / `pixelWarServerUrl` / `pixelWarRoomId` / `pixelWarPlayerName`
4. 默认值：`worker`（单人模式）

## 4. 联调记录(2026-09)

已使用真实 WebSocket 客户端完成冒烟验证：

- `welcome`：`playerId=304`、`tickIntervalMs=20`、`staticEntities=204`（与 TS 版围墙数量一致）；
- 每 20ms 一帧 `snapshot`（5 秒内 456 帧）；
- `move_input`（W+D+Shift）后位置从 (3615,-3221) 移动到 (4477,-2359)，位移约 1219px；
- `fire_input` 生成普通子弹，刷怪系统产出 NPC 与地面物品；
- `tick_pause` 期间 `tickCount` 停止增长，恢复后继续推进；
- `inventory_update` 提交后 `selfPrivate.inventory` 为 `healing_gem x3`（服务端已规范化）。
