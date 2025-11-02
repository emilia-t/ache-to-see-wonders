export default interface UserData {
    id: number; // ID
    anonymous_user: boolean; // 用户是否是匿名的
    email: string; // 电子邮箱
    password: string | null // 一般为空，仅保留字段
    name: string; // 用户名
    qq: number; // QQ 号码
    theme_color: string; // 主题颜色（暗黑和亮色）
}