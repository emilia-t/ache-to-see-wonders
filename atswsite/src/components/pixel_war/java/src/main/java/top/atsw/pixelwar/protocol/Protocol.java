package top.atsw.pixelwar.protocol;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * pixel_war 多人对局协议(WebSocket + JSON)。
 *
 * <p>与前端单人模式使用的 Worker 内部协议相比,这里做了多人化设计:</p>
 * <ul>
 *   <li>静态地图只在 {@code welcome} 中下发一次,后续快照不再携带;</li>
 *   <li>每个客户端的快照按"以自己为中心的视野半径"裁剪动态实体;</li>
 *   <li>背包 / 等级 / 经验 / 击杀积分等私有数据放在 {@code selfPrivate} 中单播,不广播给其他玩家;</li>
 *   <li>客户端指令不再携带 playerId,由服务端按连接会话绑定,避免越权操作他人实体。</li>
 * </ul>
 *
 * <p>所有 DTO 均为 record,序列化时忽略 null 字段(见 application.yml 的 jackson.default-property-inclusion)。</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class Protocol {

    private Protocol() {
    }

    /** 客户端 -> 服务端 的消息类型 */
    public static final class ClientType {
        public static final String JOIN = "join";
        public static final String MOVE_INPUT = "move_input";
        public static final String FIRE_INPUT = "fire_input";
        public static final String DODGE_INPUT = "dodge_input";
        public static final String RESPAWN = "respawn";
        public static final String INVENTORY_UPDATE = "inventory_update";
        public static final String INVENTORY_USE_ITEM = "inventory_use_item";
        public static final String TICK_PAUSE = "tick_pause";
        public static final String PING = "ping";

        private ClientType() {
        }
    }

    /** 服务端 -> 客户端 的消息类型 */
    public static final class ServerType {
        public static final String WELCOME = "welcome";
        public static final String SNAPSHOT = "snapshot";
        public static final String PLAYER_JOINED = "player_joined";
        public static final String PLAYER_LEFT = "player_left";
        public static final String EVENT = "event";
        public static final String PONG = "pong";
        public static final String ERROR = "error";

        private ServerType() {
        }
    }

    // ==================================================================
    // 客户端 -> 服务端
    // ==================================================================

    /** 客户端消息信封:{ "type": "...", "data": { ... } } */
    public record ClientEnvelope(String type, JsonNode data) {
    }

    /** join:加入房间。roomId 缺省为 "default" */
    public record JoinRequest(String roomId, String playerName, String clientId) {
    }

    /** 移动输入(对应 TS 版 player_move_input 的 moveState) */
    public record MoveInput(MoveState moveState) {
    }

    /** WASD / Shift 按键状态,键名与前端保持一致 */
    public record MoveState(
            @JsonProperty("W") boolean w,
            @JsonProperty("A") boolean a,
            @JsonProperty("S") boolean s,
            @JsonProperty("D") boolean d,
            @JsonProperty("Shift") boolean shift
    ) {
    }

    /**
     * 浮点量化:保留 2 位小数(0.01 精度)。
     *
     * <p>客户端按像素渲染,double 的 16~17 位小数纯属浪费带宽——实测坐标/朝向/速度
     * 三项占了快照字节的近四成。量化后每条实体的浮点字段体积约降 60%,视觉无差别。</p>
     */
    static double quantize(double value) {
        if (!Double.isFinite(value)) {
            return 0;
        }
        return Math.round(value * 100.0) / 100.0;
    }

    /**
     * 通用二维坐标(世界坐标 px / 单位方向向量)。
     *
     * <p>构造时量化到 2 位小数,见 {@link #quantize(double)}。</p>
     */
    public record Vec(double x, double y) {

        public Vec {
            x = quantize(x);
            y = quantize(y);
        }
    }

    /** 开火输入:target 为世界坐标瞄准点 */
    public record FireInput(Vec target) {
    }

    /** 闪避输入:direction 为闪避方向向量(可为任意非零向量) */
    public record DodgeInput(Vec direction) {
    }

    /** 背包状态同步(装配调整/卸下/销毁后客户端提交完整背包) */
    public record InventoryUpdate(InventoryDto inventory) {
    }

    /** 使用背包物品 */
    public record InventoryUseItem(String uid) {
    }

    /** 暂停开关,data 为 null 时服务端自行切换 */
    public record TickPause(Boolean paused) {
    }

    /** 心跳 */
    public record Ping(double clientTime) {
    }

    // ==================================================================
    // 服务端 -> 客户端
    // ==================================================================

    /** 服务端消息信封 */
    public record ServerEnvelope(String type, Object data) {
    }

    /**
     * 主循环 tick 信息(对应 TS 版 TickTimer.tick)。
     *
     * <p>tickTime 为毫秒时间戳,用 long 而非 double:后者会被写成科学计数法
     * (1.759215123456E12,17 字符),前者仅 13 字符。前端都是 JS number,无需改动。</p>
     */
    public record Tick(long tickCount, long tickTime) {
    }

    /** 世界尺寸(对应 TS 版 GCFG.world*) */
    public record WorldDto(double size, double minX, double maxX, double minY, double maxY) {
    }

    /** welcome:加入成功后的初始化数据(静态地图只下发一次) */
    public record Welcome(
            long playerId,
            String roomId,
            String playerName,
            int tickIntervalMs,
            WorldDto world,
            List<StaticEntitySnapshot> staticEntities,
            List<PlayerPublic> players
    ) {
    }

    /** 静态实体快照(围墙长条/角块等,仅在 welcome 中下发) */
    public record StaticEntitySnapshot(
            long id,
            String tag,
            String name,
            Vec position,
            double width,
            double height,
            String direction
    ) {
    }

    /** 每帧快照:动态实体 + 自己的私有数据 */
    public record Snapshot(
            Tick tick,
            PlayerPublic self,
            PlayerPrivate selfPrivate,
            List<PlayerPublic> players,
            List<NpcSnapshot> npcs,
            List<BulletSnapshot> bullets,
            List<GrenadeSnapshot> grenades,
            List<ExpOrbSnapshot> expOrbs,
            List<SkillOrbSnapshot> skillOrbs,
            List<ItemSnapshot> items
    ) {
    }

    /**
     * 玩家的公开状态(广播给所有玩家,用于渲染他人)。
     *
     * <p>width/height 固定为 25,不再下发,由前端映射层补默认值。</p>
     */
    public record PlayerPublic(
            long id,
            String name,
            Long teamId,
            Vec position,
            Vec facingDirection,
            double health,
            double healthMax,
            boolean dead,
            boolean moving,
            boolean sprinting,
            double staminaRatio,
            int servantCount,
            long score,
            int level
    ) {

        public PlayerPublic {
            health = quantize(health);
            healthMax = quantize(healthMax);
            staminaRatio = quantize(staminaRatio);
        }
    }

    /** 玩家的私有状态(仅单播给本人):背包 / 经验 / 冷却 / 从者列表 */
    public record PlayerPrivate(
            long playerId,
            long score,
            int level,
            double exp,
            double expToNextLevel,
            double stamina,
            double staminaMax,
            boolean sprinting,
            double invincibleTimer,
            double fireCooldownNow,
            double fireCooldownMax,
            double dodgeCooldownNow,
            double dodgeCooldownMax,
            InventoryDto inventory,
            List<Long> servantIds
    ) {
    }

    /**
     * NPC 快照。
     *
     * <p>width/height 固定为 25 不再下发;name 为空字符串时置 null(序列化时直接被忽略);
     * deathEffectTimer 仅在死亡特效期间有值(平时 null)。</p>
     */
    public record NpcSnapshot(
            long id,
            String tag,
            String name,
            Long ownerId,
            Long teamId,
            String attitude,
            Vec position,
            Vec facingDirection,
            double health,
            double healthMax,
            boolean dead,
            boolean moving,
            String mapColor,
            Integer killScore,
            Double deathEffectTimer
    ) {

        public NpcSnapshot {
            health = quantize(health);
            healthMax = quantize(healthMax);
            if (name != null && name.isBlank()) {
                name = null;// 空名字不再下发(序列化时直接被忽略)
            }
            if (deathEffectTimer != null) {
                deathEffectTimer = quantize(deathEffectTimer);
                if (deathEffectTimer <= 0) {
                    deathEffectTimer = null;
                }
            }
        }
    }

    /**
     * 子弹快照。
     *
     * <p>子弹只有一种类型(BulletEntity 为 final 且 tag 恒为 ordinary_bullet)、
     * 尺寸恒为 8×8、伤害恒为 1,且命中由服务端裁决,这些字段均不再下发。
     * 本项目子弹数量最多(实测可达 400+ / 帧),该裁剪收益最大。</p>
     */
    public record BulletSnapshot(
            long id,
            Vec position,
            Vec velocity,
            Long ownerId,
            String bulletColor
    ) {
    }

    /**
     * 手雷/炸弹快照。
     *
     * <p>尺寸恒为 10×10,不再下发。</p>
     */
    public record GrenadeSnapshot(
            long id,
            String tag,
            Vec position,
            Long ownerId,
            double fuseRatio
    ) {

        public GrenadeSnapshot {
            fuseRatio = quantize(fuseRatio);
        }
    }

    /** 经验球快照(碰撞体积恒为 12×12,不再下发) */
    public record ExpOrbSnapshot(
            long id,
            Vec position,
            int value
    ) {
    }

    /** 技能球快照(碰撞体积恒为 14×14,不再下发) */
    public record SkillOrbSnapshot(
            long id,
            Vec position,
            String skillTag
    ) {
    }

    /** 地面物品快照(含死亡掉落物,count 为堆叠数量;尺寸恒为 25×25,不再下发) */
    public record ItemSnapshot(
            long id,
            String tag,
            String name,
            Vec position,
            int count,
            double lifetimeRatio
    ) {

        public ItemSnapshot {
            lifetimeRatio = quantize(lifetimeRatio);
        }
    }

    /** 背包数据(与前端 InventoryEntry / PlayerInventory 结构对齐) */
    public record InventoryDto(List<InventoryEntryDto> entries, List<String> equippedSkills) {
    }

    /** 背包条目,null 元素表示空格 */
    public record InventoryEntryDto(
            String uid,
            String kind,
            String tag,
            String name,
            int count,
            int maxStack,
            String color
    ) {
    }

    /** 游戏事件通知(击杀 / 升级 / 掉落 / 暂停等) */
    public record GameEvent(String event, java.util.Map<String, Object> data) {
    }

    /** 心跳响应 */
    public record Pong(double clientTime, double serverTime) {
    }

    /** 错误消息 */
    public record ErrorMessage(String message) {
    }
}
