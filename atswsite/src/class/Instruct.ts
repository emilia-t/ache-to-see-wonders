// The relative position of this file: src/class/Instruct.ts
// This is the basic class of Instruct class
import type ServerConfig from "@/interface/ServerConfig";
import type InstructObject from "@/interface/InstructObject";
import type LogConfig from "@/interface/LogConfig";
import type UserData from "@/interface/UserData";
import Tool from "./Tool";

export default abstract class Instruct {
    private url: string;
    private socket: WebSocket | null = null;
    private isLink: boolean = false;
    private isLogin: boolean = false;
    private lastPong: number = 0;
    private lastPing: number = 0;
    private pingInterval: number | null = null;
    private publicKey: string = '';//服务端的公钥 用于部分加密操作
    private serverConfig: ServerConfig | null = null;
    private userData: UserData | null = null;
    /*
     * 构造器
     */
    constructor(url: string) {
        this.url = url;
        this.socket = new WebSocket(this.url);
        this.socket.onmessage = (ev) => this.onMessageHandler(ev);
        this.socket.onopen = (ev) => this.onOpenHandler(ev);
        this.socket.onclose = (ev) => this.onCloseHandler(ev);
        this.socket.onerror = (ev) => this.onErrorHandler(ev);
    }
    // ==============================
    // 事件处理
    // ==============================
    public onLog: (message: string, type: 'tip' | 'warn' | 'error', data?: any) => LogConfig = () => {return {code: 0,time: '',text: '',from: 'Instruct',type: '',data: {}}};
    public onOpen: (ev: Event) => void = () => {};// 外部可以重写这些方法以自定义处理事件
    public onClose: (ev: Event) => void = () => {};
    public onError: (ev: Event) => void = () => {};
    public onMessage: (instructObj: InstructObject) => void = () => {};
    /**
     * 指令的具体处理
     * @param ev 
     * @returns void
     */
    private onMessageHandler(ev: MessageEvent): void {
        let instructObj: InstructObject | null = this.instructParse(ev.data);
        if (instructObj === null) {
            this.onLog('无法解析指令', 'error', ev.data);
            return;
        }
        switch (instructObj.type) {
            case 'broadcast':
                this.handleBroadcastInstruct(instructObj);
                break;
            case 'pong':
                this.handlePong(instructObj);
                break;
            case 'login':
                this.handleLogin(instructObj);
                break;
            case 'publickey':
                this.handlePublickey(instructObj);
                break;
            case 'anonymous_login':
                this.handleAnonymousLogin(instructObj);
                break;
            case 'server_config':
                this.handleServerConfig(instructObj);
                break;
            case 'user_data':
                this.handleUserData(instructObj);
                break;
            default:
                this.handleExpandInstruct(instructObj);
        }
        this.onMessage(instructObj);
    }
    private onOpenHandler(ev: Event): void {
        this.isLink = true;
        this.onLog('服务器连接成功', 'tip');
        this.onOpen(ev);
    }
    private onCloseHandler(ev: CloseEvent): void {
        this.isLink = false;
        this.isLogin = false;
        this.pingIntervalStop();
        this.onLog('服务器连接中断', 'warn');
        this.onClose(ev);
    }
    private onErrorHandler(ev: Event): void {
        this.isLink = false;
        this.isLogin = false;
        this.pingIntervalStart();
        this.onLog('服务器连接失败', 'warn');
        this.onError(ev);
    }
    
