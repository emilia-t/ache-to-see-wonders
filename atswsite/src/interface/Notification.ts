import type NotifyUserLineChange from '@/interface/NotifyUserLineChange'
export default interface Notification {
    readonly id: number;
    readonly timestamp: number;
    readonly content: NotifyUserLineChange
}