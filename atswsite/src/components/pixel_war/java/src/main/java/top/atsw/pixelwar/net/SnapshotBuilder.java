package top.atsw.pixelwar.net;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.dynamicEntity.BombEntity;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.BulletOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.ExpOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.LaserBulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.dynamicEntity.SkillOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.npc.NpcEntity;
import top.atsw.pixelwar.entity.itemEntity.ItemEntity;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;
import top.atsw.pixelwar.game.Inventory;
import top.atsw.pixelwar.game.Research;
import top.atsw.pixelwar.protocol.Protocol;
import top.atsw.pixelwar.world.World;

import java.util.ArrayList;
import java.util.List;

/**
 * 快照构建:把世界状态转换成下发协议 DTO。
 *
 * <p>多人优化:</p>
 * <ul>
 *   <li>静态地图只在 {@code welcome} 中发送一次;</li>
 *   <li>动态实体按"以自己为中心的视野半径"裁剪,避免整图广播;</li>
 *   <li>背包/经验/积分等私有数据只放在 {@code selfPrivate} 中单播。</li>
 * </ul>
 */
public final class SnapshotBuilder {

    private SnapshotBuilder() {
    }

    /** 构建加入成功后的初始化数据(含静态地图全量) */
    public static Protocol.Welcome buildWelcome(World world, PlayerEntity self, String roomId, int tickIntervalMs) {
        List<Protocol.StaticEntitySnapshot> statics = new ArrayList<>(world.staticEntities().size());
        for (StaticEntity entity : world.staticEntities()) {
            statics.add(new Protocol.StaticEntitySnapshot(
                    entity.id,
                    entity.tag,
                    entity.name,
                    new Protocol.Vec(entity.position.x, entity.position.y),
                    entity.width,
                    entity.height,
                    entity.direction));
        }
        List<Protocol.PlayerPublic> players = new ArrayList<>();
        for (PlayerEntity player : world.players()) {
            players.add(toPlayerPublic(player));
        }
        return new Protocol.Welcome(
                self.id,
                roomId,
                self.playerName,
                tickIntervalMs,
                new Protocol.WorldDto(
                        world.config().worldSize,
                        world.config().worldMinX,
                        world.config().worldMaxX,
                        world.config().worldMinY,
                        world.config().worldMaxY),
                statics,
                players);
    }

