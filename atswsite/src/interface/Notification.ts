import type NotifyUserLineChange from '@/interface/NotifyUserLineChange'
import type NotifySimple from '@/interface/NotifySimple'

export default interface Notification {
    readonly id: number;
    readonly timestamp: number;
    readonly content: NotifyUserLineChange | NotifySimple;
}