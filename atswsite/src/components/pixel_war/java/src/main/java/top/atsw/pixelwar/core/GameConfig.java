package top.atsw.pixelwar.core;

import top.atsw.pixelwar.config.PixelWarProperties;

/**
 * 全局游戏规则配置
 */
public final class GameConfig {
    // ---- 世界尺寸 ----
    public final double worldSize;
    public final double worldMinX;
    public final double worldMaxX;
    public final double worldMinY;
    public final double worldMaxY;

    // ---- NPC 刷新 ----
    public final double npcSpawnNoSpawnRadius = 300;
    public final double npcSpawnHighRadius = 900;
    public final double npcSpawnMediumRadius = 1800;
    public final double npcSpawnLowRadius = 3200;
    public final double npcDespawnDistance = 4800;
    public final double npcSpawnHighInterval = 4;
    public final double npcSpawnMediumInterval = 10;
    public final double npcSpawnLowInterval = 22;
    public final int npcSpawnMaxCount = 80;
    public final int npcSpawnMaxAttempts = 1;
    public final double npcSpawnPadding = 12;

    // ---- 物品刷新 ----
    public final double itemSpawnNoSpawnRadius = 300;
    public final double itemSpawnHighRadius = 900;
    public final double itemSpawnMediumRadius = 1800;
    public final double itemSpawnLowRadius = 3200;
    public final double itemSpawnHighInterval = 6;
    public final double itemSpawnMediumInterval = 14;
    public final double itemSpawnLowInterval = 30;
    public final int itemSpawnMaxCount = 20;
    public final int itemSpawnMaxAttempts = 1;
    public final double itemSpawnPadding = 50;

    /** 是否单人模式:Java 服务端用于多人,固定为 false */
    public final boolean singleplayerMode = false;

    /** 每tick为 NPC 选取随机目标的尝试次数*/
    public final int setRandomTargetMaxAttempts = 1;

    /*****java specific config*****/

    /** 新玩家出生点是否靠近房间内已有玩家 */
    public final boolean spawnNearPlayers;
    /** 靠近已有玩家时的出生距离上限(px) */
    public final double spawnNearPlayersRadius;

    /*****java specific config*****/

    public GameConfig(PixelWarProperties properties) {
        PixelWarProperties.World world = properties.world();
        this.worldSize = world.size();
        this.worldMinX = world.minX();
        this.worldMaxX = world.maxX();
        this.worldMinY = world.minY();
        this.worldMaxY = world.maxY();
        this.spawnNearPlayers = Boolean.TRUE.equals(properties.spawnNearPlayers());
        this.spawnNearPlayersRadius = properties.spawnNearPlayersRadius();
    }
}
