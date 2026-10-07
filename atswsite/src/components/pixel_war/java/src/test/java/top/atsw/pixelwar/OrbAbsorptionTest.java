package top.atsw.pixelwar;

import org.junit.jupiter.api.Test;
import top.atsw.pixelwar.config.PixelWarProperties;
import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.dynamicEntity.BulletOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.ExpOrbEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.dynamicEntity.SkillOrbEntity;
import top.atsw.pixelwar.entity.itemEntity.ItemEntity;
import top.atsw.pixelwar.game.Inventory;
import top.atsw.pixelwar.registry.SkillRegistry;
import top.atsw.pixelwar.world.World;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 掉落物 Orb「玩家侧主动吸取」规则的确定性验证。
 *
 * <p>背景:Orb 原先自己寻找玩家(每帧找最近的玩家飘行),导致"玩家子弹已满时
 * 子弹球仍不断飞向玩家、因装不下而反复绕着玩家弹跳"。改造后 Orb 只做"存在时长 + 惯性滑行",
 * 由玩家侧主动搜索并吸取({@code World.updatePickups})。</p>
 */
class OrbAbsorptionTest {

    private static World newWorld() {
        GameConfig config = new GameConfig(new PixelWarProperties(0, 0, 0, 0, 0, null, null, null));
        return new World(config, new SkillRegistry(), 20261006L);
    }

    private static double distance(PlayerEntity player, DynamicEntity entity) {
        return Geometry.distance(player.position.x, player.position.y, entity.position.x, entity.position.y);
    }

