package top.atsw.pixelwar.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 服务端启动时可调参数。
 * application.yml 中 pixel-war 节点对应的配置会映射到此类,并在服务端启动时注入到 GameConfig 中。
 * 要修改参数,请在 application.yml 中 pixel-war 节点下修改对应的配置项,然后重启服务端。
 *
 * @param tickIntervalMs          主循环间隔(毫秒),对应 TS 版 TICK_TIMER.interval
 * @param maxPlayersPerRoom      单个房间最大玩家数
 * @param snapshotViewRadius     快照中动态实体的视野裁剪半径(px)
 * @param snapshotIntervalTicks  每多少个 tick 下发一次快照(默认 2 → 25Hz);世界仍然每帧推进
 * @param roomIdleTimeoutMs      空闲房间(无玩家连接)存活时间(毫秒)
 * @param spawnNearPlayers       新玩家出生点是否靠近房间内已有玩家(null 表示使用默认值 true)
 * @param spawnNearPlayersRadius 靠近已有玩家时的出生距离上限(px,null 表示使用默认值 300)
 * @param world                  世界尺寸配置
 */
@ConfigurationProperties(prefix = "pixel-war")
public record PixelWarProperties(
        int tickIntervalMs,
        int maxPlayersPerRoom,
        double snapshotViewRadius,
        int snapshotIntervalTicks,
        long roomIdleTimeoutMs,
        Boolean spawnNearPlayers,
        Double spawnNearPlayersRadius,
        World world
) {

    /** 补齐缺省值,保证未配置时服务端也能正常启动 */
    public PixelWarProperties {
        if (tickIntervalMs <= 0) {
            tickIntervalMs = 20;
        }
        if (maxPlayersPerRoom <= 0) {
            maxPlayersPerRoom = 16;
        }
        if (snapshotViewRadius <= 0) {
            snapshotViewRadius = 2400;
        }
        if (snapshotIntervalTicks <= 0) {
            snapshotIntervalTicks = 1;
        }
        if (roomIdleTimeoutMs <= 0) {
            roomIdleTimeoutMs = 60000;
        }
        // 默认让新玩家出生在已有玩家附近,否则两人会相隔上万像素而彼此看不见
        if (spawnNearPlayers == null) {
            spawnNearPlayers = Boolean.TRUE;
        }
        if (spawnNearPlayersRadius == null || spawnNearPlayersRadius <= 0) {
            spawnNearPlayersRadius = 300.0;
        }
        if (world == null) {
            world = new World(20000, -10000, 10000, -10000, 10000);
        }
    }

    /**
     * 世界尺寸配置,对应 TS 版 GCFG.worldSize / worldMinX / worldMaxX / worldMinY / worldMaxY。
     *
     * @param size 世界边长(px)
     * @param minX 世界最小 X
     * @param maxX 世界最大 X
     * @param minY 世界最小 Y
     * @param maxY 世界最大 Y
     */
    public record World(double size, double minX, double maxX, double minY, double maxY) {

        public World {
            if (size <= 0) {
                size = 20000;
            }
            if (minX == 0 && maxX == 0) {
                minX = -size / 2;
                maxX = size / 2;
            }
            if (minY == 0 && maxY == 0) {
                minY = -size / 2;
                maxY = size / 2;
            }
        }
    }
}
