import { Entity } from '@/components/pixel_war/class/Entity/Entity';
export class EmptyEntity extends Entity {
  constructor() {
    super('empty', { x: 0, y: 0 }, 0, 0, '', 'Empty', 'empty');
  }
}