    // ==============================
    // 处理指令的方法
    // ==============================
    abstract handleBroadcastInstruct (instruct: InstructObject) : void;// 子类必须实现这个方法以处理广播指令
    abstract handleExpandInstruct (instruct: InstructObject) : void;// 子类必须实现这个方法以处理扩展指令
    public handlePong (instruct: InstructObject) : void {
        const time = Tool.formatTime2Timestamp(instruct.time);
        if(!Number.isNaN(time)){
            this.lastPong = time;
        }
    }
    public handleLogin (instruct: InstructObject) : void {
        instruct.data === 'ok' ? this.setterIsLogin(true) : this.setterIsLogin(false);
    }
    public handlePublickey (instruct: InstructObject) : void {
        if (typeof instruct.data === 'string' && instruct.data.trim() !== '') {
            this.publicKey = instruct.data;
        }
    }
    public handleAnonymousLogin (instruct: InstructObject) : void {
        instruct.data === 'ok' ? this.setterIsLogin(true) : this.setterIsLogin(false);
    }
    public handleServerConfig (instruct: InstructObject) : void {
        if (typeof instruct.data === 'object' && instruct.data !== null) {
            this.serverConfig = instruct.data as ServerConfig;
        }
    }
    public handleUserData (instruct: InstructObject) : void {
        if (typeof instruct.data === 'object' && instruct.data !== null) {
            this.userData = instruct.data as UserData;
        }
    }
    /**
     * 指令初始解析
     * @param data 
     * @returns InstructObject
     */
    public instructParse(data: string): InstructObject | null {
        if (typeof data !== 'string' || data.trim() === '') {
            this.onLog('指令数据为空或不是字符串', 'error', data);
            return null;
        }
        try {
            const parsed = JSON.parse(data);
            if (this.isValidInstructObject(parsed)) {
                return parsed;
            } else {
                this.onLog('指令格式验证失败', 'error', {
                    received: parsed,
                    expected: 'InstructObject format'
                });
                return null;
            }
        } catch (error) {
            this.onLog('JSON解析失败', 'error', {
                data: data,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    // ==============================
    // 发送指令的方法
    // ==============================
    public send(instruct: InstructObject): boolean {
        if (!this.isLink || !this.socket) {
            this.onLog('连接未建立，无法发送指令', 'warn');
            return false;
        }
        try {
            const data = JSON.stringify(instruct);
            this.socket.send(data);
            return true;
        } catch (error) {
            this.onLog('发送指令失败', 'error', error);
            return false;
        }
    }
    public ping(): void {
        this.send(Instruct._ping_());
    }

    public getPublickey(): void {
        this.send(Instruct._getPublickey_());
    }

    public getServerConfig(): void {
        this.send(Instruct._getServerConfig_());
    }

    public getLogin(email: string, password: string): void {
        this.send(Instruct._getLogin_(email, password));
    }

    public getAnonymousLogin(email: string): void {
        this.send(Instruct._getAnonymousLogin_(email));
    }

    public getUserData(): void {
        this.send(Instruct._getUserData_());
    }

    // ==============================
    // 创建指令对象的静态方法
    // ==============================
    public static _ping_(): InstructObject {
        return {
            type: 'ping',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: ''
        };
    }
    public static _pong_(): InstructObject {
        return {
            type: 'pong',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: ''
        };
    }
    public static _getPublickey_(): InstructObject {
        return {
            type: 'get_publickey',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: ''
        };
    }
    public static _publickey_(publicKey: string): InstructObject {
        return {
            type: 'publickey',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: publicKey
        };
    }
    public static _getLogin_(email: string, password: string): InstructObject {
        return {
            type: 'get_login',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: {
                email: email,
                password: password
            }
        };
    }
    public static _login_(status: 'ok' | 'no'): InstructObject {
        return {
            type: 'login',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: status
        };
    }
    public static _getAnonymousLogin_(email: string): InstructObject {
        return {
            type: 'get_anonymous_login',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: {
                email: email
            }
        };
    }
    public static _anonymousLogin_(status: 'ok' | 'no'): InstructObject {
        return {
            type: 'anonymous_login',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: status
        };
    }
    public static _getServerConfig_(): InstructObject {
        return {
            type: 'get_server_config',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: ''
        };
    }
    public static _serverConfig_(config: ServerConfig): InstructObject {
        return {
            type: 'server_config',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: config
        };
    }
    public static _getUserData_(): InstructObject {
        return {
            type: 'get_user_data',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: ''
        };
    }
    public static _userData_(userData: UserData): InstructObject {
        return {
            type: 'user_data',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: userData
        };
    }

    // ==============================
    // getters and setters
    // ==============================
    public getterIsLink(): boolean {
        return this.isLink;
    }

    public getterIsLogin(): boolean {
        return this.isLogin;
    }

    public getterLastPing(): number {
        return this.lastPing;
    }

    public getterLastPong(): number {
        return this.lastPong;
    }

    public getterPublicKey(): string {
        return this.publicKey;
    }

    public getterServerConfig(): ServerConfig | null {
        return this.serverConfig;
    }

    public getterUserData(): UserData | null {
        return this.userData;
    }

    private setterIsLogin(login: boolean): void {
        this.isLogin = login;
        if (login) {
            this.pingIntervalStart();
            this.getUserData();
        } else {
            this.pingIntervalStop();
            this.userData=null;
        }
    }

    // ==============================
    // other
    // ==============================
    /**
     * 验证指令对象结构
     */
    private isValidInstructObject(obj: any): obj is InstructObject {
        return (
            obj !== null &&
            typeof obj === 'object' &&
            this.isStringField(obj, 'type') &&
            this.isStringField(obj, 'class') &&
            this.isStringField(obj, 'conveyor') &&
            this.isStringField(obj, 'time') &&
            this.isField(obj, 'data') &&
            this.isValidTimeFormat(obj.time)
        );
    }
    private isStringField(obj: any, field: string): boolean {
        return field in obj && typeof obj[field] === 'string';
    }
    private isField(obj: any, field: string): boolean {
        return field in obj;
    }
    private isValidTimeFormat(timeStr: string): boolean {
        return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3}$/.test(timeStr);
    }
    private pingIntervalStart(): void {
        this.pingIntervalStop();
        
        this.pingInterval = window.setInterval(() => {
            if (this.isLogin) {
                this.lastPing = Tool.getTimestamp();
                this.ping();
            }
        }, 5000);
    }
    private pingIntervalStop(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}
