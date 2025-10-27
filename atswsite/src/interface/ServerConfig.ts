export default interface ServerConfig {
    version: string;// 服务端运行版本
    anonymous_login: boolean;
    key: string;
    url: string;
    name: string;
    online_number: number;
    max_online: number;
}