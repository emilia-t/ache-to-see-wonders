import type { MapData, InstructObject, Point } from '@/components/pixel_war/interface/Interface';

export class Instruct {
    ////////////////////
    //辅助函数区(H_前缀)-->
    ////////////////////
    /**
     * 获取当前时间戳（毫秒）
     * @returns 当前时间戳
     */
    public static H_getTimestamp = () => {
        return Date.now();
    };
    
    /**
     * 生成格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串
     * @param date 可选，Date对象，默认为当前时间
     * @returns 格式化的时间字符串
     */
    public static H_getFormatTime = (date: Date = new Date()): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const u = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        const c = String(date.getMilliseconds()).padStart(3, '0');
        return `${y}-${m}-${d} ${h}:${u}:${s}:${c}`;
    };
    /**
     * 解析格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串为时间戳（毫秒）
     * @param timeString 时间字符串
     * @returns 时间戳（毫秒数），解析失败返回 NaN
     */
    public static H_formatTime2Timestamp = (timeString: string): number => {
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
    public static H_timestamp2FormatTime = (timestamp: number): string => {
        return this.H_getFormatTime(new Date(timestamp));
    };
    ////////////////////
    //<--辅助函数区(H_前缀)
    ////////////////////


    ////////////////////
    //指令创建区(I_前缀)-->
    ////////////////////
    /**
     * 创建测试指令
     * @param message 
     * @returns 
     */
    public static I_Test = (message: string):InstructObject => {
        return {
            type: 'test',
            class: '',
            conveyor: 'server',
            time: this.H_getFormatTime(),
            data: message
        };
    }
    /**
     * 创建地图数据初始化指令
     * @param mapData 
     * @returns 
     */
    public static I_MapDataInitial = (mapData: MapData):InstructObject => {
        return {
            type: 'map_data_initial',
            class: '',
            conveyor: 'server',
            time: this.H_getFormatTime(),
            data: mapData
        };
    }

    /**
     * 创建地图数据更新指令
     * @param mapData
     * @returns
     */
    public static I_MapDataUpdate = (mapData: MapData): InstructObject => {
        return {
            type: 'map_data_update',
            class: '',
            conveyor: 'server',
            time: this.H_getFormatTime(),
            data: mapData
        };
    }

    /**
     * 创建动态地图更新指令
     * @param dynamicItemMapData 
     * @returns 
     */
    public static I_MapDataDynamicItemUpdate(dynamicItemMapData: MapData): InstructObject {
        return {
            type: 'map_data_dynamic_item_update',
            class: '',
            conveyor: 'server',
            time: this.H_getFormatTime(),
            data: dynamicItemMapData
        };
    }

    /**
     * 创建玩家移动输入指令
     * @param moveState
     * @returns
     */
    public static I_PlayerMoveInput = (moveState: {
        playerMoveW: boolean;
        playerMoveA: boolean;
        playerMoveS: boolean;
        playerMoveD: boolean;
    }): InstructObject => {
        return {
            type: 'player_move_input',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: moveState
        };
    }

    /**
     * 创建玩家射击输入指令
     * @param target
     * @returns
     */
    public static I_PlayerFireInput = (target: Point): InstructObject => {
        return {
            type: 'player_fire_input',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: target
        };
    }


    /*
     *tick 暂停的指令
     */
    public static I_TickPause = (paused?: boolean): InstructObject => {
        return {
            type: 'tick_pause',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { paused } // 携带暂停标志，若不传则服务端自行切换
        };
    };
/**
 * 
 */
    ////////////////////
    //<--指令创建区(I_前缀)
    ////////////////////
}
