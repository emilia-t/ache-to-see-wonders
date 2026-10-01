package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;

/**
 * 友好 NPC「紫盾」(由前端 TS 版 PurpleShieldEntity 迁移)。
 *
 * <p>特性:</p>
 * <ul>
 *   <li>基础生命值 4 点;生成权重 0.08(测试期间可临时提高至 0.99)</li>
 *   <li>出生时身边环绕 4 个蓝色渐变透明的防护小方块(仅客户端视觉特效,不参与碰撞、无碰撞体积);
 *       每损失 1 点生命值减少 1 个,数量与当前剩余生命值一一对应
 *       —— 该方块由客户端按快照里的 health 绘制,服务端只负责生命值本身</li>
 *   <li>以螺旋轨迹向各个方向游走:每次需要新的游走目标时,改为取螺旋轨迹上的下一个路点</li>
 * </ul>
 */
public class PurpleShieldNpc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.08;

    /** 基础/最大生命值(= 出生时的防护小方块数量) */
    public static final double HEALTH_MAX = 4;

    /** 螺旋游走:相邻路点的角度增量(弧度) */
    private static final double SPIRAL_STEP_ANGLE = Math.PI * 0.25;
    /** 螺旋游走:路点半径每步的增量(px),使螺旋由内向外展开 */
    private static final double SPIRAL_RADIUS_GROWTH = 6;
    /** 螺旋游走:螺旋最小半径(px) */
    private static final double SPIRAL_MIN_RADIUS = 45;
    /** 螺旋游走:螺旋最大半径(px),达到后以当前位置重新展开 */
    private static final double SPIRAL_MAX_RADIUS = 230;

    /** 螺旋中心(世界坐标) */
    private Geometry.Vec2 spiralCenter;
    /** 螺旋当前角度(弧度) */
    private double spiralAngle;
    /** 螺旋当前半径(px) */
    private double spiralRadius;

    public PurpleShieldNpc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "PurpleShield", "friendly", 0, "purple_shield");
        this.fillColor = "#8a5cf6";
        this.strokeColor = "#c9b3ff";
        this.health = HEALTH_MAX;
        this.healthMax = HEALTH_MAX;
        this.killScore = 2;
        this.gameExp = 4;
        this.mapColor = "#8a5cf6";
        this.spiralCenter = position.copy();
        this.spiralAngle = Math.random() * Math.PI * 2;
        this.spiralRadius = SPIRAL_MIN_RADIUS;
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (ownerId != null) {
            followOwner(world);
            updateDamageEffect(dt);
            updateDeathEffect(dt);
            return;
        }
        super.update(dt, world, config);
    }

    /**
     * 螺旋游走:忽略外部下发的随机游走目标,改为取螺旋轨迹上的下一个路点。
     *
     * <p>服务端仍是"随机游走"的驱动方式,但目标点被替换成螺旋上的点,轨迹因此始终呈螺旋形。</p>
     */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        // 螺旋需要平滑曲线,统一按非"直线优先"处理
        if (super.setTarget(nextSpiralWaypoint(), world, false)) {
            return true;
        }
        // 路点被阻挡:以当前位置为螺旋中心重新展开,仍失败则退回常规游走目标
        restartSpiral();
        if (super.setTarget(nextSpiralWaypoint(), world, false)) {
            return true;
        }
        return super.setTarget(target, world, preferStraight);
    }

    /** 螺旋游走:到点后不驻足,立即继续沿螺旋前进,保证轨迹连续 */
    @Override
    public void updateStayDuration(double dt) {
        super.updateStayDuration(dt);
        if (!isDead && !isMoving) {
            stayDurationRemaining = 0;
        }
    }

    /** 无任何攻击行为 */
    @Override
    public void actionLoop(ActionContext context) {
        // 友好 NPC 不攻击
    }

    /** 计算螺旋轨迹上的下一个路点(由内向外逐圈展开) */
    private Geometry.Vec2 nextSpiralWaypoint() {
        this.spiralAngle += SPIRAL_STEP_ANGLE;
        this.spiralRadius += SPIRAL_RADIUS_GROWTH;
        // 展开到最大半径后,以当前位置为新中心重新由内向外展开(轨迹保持连续)
        if (this.spiralRadius >= SPIRAL_MAX_RADIUS) {
            restartSpiral();
        }
        return new Geometry.Vec2(
                spiralCenter.x + Math.cos(spiralAngle) * spiralRadius,
                spiralCenter.y + Math.sin(spiralAngle) * spiralRadius);
    }

    /** 以当前位置为螺旋中心,重新开始一圈螺旋 */
    private void restartSpiral() {
        this.spiralCenter = position.copy();
        this.spiralAngle += SPIRAL_STEP_ANGLE;
        this.spiralRadius = SPIRAL_MIN_RADIUS;
    }
}
