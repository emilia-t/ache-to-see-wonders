package top.atsw.pixelwar.monitor;

import top.atsw.pixelwar.net.GameRoom;
import top.atsw.pixelwar.net.RoomManager;
import top.atsw.pixelwar.world.World;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.ThreadMXBean;
import java.util.Locale;

/**
 * 服务端健康检查:按固定周期把运行时指标输出到终端日志。
 *
 * <p>默认每 5 秒输出一轮,可通过 {@code pixel-war.health-report-interval-ms} 调整。
 * 每轮包含:</p>
 * <ul>
 *   <li><b>进程级</b>:运行时长、房间数与在线玩家数、堆/非堆内存、线程数、
 *       GC 次数与停顿时长(本周期增量)、进程与系统 CPU 负载、物理内存占用;</li>
 *   <li><b>房间级</b>:实际 tick 频率(与目标对比,用于判断是否积压)、<b>每帧平均耗时</b>、
 *       单帧最大耗时、P95 耗时、世界推进与快照下发的耗时拆分、超预算帧数、
 *       平均下行字节数,以及世界内的实体构成。</li>
 * </ul>
 *
 * <p>报告在 Spring 的调度线程上输出,独立于房间的 tick 线程,因此即使房间主循环被拖慢,
 * 也仍然能看到"tick 频率低于目标 + 每帧耗时升高"的组合信号。</p>
 */
@Component
public class HealthMonitor {

    private static final Logger log = LoggerFactory.getLogger(HealthMonitor.class);

    private static final double BYTES_PER_MB = 1024.0 * 1024.0;
    private static final double BYTES_PER_KB = 1024.0;
    private static final double BYTES_PER_GB = 1024.0 * 1024.0 * 1024.0;

    private final RoomManager roomManager;

    private final long startedAtNanos = System.nanoTime();
    private long lastReportAtMs = System.currentTimeMillis();
    private long lastGcCount;
    private long lastGcTimeMs;

    public HealthMonitor(RoomManager roomManager) {
        this.roomManager = roomManager;
    }

    /** 输出一轮健康检查(默认每 5 秒) */
    @Scheduled(fixedRateString = "${pixel-war.health-report-interval-ms:5000}")
    public void report() {
        long now = System.currentTimeMillis();
        double elapsedSeconds = Math.max(0.001, (now - lastReportAtMs) / 1000.0);
        lastReportAtMs = now;
        try {
            logProcess(elapsedSeconds);
            for (GameRoom room : roomManager.rooms()) {
                logRoom(room, elapsedSeconds, now);
            }
        } catch (Exception e) {
            log.warn("[health] 健康检查输出失败", e);
        }
    }

    // ==================================================================
    // 进程级指标
    // ==================================================================

    private void logProcess(double elapsedSeconds) {
        MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        MemoryUsage nonHeap = ManagementFactory.getMemoryMXBean().getNonHeapMemoryUsage();
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();

        long[] gc = gcTotals();
        long gcCountDelta = gc[0] - lastGcCount;
        long gcTimeDelta = gc[1] - lastGcTimeMs;
        lastGcCount = gc[0];
        lastGcTimeMs = gc[1];

        String cpu = "n/a";
        String physical = "n/a";
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        if (osBean instanceof com.sun.management.OperatingSystemMXBean sunOs) {
            cpu = String.format(Locale.ROOT, "进程 %.1f%% 系统 %.1f%%",
                    Math.max(0, sunOs.getProcessCpuLoad()) * 100,
                    Math.max(0, sunOs.getCpuLoad()) * 100);
            long total = sunOs.getTotalMemorySize();
            if (total > 0) {
                physical = String.format(Locale.ROOT, "%.1f/%.1fGB",
                        (total - sunOs.getFreeMemorySize()) / BYTES_PER_GB, total / BYTES_PER_GB);
            }
        }

        int totalPlayers = 0;
        int roomCount = 0;
        for (GameRoom room : roomManager.rooms()) {
            roomCount++;
            totalPlayers += room.playerCount();
        }

        log.info("[health] 运行 {} | 房间 {} 在线玩家 {} | 堆 {}{}MB"
                        + " 非堆 {}MB | 线程 {}/{} | GC +{}({}ms/{}s) | CPU {} | 物理内存 {}",
                formatUptime(), roomCount, totalPlayers,
                mb(heap.getUsed()), heap.getMax() > 0 ? "/" + mb(heap.getMax()) : "",
                mb(nonHeap.getUsed()),
                threadBean.getThreadCount(), threadBean.getPeakThreadCount(),
                gcCountDelta, gcTimeDelta, oneDecimal(elapsedSeconds),
                cpu, physical);
    }

    private long[] gcTotals() {
        long count = 0;
        long timeMs = 0;
        for (GarbageCollectorMXBean gcBean : ManagementFactory.getGarbageCollectorMXBeans()) {
            count += Math.max(0, gcBean.getCollectionCount());
            timeMs += Math.max(0, gcBean.getCollectionTime());
        }
        return new long[]{count, timeMs};
    }

    // ==================================================================
    // 房间级指标
    // ==================================================================

    private void logRoom(GameRoom room, double elapsedSeconds, long now) {
        TickStats.Sample sample = room.tickStats().drainAndReset();
        if (sample == null && room.playerCount() == 0) {
            return;// 空房间未运行主循环,不刷屏
        }

        int intervalMs = Math.max(1, room.tickIntervalMs());
        double targetHz = 1000.0 / intervalMs;
        String loop;
        if (sample == null) {
            loop = "主循环未运行";
        } else {
            loop = String.format(Locale.ROOT,
                    "tick %.1f/s(目标 %.1f) | 快照 %d 次/%.1fs | 每帧 平均 %.2fms 最大 %.2fms P95 %.2fms(世界 %.2f + 快照 %.2f)"
                            + " | 超预算帧 %d | 下行 %.1fKB/s(%.1fKB/次)",
                    sample.ticks() / elapsedSeconds, targetHz,
                    sample.snapshotSends(), elapsedSeconds,
                    sample.avgTickMs(), sample.maxTickMs(), sample.p95TickMs(),
                    sample.avgWorldMs(), sample.avgSnapshotMs(),
                    sample.overBudgetTicks(),
                    sample.downstreamBytes() / BYTES_PER_KB / elapsedSeconds,
                    sample.snapshotSends() == 0 ? 0.0
                            : sample.downstreamBytes() / BYTES_PER_KB / sample.snapshotSends());
        }

        World world = room.world();
        log.info("[health][room:{}] 玩家 {}/{} | {} | 实体 {} [玩家 {} NPC {} 子弹 {} 炸弹 {} 经验球 {} 技能球 {} 物品 {}] | 空闲 {}s",
                room.roomId(), room.playerCount(), room.maxPlayersPerRoom(), loop,
                world.entityCount(),
                world.players().size(), world.npcs().size(), world.bullets().size(),
                world.bombs().size(), world.expOrbs().size(), world.skillOrbs().size(), world.items().size(),
                Math.max(0, (now - room.lastActiveAt()) / 1000));
    }

    // ==================================================================
    // 格式化
    // ==================================================================

    private String formatUptime() {
        long totalSeconds = (System.nanoTime() - startedAtNanos) / 1_000_000_000L;
        return String.format(Locale.ROOT, "%dh%02dm%02ds",
                totalSeconds / 3600, (totalSeconds % 3600) / 60, totalSeconds % 60);
    }

    private static String mb(long bytes) {
        return String.format(Locale.ROOT, "%.1f", bytes / BYTES_PER_MB);
    }

    private static String oneDecimal(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }
}
