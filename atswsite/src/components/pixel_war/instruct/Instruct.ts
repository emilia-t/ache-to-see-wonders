import type { MapData, InstructObject, Point, PlayerInventory } from '@/components/pixel_war/interface/Interface';

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
        W: boolean;
        A: boolean;
        S: boolean;
        D: boolean;
        Shift: boolean;
    },playerId: number): InstructObject => {
        return {
            type: 'player_move_input',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data:{ moveState , playerId }
        };
    }

    /**
     * 创建玩家射击输入指令
     * @param target
     * @returns
     */
    public static I_PlayerFireInput = (target: Point, playerId: number): InstructObject => {
        return {
            type: 'player_fire_input',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { target, playerId }
        };
    }

    
    /**
     * 玩家闪避指令
     * angle: 闪避角度-单位为弧度
     * playerId: 玩家ID
     * @returns InstructObject
     */
    public static I_PlayerDodgeInput = (direction: Point, playerId: number): InstructObject => {
        return {
            type: 'player_dodge_input',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { direction, playerId }
        };
    };

    public static I_PlayerRespawn = (playerId: number): InstructObject => {
        return {
            type: 'player_respawn',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { playerId }
        };
    };

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
     * 背包状态同步指令
     * 客户端在装配技能、调整顺序、卸下或销毁条目后提交最新的背包状态,
     * 服务端以此为准更新玩家背包(技能释放依赖装配区数据)。
     * @param playerId 玩家ID
     * @param inventory 客户端提交的完整背包状态
     */
    public static I_InventoryUpdate = (playerId: number, inventory: PlayerInventory): InstructObject => {
        return {
            type: 'inventory_update',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { playerId, inventory }
        };
    };

    /**
     * 使用背包物品指令
     * @param playerId 玩家ID
     * @param uid 背包条目的唯一id
     */
    public static I_InventoryUseItem = (playerId: number, uid: string): InstructObject => {
        return {
            type: 'inventory_use_item',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { playerId, uid }
        };
    };

    /**
     * 丢弃背包条目指令(拖拽至背包外)
     *
     * 客户端已在本地背包中移除该条目并另行提交 inventory_update,本指令只负责让权威端
     * 在指定方向上抛出地面实体(物品落成地面物品、技能落成技能球)。
     *
     * @param playerId 玩家ID
     * @param drop 丢弃内容与抛出参数(direction 为单位方向,distance 为抛出距离 px)
     */
    public static I_InventoryDrop = (playerId: number, drop: {
        kind: 'item' | 'skill';
        tag: string;
        name: string;
        color: string;
        count: number;
        direction: Point;
        distance: number;
    }): InstructObject => {
        return {
            type: 'inventory_drop',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { playerId, ...drop }
        };
    };

    /**
     * 专研选择指令
     * 玩家在专研界面中选定一项研究后提交,由权威端结算研究等级与效果。
     * @param playerId 玩家ID
     * @param tag 选中的研究项标签
     */
    public static I_ResearchChoose = (playerId: number, tag: string): InstructObject => {
        return {
            type: 'research_choose',
            class: '',
            conveyor: 'client',
            time: this.H_getFormatTime(),
            data: { playerId, tag }
        };
    };

/**
 * 
 */
    ////////////////////
    //<--指令创建区(I_前缀)
    ////////////////////
}
