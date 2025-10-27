// The relative position of this file: src/class/Tool.ts
export default class Tool {
    /**
     * 生成格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串
     * @param date 可选，Date对象，默认为当前时间
     * @returns 格式化的时间字符串
     */
    public static getFormatTime(date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const u = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        const c = String(date.getMilliseconds()).padStart(3, '0');
        
        return `${y}-${m}-${d} ${h}:${u}:${s}:${c}`;
    }

    /**
     * 获取当前时间戳（毫秒）
     * @returns 当前时间戳
     */
    public static getTimestamp(): number {
        return Date.now();
    }

    /**
     * 解析格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串为时间戳（毫秒）
     * @param timeString 时间字符串
     * @returns 时间戳（毫秒数），解析失败返回 NaN
     */
    public static formatTime2Timestamp(timeString: string): number {
        try {
            const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}):(\d{3})$/;
            const match = timeString.match(regex);
            if (!match) {
                throw new Error('Invalid time string format');
            }
            const [, y, m, d, h, u, s, c] = match;
            const date = new Date(
                parseInt(y),
                parseInt(m) - 1,
                parseInt(d),
                parseInt(h),
                parseInt(u),
                parseInt(s),
                parseInt(c)
            );
            return date.getTime();
        } catch (error) {
            console.error('Failed to parse time string:', error);
            return NaN;
        }
    }

    /**
     * 将时间戳转换为格式化的时间字符串
     * @param timestamp 时间戳（毫秒）
     * @returns 格式化的时间字符串
     */
    public static timestamp2FormatTime(timestamp: number): string {
        return Tool.getFormatTime(new Date(timestamp));
    }

    /**
     * 计算两个时间字符串之间的时间差（毫秒）
     * @param startTime 开始时间字符串
     * @param endTime 结束时间字符串，默认为当前时间
     * @returns 时间差（毫秒），计算失败返回 NaN
     */
    public static formatTimeMinusFormatTime(
        startTime: string, 
        endTime: string = Tool.getFormatTime()
    ): number {
        const startTimestamp = Tool.formatTime2Timestamp(startTime);
        const endTimestamp = Tool.formatTime2Timestamp(endTime);
        if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
            return NaN;
        }
        return endTimestamp - startTimestamp;
    }
}