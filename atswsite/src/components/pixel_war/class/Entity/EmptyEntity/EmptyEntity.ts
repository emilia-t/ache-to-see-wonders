import { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { EntityDebugFlags } from '@/components/pixel_war/interface/Interface';
export class EmptyEntity extends Entity {
  constructor() {
    super('empty', { x: 0, y: 0 }, 0, 0, '', 'Empty', 'empty');
  }
  draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    return;
  }
}