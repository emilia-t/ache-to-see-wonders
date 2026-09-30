package top.atsw.pixelwar.monitor;

import java.util.Arrays;

/**
 * 房间主循环的耗时统计累加器。
 *
 * <p>写入方是房间的 tick 线程(每帧一次),读取方是健康检查调度线程(默认每 5 秒一次),
 * 因此所有方法都做同步;两侧频率相差三个数量级,锁竞争可以忽略。</p>
 *
 * <p>{@link #drainAndReset()} 会取出并清空自上次调用以来的统计,所以上报的是
 * "最近一个上报周期内"的数据,而不是进程启动至今的累计值。</p>
 */
public final class TickStats {

    /** 保留的最近样本数,用于计算最大值与 P95(50Hz 下 2048 帧 ≈ 41 秒) */
    private static final int SAMPLE_CAPACITY = 2048;

    private final long[] tickSamplesNs = new long[SAMPLE_CAPACITY];
    private final long[] worldSamplesNs = new long[SAMPLE_CAPACITY];
    private final long[] snapshotSamplesNs = new long[SAMPLE_CAPACITY];

    private int sampleCount;
    private int sampleCursor;

    private long ticks;
    private long totalTickNs;
    private long maxTickNs;
    private long overBudgetTicks;
    private long downstreamBytes;
    private long snapshotSends;

    /**
     * 记录一帧。
     *
     * @param tickNs       本帧总耗时(世界推进 + 快照构建下发)
     * @param worldNs      本帧世界推进耗时
     * @param snapshotNs   本帧快照构建与下发耗时(未下发快照的帧为 0)
     * @param frameBytes   本帧向所有会话下发的字节数
     * @param budgetNs     单帧预算(tick 间隔);超过即计入"超预算帧"
     * @param snapshotSent 本帧是否真的下发了快照(快照降频时并非每帧都发)
     */
    public synchronized void record(long tickNs, long worldNs, long snapshotNs, long frameBytes,
                                   long budgetNs, boolean snapshotSent) {
        ticks++;
        totalTickNs += tickNs;
        downstreamBytes += frameBytes;
        if (snapshotSent) {
            snapshotSends++;
        }
        if (tickNs > maxTickNs) {
            maxTickNs = tickNs;
        }
        if (budgetNs > 0 && tickNs > budgetNs) {
            overBudgetTicks++;
        }
        tickSamplesNs[sampleCursor] = tickNs;
        worldSamplesNs[sampleCursor] = worldNs;
        snapshotSamplesNs[sampleCursor] = snapshotNs;
        sampleCursor = (sampleCursor + 1) % SAMPLE_CAPACITY;
        if (sampleCount < SAMPLE_CAPACITY) {
            sampleCount++;
        }
    }

    /** 取出并清空本周期统计;周期内一帧都没有执行时返回 null */
    public synchronized Sample drainAndReset() {
        if (ticks == 0) {
            return null;
        }
        long[] sortedTickNs = Arrays.copyOf(tickSamplesNs, sampleCount);
        Arrays.sort(sortedTickNs);

        Sample sample = new Sample(
                ticks,
                totalTickNs / 1_000_000.0 / ticks,
                maxTickNs / 1_000_000.0,
                percentileMs(sortedTickNs, 0.95),
                averageMs(worldSamplesNs, sampleCount),
                averageMs(snapshotSamplesNs, sampleCount),
                downstreamBytes,
                snapshotSends,
                overBudgetTicks);

        ticks = 0;
        totalTickNs = 0;
        maxTickNs = 0;
        overBudgetTicks = 0;
        downstreamBytes = 0;
        snapshotSends = 0;
        sampleCount = 0;
        sampleCursor = 0;
        return sample;
    }

    private static double averageMs(long[] samples, int count) {
        if (count <= 0) {
            return 0;
        }
        long sum = 0;
        for (int i = 0; i < count; i++) {
            sum += samples[i];
        }
        return sum / 1_000_000.0 / count;
    }

    private static double percentileMs(long[] sortedSamplesNs, double ratio) {
        if (sortedSamplesNs.length == 0) {
            return 0;
        }
        int index = (int) Math.round(ratio * (sortedSamplesNs.length - 1));
        int clamped = Math.max(0, Math.min(sortedSamplesNs.length - 1, index));
        return sortedSamplesNs[clamped] / 1_000_000.0;
    }

    /**
     * 一个上报周期内的主循环统计。耗时单位均为毫秒。
     *
     * @param ticks            周期内实际执行的帧数
     * @param avgTickMs        每帧平均耗时(核心指标)
     * @param maxTickMs        单帧最大耗时
     * @param p95TickMs        单帧耗时 P95
     * @param avgWorldMs       每帧世界推进平均耗时
     * @param avgSnapshotMs    每帧快照构建与下发平均耗时(含未下发快照的廉价帧,故低于实际快照帧开销)
     * @param downstreamBytes  周期内下行总字节数
     * @param snapshotSends    周期内实际下发的快照次数(快照降频时 < ticks)
     * @param overBudgetTicks  耗时超过单帧预算的帧数(掉帧/积压信号)
     */
    public record Sample(long ticks,
                         double avgTickMs,
                         double maxTickMs,
                         double p95TickMs,
                         double avgWorldMs,
                         double avgSnapshotMs,
                         long downstreamBytes,
                         long snapshotSends,
                         long overBudgetTicks) {
    }
}