    /** 构建某一帧的快照(以 self 为中心做视野裁剪) */
    public static Protocol.Snapshot build(World world, PlayerEntity self, double viewRadius,
                                          long tickCount, long tickTime) {
        Geometry.Vec2 center = self.position;

        List<Protocol.PlayerPublic> players = new ArrayList<>();
        for (PlayerEntity player : world.players()) {
            if (player.id == self.id || inView(center, player.position, viewRadius)) {
                players.add(toPlayerPublic(player));
            }
        }

        List<Protocol.NpcSnapshot> npcs = new ArrayList<>();
        for (NpcEntity npc : world.npcs()) {
            if (!inView(center, npc.position, viewRadius)) {
                continue;
            }
            npcs.add(new Protocol.NpcSnapshot(
                    npc.id,
                    npc.tag,
                    npc.name,
                    npc.ownerId,
                    npc.teamId,
                    npc.attitude,
                    new Protocol.Vec(npc.position.x, npc.position.y),
                    new Protocol.Vec(npc.facingDirection.x, npc.facingDirection.y),
                    npc.health,
                    npc.healthMax,
                    npc.isDead,
                    npc.isMoving,
                    npc.mapColor,
                    npc.killScore,
                    npc.deathEffectTimer,
                    npc.level));
        }

        List<Protocol.BulletSnapshot> bullets = new ArrayList<>();
        for (BulletEntity bullet : world.bullets()) {
            LaserBulletEntity laser = bullet instanceof LaserBulletEntity laserBullet ? laserBullet : null;
            // 视野裁剪:激光的线段可能远长于起点,改用线段中点参与裁剪,
            // 避免"从视野外射入"的长激光整段不显示
            double cullX = bullet.position.x;
            double cullY = bullet.position.y;
            if (laser != null) {
                Geometry.Vec2 dir = laser.unitDirection();
                double length = laser.lengthAt(laser.laserElapsed);
                cullX += dir.x * length * 0.5;
                cullY += dir.y * length * 0.5;
            }
            if (!inView(center, new Geometry.Vec2(cullX, cullY), viewRadius)) {
                continue;
            }
            bullets.add(new Protocol.BulletSnapshot(
                    bullet.id,
                    new Protocol.Vec(bullet.position.x, bullet.position.y),
                    new Protocol.Vec(bullet.velocity.x, bullet.velocity.y),
                    bullet.ownerId,
                    bullet.bulletColor,
                    laser != null ? laser.tag : null,
                    laser != null ? laser.laserMaxLength : null,
                    laser != null ? laser.laserExpandSpeed : null,
                    laser != null ? laser.laserHoldSeconds : null,
                    laser != null ? laser.laserElapsed : null,
                    laser != null ? laser.laserGlowColor : null));
        }

        List<Protocol.GrenadeSnapshot> grenades = new ArrayList<>();
        for (BombEntity bomb : world.bombs()) {
            if (!inView(center, bomb.position, viewRadius)) {
                continue;
            }
            grenades.add(new Protocol.GrenadeSnapshot(
                    bomb.id,
                    bomb.tag,
                    new Protocol.Vec(bomb.position.x, bomb.position.y),
                    bomb.ownerId,
                    bomb.fuseRatio()));
        }

        List<Protocol.ExpOrbSnapshot> expOrbs = new ArrayList<>();
        for (ExpOrbEntity orb : world.expOrbs()) {
            if (!inView(center, orb.position, viewRadius)) {
                continue;
            }
            expOrbs.add(new Protocol.ExpOrbSnapshot(
                    orb.id,
                    new Protocol.Vec(orb.position.x, orb.position.y),
                    orb.value));
        }

        List<Protocol.SkillOrbSnapshot> skillOrbs = new ArrayList<>();
        for (SkillOrbEntity orb : world.skillOrbs()) {
            if (!inView(center, orb.position, viewRadius)) {
                continue;
            }
            skillOrbs.add(new Protocol.SkillOrbSnapshot(
                    orb.id,
                    new Protocol.Vec(orb.position.x, orb.position.y),
                    orb.skillTag));
        }

        List<Protocol.BulletOrbSnapshot> bulletOrbs = new ArrayList<>();
        for (BulletOrbEntity orb : world.bulletOrbs()) {
            if (!inView(center, orb.position, viewRadius)) {
                continue;
            }
            bulletOrbs.add(new Protocol.BulletOrbSnapshot(
                    orb.id,
                    new Protocol.Vec(orb.position.x, orb.position.y),
                    orb.value));
        }

        List<Protocol.ItemSnapshot> items = new ArrayList<>();
        for (ItemEntity item : world.items()) {
            if (!inView(center, item.position, viewRadius)) {
                continue;
            }
            items.add(new Protocol.ItemSnapshot(
                    item.id,
                    item.tag,
                    item.name,
                    new Protocol.Vec(item.position.x, item.position.y),
                    item.count,
                    item.lifetimeRatio()));
        }

        return new Protocol.Snapshot(
                new Protocol.Tick(tickCount, tickTime),
                toPlayerPublic(self),
                toPlayerPrivate(self),
                players,
                npcs,
                bullets,
                grenades,
                expOrbs,
                skillOrbs,
                bulletOrbs,
                items);
    }

    private static boolean inView(Geometry.Vec2 center, Geometry.Vec2 position, double radius) {
        return Math.abs(position.x - center.x) <= radius && Math.abs(position.y - center.y) <= radius;
    }

