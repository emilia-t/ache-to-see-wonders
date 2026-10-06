package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.game.Va2ShootSkill;

/**
 * 白像素变种体 va2(由前端 TS 版 WhitePixelVa2Entity 迁移)。
 *
 * <p>以自身水平移动方向为中心,向上下各偏转 45° 射出两发子弹;
 * 无主时只能水平单向移动,永不停止、不转向;击杀后 40% 概率掉落"斜向双弹"技能球。</p>
 */
public class WhitePixelVa2Npc extends WhitePixelNpc {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.4;
    /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
    public static final String NAME = "斜射白色像素";
    /** 掉落技能球的概率 */
    public static final double LOOT_ODDS = 0.4;

    /** 锁定的水平移动方向:1 = 向右,-1 = 向左 */
    private int moveDirectionX;

    public WhitePixelVa2Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId);
        this.tag = "white_pixel_va2";
        this.moveDirectionX = Math.random() < 0.5 ? -1 : 1;
        this.stayDurationRemaining = 0;
        this.isMoving = true;
        this.killScore = 2;
        this.mapColor = "#dfdfdf";
        // 战利品:击杀后 40% 概率掉落其持有的"斜向双弹"技能球
        this.loot.add(new Loot("skillOrb", Va2ShootSkill.TAG, LOOT_ODDS));
        // 子弹球:会发射普通子弹的 NPC 均有概率掉落(概率 75%)
        this.loot.add(new Loot("bulletOrb", "bullet_orb", 0.75));
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public String displayName() {
        return NAME;
    }

    /** 等级变化时重算等级相关属性(va2 的经验值公式与白像素不同:2 + Level × 3) */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = 2 + level * 3;
    }

    /** 向水平移动方向上下 45° 各射出一颗子弹 */
    @Override
    public void action(ActionContext context) {
        if (isDead || context.spawnBullet == null) {
            return;
        }
        double baseX = moveDirectionX;
        double baseY = 0;
        double angle45 = Math.PI / 4;
        Geometry.Vec2 dir1 = rotate(baseX, baseY, angle45);
        Geometry.Vec2 dir2 = rotate(baseX, baseY, -angle45);

        double spawnDistance = width * 0.6;
        String bulletColor = bulletColorOf(context);
        shoot(context, dir1, spawnDistance, bulletColor);
        if (!isDead) {
            shoot(context, dir2, spawnDistance, bulletColor);
        }
    }

    private void shoot(ActionContext context, Geometry.Vec2 direction, double spawnDistance, String bulletColor) {
        context.spawnBullet.accept(new BulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                "",
                bulletColor,
                getBulletMoveSpeed()));
    }

    private static Geometry.Vec2 rotate(double x, double y, double radians) {
        double cos = Math.cos(radians);
        double sin = Math.sin(radians);
        return new Geometry.Vec2(x * cos - y * sin, x * sin + y * cos);
    }

    /** 有主时跟随主人;无主时水平单向移动(撞墙则反向) */
    @Override
    public void update(double dt, WorldView world, top.atsw.pixelwar.core.GameConfig config) {
        if (ownerId != null) {
            followOwner(world);
            updateDamageEffect(dt);
            updateDeathEffect(dt);
            return;
        }

        Geometry.Vec2 nextPos = new Geometry.Vec2(position.x + moveDirectionX * speed * dt, position.y);
        if (isBlockedByStatic(nextPos, world)) {
            // 撞到静态实体:反向并保持贴墙移动,避免卡死
            moveDirectionX = -moveDirectionX;
        } else {
            position.set(nextPos);
            updateCollisionBox();
        }
        facingDirection = new Geometry.Vec2(moveDirectionX, 0);
        lastMoveDirection = facingDirection.copy();
        isMoving = true;
        stayDurationRemaining = 0;
        nextTarget = position.copy();
    }

    /**
     * 变种体不允许修改移动目标,始终按初始锁定的水平方向移动(对齐 TS 版 WhitePixelVa2Entity.setTarget)。
     *
     * <p>父类 WhitePixelNpc 的正交随机游走会重写 setTarget,这里必须拦截,
     * 否则生成时的 setTarget 调用会重新生成目标并重算速度,破坏水平单向移动。</p>
     */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        return false;
    }

    /** 禁用 Wander 机制,避免外部重新分配随机目标干扰水平移动(对齐 TS 版) */
    @Override
    public boolean canGetNewWanderTarget(double dt, WorldView world) {
        return false;
    }

    private boolean isBlockedByStatic(Geometry.Vec2 newPos, WorldView world) {
        double halfW = width / 2;
        double halfH = height / 2;
        double minX = newPos.x - halfW;
        double maxX = newPos.x + halfW;
        double minY = newPos.y - halfH;
        double maxY = newPos.y + halfH;
        for (var staticEntity : world.staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            var box = staticEntity.collisionBox;
            boolean separated = maxX <= box.x || minX >= box.maxX() || maxY <= box.y || minY >= box.maxY();
            if (!separated) {
                return true;
            }
        }
        return false;
    }
}