    /** 用例 1:玩家子弹已满时,子弹球既不被牵引、也不被吸收(修复"绕着满子弹玩家弹跳") */
    @Test
    void bulletOrbIsNotAttractedWhenPlayerAmmoIsFull() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "FullAmmo");
        world.players().add(player);
        player.bulletCount = player.bulletMaxCount;// 子弹已满 → 容量 0

        BulletOrbEntity orb = new BulletOrbEntity(new Geometry.Vec2(150, 0), 1);
        world.bulletOrbs().add(orb);

        double before = distance(player, orb);
        for (int i = 0; i < 50; i++) {// 1 秒 = 50 tick
            world.tick(0.02);
        }

        assertTrue(world.bulletOrbs().contains(orb), "满子弹时子弹球不应被吸收");
        assertEquals(1, orb.value, "满子弹时子弹球的数量不应变化");
        assertEquals(before, distance(player, orb), 0.001, "满子弹时子弹球不应被牵引(距离必须完全不变)");
        assertEquals(player.bulletMaxCount, player.bulletCount);
    }

    /** 用例 2:玩家有容量时,子弹球被牵引并在进入拾取范围后被吸收,弹药 +1 */
    @Test
    void bulletOrbIsAttractedAndAbsorbedWhenPlayerHasCapacity() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "OneShotMissing");
        world.players().add(player);
        player.bulletCount = player.bulletMaxCount - 1;// 容量 1

        BulletOrbEntity orb = new BulletOrbEntity(new Geometry.Vec2(150, 0), 1);
        world.bulletOrbs().add(orb);

        for (int i = 0; i < 100 && world.bulletOrbs().contains(orb); i++) {// 最多 2 秒
            world.tick(0.02);
        }

        assertFalse(world.bulletOrbs().contains(orb), "有容量时子弹球应被玩家吸走");
        assertEquals(player.bulletMaxCount, player.bulletCount, "吸收后弹药应补满");
    }

    /** 用例 3:容量不足时只吸收一部分,剩余的子弹球留在原地 */
    @Test
    void bulletOrbIsPartiallyAbsorbedWhenCapacityIsInsufficient() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "Partial");
        world.players().add(player);
        player.bulletCount = player.bulletMaxCount - 1;// 容量 1

        BulletOrbEntity orb = new BulletOrbEntity(new Geometry.Vec2(150, 0), 3);// 球内有 3 发
        world.bulletOrbs().add(orb);

        for (int i = 0; i < 100 && orb.value > 2; i++) {// 最多 2 秒
            world.tick(0.02);
        }

        assertTrue(world.bulletOrbs().contains(orb), "装不下的部分应留在原地");
        assertEquals(2, orb.value, "只应吸收容量允许的 1 发");
        assertEquals(player.bulletMaxCount, player.bulletCount);
    }

    /** 用例 4:经验球由玩家侧主动吸取(经验值增加且球被移除) */
    @Test
    void expOrbIsAbsorbedByPlayer() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "ExpTaker");
        world.players().add(player);

        ExpOrbEntity orb = new ExpOrbEntity(new Geometry.Vec2(120, 0), 1);
        world.expOrbs().add(orb);

        for (int i = 0; i < 100 && world.expOrbs().contains(orb); i++) {
            world.tick(0.02);
        }

        assertFalse(world.expOrbs().contains(orb), "经验球应被玩家吸走");
        assertTrue(player.gameLevel >= 1 || player.gameExp >= 1, "经验应计入玩家");
    }

    /** 用例 5:技能球由玩家侧主动吸取(技能进入玩家背包且球被移除) */
    @Test
    void skillOrbIsAbsorbedByPlayer() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "SkillTaker");
        world.players().add(player);

        SkillOrbEntity orb = new SkillOrbEntity(new Geometry.Vec2(60, 0), "va2_shoot_skill", new SkillRegistry());
        world.skillOrbs().add(orb);

        for (int i = 0; i < 100 && world.skillOrbs().contains(orb); i++) {
            world.tick(0.02);
        }

        assertFalse(world.skillOrbs().contains(orb), "技能球应被玩家吸走");
        boolean gotSkill = false;
        for (Inventory.Entry entry : player.inventory.entries) {
            if (entry != null && "va2_shoot_skill".equals(entry.tag)) {
                gotSkill = true;
                break;
            }
        }
        // 拾取后会被自动装配到空槽,因此也要检查装配区
        if (!gotSkill) {
            for (String tag : player.inventory.equippedSkills) {
                if ("va2_shoot_skill".equals(tag)) {
                    gotSkill = true;
                    break;
                }
            }
        }
        assertTrue(gotSkill, "技能应进入玩家背包/装配区");
    }

    /** 用例 6:Orb 不再自行寻找玩家 —— 超出玩家吸取范围时不会主动靠近 */
    @Test
    void orbDoesNotChasePlayerByItself() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "FarPlayer");
        world.players().add(player);
        player.bulletCount = player.bulletMaxCount - 5;// 明明是"可以吸收"的状态

        BulletOrbEntity orb = new BulletOrbEntity(new Geometry.Vec2(600, 0), 1);// 600px,超出吸取范围
        world.bulletOrbs().add(orb);

        double before = distance(player, orb);
        for (int i = 0; i < 50; i++) {
            world.tick(0.02);
        }

        assertTrue(world.bulletOrbs().contains(orb));
        assertEquals(before, distance(player, orb), 0.001, "Orb 不应自行飘向玩家(只能由玩家侧牵引)");
    }
    /** 用例 7:地面物品也走统一拾取管线(③)—— 接触即拾取,背包收到该物品 */
    @Test
    void itemIsPickedUpThroughUnifiedPipeline() {
        World world = newWorld();
        PlayerEntity player = new PlayerEntity(new Geometry.Vec2(0, 0), null, "ItemTaker");
        world.players().add(player);

        // 接触半径 = (player.width + item.width) / 2,放在 10px 处必定进入接触半径
        ItemEntity item = new ItemEntity(new Geometry.Vec2(10, 0), "healing_gem", "治疗宝石", 1);
        world.items().add(item);

        for (int i = 0; i < 20; i++) {
            world.tick(0.02);
        }

        assertEquals(0, item.count, "物品应被吸收(count 归零)");
        boolean got = false;
        for (Inventory.Entry entry : player.inventory.entries) {
            if (entry != null && "healing_gem".equals(entry.tag)) {
                got = true;
                break;
            }
        }
        assertTrue(got, "拾取后背包应出现该物品");
    }

    /** 用例 8:多人抢夺同一 Orb 时由「最近的合格玩家」获得(② 公平性,与数组顺序无关) */
    @Test
    void nearestEligiblePlayerWinsContestedOrb() {
        World world = newWorld();
        // 故意把"较远"的玩家放在数组前面:若按遍历顺序决定归属,较远者会赢
        PlayerEntity far = new PlayerEntity(new Geometry.Vec2(160, 0), null, "Far");
        PlayerEntity near = new PlayerEntity(new Geometry.Vec2(40, 0), null, "Near");
        world.players().add(far);
        world.players().add(near);

        double nearExpBefore = near.gameExp;
        int nearLevelBefore = near.gameLevel;
        double farExpBefore = far.gameExp;
        int farLevelBefore = far.gameLevel;

        ExpOrbEntity orb = new ExpOrbEntity(new Geometry.Vec2(0, 0), 1);
        world.expOrbs().add(orb);

        for (int i = 0; i < 100 && world.expOrbs().contains(orb); i++) {
            world.tick(0.02);
        }

        assertFalse(world.expOrbs().contains(orb), "经验球应被最近的玩家吸走");
        assertTrue(near.gameExp + near.gameLevel * 1000 > nearExpBefore + nearLevelBefore * 1000,
                "经验应归属最近的玩家");
        assertEquals(farExpBefore, far.gameExp, 0.0001, "较远的玩家不应获得经验");
        assertEquals(farLevelBefore, far.gameLevel, "较远的玩家不应升级");
    }}