    private static Protocol.PlayerPublic toPlayerPublic(PlayerEntity player) {
        return new Protocol.PlayerPublic(
                player.id,
                player.playerName,
                player.teamId,
                new Protocol.Vec(player.position.x, player.position.y),
                new Protocol.Vec(player.facingDirection.x, player.facingDirection.y),
                player.health,
                player.healthMax,
                player.isDead,
                player.isMoving,
                player.isSprinting,
                player.staminaMax <= 0 ? 0 : player.stamina / player.staminaMax,
                player.servantCount(),
                player.playerScore,
                player.gameLevel);
    }

    private static Protocol.PlayerPrivate toPlayerPrivate(PlayerEntity player) {
        return new Protocol.PlayerPrivate(
                player.id,
                player.playerScore,
                player.gameLevel,
                player.gameExp,
                player.expToNextLevel(),
                player.stamina,
                player.staminaMax,
                player.isSprinting,
                player.playerRule.fireCooldownNow,
                player.playerRule.fireCooldownMax,
                player.bulletCount,
                player.bulletMaxCount,
                toCooldownList(player.equippedSkillCooldowns),
                toInventoryDto(player.inventory),
                player.getAllServantIds(),
                toResearchList(player.research),
                new ArrayList<>(player.researchPendingOptions),
                player.deathRespawnDelay,
                player.deathRespawnRemaining,
                player.lastDamagerName == null ? "" : player.lastDamagerName,
                toDeathReport(player.lastDeathReport));
    }

    /** 玩家死亡明细 -> 协议 DTO(null 表示尚未死亡或已重生) */
    private static Protocol.DeathReportDto toDeathReport(PlayerEntity.DeathDrop report) {
        if (report == null) {
            return null;
        }
        List<Protocol.DeathItemDto> items = new ArrayList<>(report.items().size());
        for (PlayerEntity.ItemStack stack : report.items()) {
            items.add(new Protocol.DeathItemDto(stack.tag(), stack.name(), stack.count()));
        }
        List<Protocol.ResearchDowngradeDto> downgrades =
                new ArrayList<>(report.researchDowngrades().size());
        for (PlayerEntity.ResearchDowngrade downgrade : report.researchDowngrades()) {
            downgrades.add(new Protocol.ResearchDowngradeDto(
                    downgrade.tag(), downgrade.from(), downgrade.to()));
        }
        return new Protocol.DeathReportDto(
                report.droppedExp(),
                items,
                new ArrayList<>(report.skillTags()),
                downgrades);
    }

    /** 专研记录 -> 协议 DTO 列表 */
    private static List<Protocol.ResearchEntryDto> toResearchList(List<Research.State> states) {
        List<Protocol.ResearchEntryDto> list = new ArrayList<>(states.size());
        for (Research.State state : states) {
            list.add(new Protocol.ResearchEntryDto(state.tag, state.level, state.value));
        }
        return list;
    }

    /**
     * 技能剩余CD数组 -> 协议列表(量化到 2 位小数,避免下发无意义的长浮点串)
     */
    private static List<Double> toCooldownList(double[] values) {
        List<Double> list = new ArrayList<>(values.length);
        for (double value : values) {
            list.add(value <= 0 ? 0.0 : Math.round(value * 100) / 100.0);
        }
        return list;
    }

    /** 背包 -> 协议 DTO(保持与前端 InventoryEntry 结构一致,null 元素表示空格) */
    public static Protocol.InventoryDto toInventoryDto(Inventory.Bag bag) {
        List<Protocol.InventoryEntryDto> entries = new ArrayList<>(bag.entries.length);
        for (Inventory.Entry entry : bag.entries) {
            if (entry == null) {
                entries.add(null);
                continue;
            }
            entries.add(new Protocol.InventoryEntryDto(
                    entry.uid, entry.kind, entry.tag, entry.name, entry.count, entry.maxStack, entry.color));
        }
        List<String> equipped = new ArrayList<>(bag.equippedSkills.length);
        for (String tag : bag.equippedSkills) {
            equipped.add(tag);
        }
        return new Protocol.InventoryDto(entries, equipped);
    }
}
