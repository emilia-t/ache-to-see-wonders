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
| `inventory_drop` | `{ kind, tag, name, color, count, direction, distance }` | 拖拽丢弃：在 `direction` 方向上抛出 `distance` px 落到地面（技能落成技能球、物品落成地面物品）|
| `research_choose` | `{ tag }` | 从专研界面选择一项研究(必须属于服务端下发的待选项) |
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
                   "width", "height", "health", "healthMax", "dead", "moving", "mapColor", "killScore", "level",
                   /* 仅带旋转线段的 NPC(珊瑚红触手)额外携带 */ "tentacleTicks" } ],
  "bullets":   [ { "id", "position", "velocity", "ownerId", "bulletColor",
                   /* 仅激光弹额外携带 */ "tag", "laserMaxLength", "laserExpandSpeed", "laserHoldSeconds", "laserElapsed", "laserGlowColor" } ],
  "grenades":  [ { "id", "tag", "position", "ownerId", "teamId", "width", "height", "fuseRatio" } ],
  "expOrbs":   [ { "id", "position", "value", "width", "height" } ],
  "skillOrbs": [ { "id", "position", "skillTag", "width", "height" } ],
  "bulletOrbs": [ { "id", "position", "value", "width", "height" } ],
  "items":     [ { "id", "tag", "name", "position", "count", "width", "height", "lifetimeRatio" } ]
}
```

`PlayerPublic`：`id / name / teamId / position / facingDirection / width / height / health / healthMax / dead / moving / sprinting / staminaRatio / servantCount / score / level`

> `NpcSnapshot.level`：NPC 等级（0~5）。等级越高能力越强（移动速度、子弹速度、攻击间隔、闪现冷却、
> 紫盾生命值/防护方块数、经验值均随等级变化，见 `game/NpcLevelTable` 与 `NpcEntity.applyNpcLevel`）。
> 为节省带宽，**等级 0 时该字段不下发**，客户端缺省视为 0。刷怪时按等级概率表随机等级
> （上限 5 用 45/25/15/8/5/2%，上限 2 用 65/25/10%）。

> `NpcSnapshot.tentacleTicks`：**仅珊瑚红触手（`coral_red_tentacle_t1`）使用**，为触手的旋转相位
> （累计 tick 计数，每 tick +1）。触手的当前角度由该计数派生：`angle = 180° - ticks × 2°`
> （初始正西、顺时针旋转，长度 `Len = 100 + Level × 25` px）。该字段为 0 时不下发，客户端缺省视为 0；
> 客户端不会调用实体 `update()`，因此必须由服务端下发该相位才能画出与权威判定一致的角度。
> 触手的持续接触伤害完全由服务端结算（首次接触 1 点，持续接触每 10 tick 再 1 点），不占用协议。

> `BulletSnapshot`：普通子弹只下发 `id / position / velocity / ownerId / bulletColor`
> （尺寸恒为 8×8、伤害恒为 1 且命中由服务端裁决，不再下发）。
> **激光弹（`entity/dynamicEntity/LaserBulletEntity`）**额外下发 6 个字段——`tag`（`laser_bullet`），
> `laserMaxLength`（最大长度 px，已按围墙截断）、`laserExpandSpeed`（前端展开速度 px/s）、
> `laserHoldSeconds`（阶段 3 持续发光秒数）、`laserElapsed`（已存在秒数）、`laserGlowColor`（辉光色）。
> 客户端据此在本地按时间轴还原「展开 → 渐亮 0.1s → 持续发光 → 渐暗 0.1s」动画
> （普通子弹这些字段缺省，水合时会被跳过）。激光的持续接触伤害完全由服务端结算，不占用协议。

`PlayerPrivate`：`playerId / score / level / exp / expToNextLevel / stamina / staminaMax / sprinting / fireCooldownNow / fireCooldownMax / bulletCount / bulletMaxCount / equippedSkillCooldowns / inventory / servantIds / research / researchPendingOptions / deathRespawnDelay / deathRespawnRemaining / lastDamagerName / lastDeathReport`

> 说明：`invincibleTimer`、`dodgeCooldownNow`、`dodgeCooldownMax` 已从玩家规则中移除。
> 玩家不再有无敌时间；闪避冷却改由玩家装配的「闪现」技能自带的内置CD计时器管理
> （技能定义：`hasCooldown` / `maxCooldown` / 按持有者记录的 `currentCooldown`）。
> `equippedSkillCooldowns`：长度 10 的数组，下标与 `inventory.equippedSkills` 一致，
> 值为对应槽位技能的**剩余冷却秒数**（0 表示就绪，无冷却的技能恒为 0，量化到 2 位小数），
> 仅用于客户端渲染技能冷却（冷却时长上限由客户端从技能定义 `maxCooldown` 取得，无需下发）。
>
> `research`：已研究的专研项数组 `[{ tag, level, value }]`；`value` 仅「不动堡垒」用于记录剩余吸收值，其余恒为 0。
> `researchPendingOptions`：待玩家选择的专研项标签数组（空数组表示无待选界面）。
> 玩家升级时按 `p = max(0.05, (64 - 等级)/100)` 的概率触发专研，服务端抽取 3 个互不相同的研究项下发，
> 客户端展示顶部小卡片并回传 `research_choose`。
> **跨级补发**：每次升级都独立判定，判定成功的次数累计为服务端私有的「待抽取次数」；一次升级跨越多级时，
> 玩家选择后会立即补发下一次待选项，不会漏掉抽取机会。
>
> `lastDeathReport`：最近一次死亡结算明细，重生后为 `null`。结构：
> ```jsonc
> {
>   "droppedExp": 215.0,
>   "items": [ { "tag": "healing_gem", "name": "治疗宝石", "count": 3 } ],
>   "skillTags": [ "va2_shoot_skill" ],
>   "researchDowngrades": [ { "tag": "move_speed", "from": 3, "to": 2 } ]
> }
> ```
> `researchDowngrades` 中 `to == 0` 表示该研究项已被移除；死亡时所有专研项降低 1 级，降至 0 级则移除。
> `droppedExp = min(215, ceil((等级折算总经验 + 当前经验) × 0.6))`。客户端据该字段在死亡界面展示掉落与降级信息。
>
> `deathRespawnDelay` / `deathRespawnRemaining`：死亡后需等待的复活时间与剩余时间（秒，量化到 2 位小数）。
> 等待时间 `X = 3 + 死亡时等级 / 3`（整数，上限 30），在等级被清零前按死亡时的等级计算；
> 未死亡时两者均为 0。服务端会拒绝等待时间未结束的 `respawn` 请求，客户端据剩余时间展示复活倒计时。
>
> `lastDamagerName`：最近一次对玩家造成伤害的来源显示名，用于死亡界面提示「你被 xxx 击倒了」。
> 玩家 → 玩家名；玩家的从者 NPC → 从者所属玩家名；无主 NPC → NPC 类型名称（各 NPC 的静态 `NAME`，
> 如「红色像素」）；玩家离开地图范围 → 「地图边界」。未受伤时为空串。

`inventory` 与前端结构一致：

```jsonc
{
  "entries": [ { "uid", "kind": "item|skill", "tag", "name", "count", "maxStack", "color" }, null, ... ],
  "equippedSkills": [ "va2_shoot_skill", null, ... ]
}
```

### 多人化设计要点

1. **静态地图仅一次**：`welcome.staticEntities` 为全部静态实体（边界围墙 204 个）；
2. **视野裁剪**：`npcs / bullets / grenades / expOrbs / skillOrbs / bulletOrbs / items / players` 只包含以 `self` 为中心、
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
