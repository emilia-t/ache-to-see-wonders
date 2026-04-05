// canvas-worker.ts - Web Worker for Canvas rendering using OffscreenCanvas

interface WorkerMessage {
  type: string;
  data?: any;
}

interface CanvasState {
  graphicsCanvas?: OffscreenCanvas;
  uiCanvas?: OffscreenCanvas;
  entityCanvas?: OffscreenCanvas;
  graphicsCtx?: OffscreenCanvasRenderingContext2D;
  uiCtx?: OffscreenCanvasRenderingContext2D;
  entityCtx?: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

// Rendering state
let state: CanvasState = {
  width: 0,
  height: 0,
  dpr: 1
};

// Cached textures and images
const textureCache = new Map<string, ImageBitmap>();

// Animation frame
let animationId: number | null = null;
let lastTimestamp = 0;

// Main message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, data } = e.data;

  switch (type) {
    case 'init':
      handleInit(data);
      break;
    case 'update-state':
      handleUpdateState(data);
      break;
    case 'draw':
      handleDraw();
      break;
    case 'resize':
      handleResize(data);
      break;
    case 'load-texture':
      handleLoadTexture(data);
      break;
    case 'start-animation':
      startAnimation();
      break;
    case 'stop-animation':
      stopAnimation();
      break;
    default:
      console.warn('Unknown message type:', type);
  }
};

function handleInit(data: any) {
  const { graphicsCanvas, uiCanvas, entityCanvas, width, height } = data;

  state.graphicsCanvas = graphicsCanvas;
  state.uiCanvas = uiCanvas;
  state.entityCanvas = entityCanvas;
  state.width = width;
  state.height = height;
  state.dpr = window.devicePixelRatio || 1;

  // Get contexts
  if (state.graphicsCanvas) {
    state.graphicsCtx = state.graphicsCanvas.getContext('2d')!;
  }
  if (state.uiCanvas) {
    state.uiCtx = state.uiCanvas.getContext('2d')!;
  }
  if (state.entityCanvas) {
    state.entityCtx = state.entityCanvas.getContext('2d')!;
  }

  // Initialize canvas sizes
  updateCanvasSizes();

  self.postMessage({ type: 'init-complete' });
}

function handleUpdateState(data: any) {
  // Update rendering state with new data
  Object.assign(state, data);
}

function handleDraw() {
  drawGraphics();
  drawUI();
  drawEntities();
}

function handleResize(data: any) {
  const { width, height } = data;
  state.width = width;
  state.height = height;
  updateCanvasSizes();
}

function handleLoadTexture(data: any) {
  const { url, id } = data;

  fetch(url)
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob))
    .then(bitmap => {
      textureCache.set(id, bitmap);
      self.postMessage({ type: 'texture-loaded', data: { id } });
    })
    .catch(error => {
      console.error('Failed to load texture:', url, error);
      self.postMessage({ type: 'texture-error', data: { id, error: error.message } });
    });
}

function updateCanvasSizes() {
  const displayWidth = Math.round(state.width * state.dpr);
  const displayHeight = Math.round(state.height * state.dpr);

  if (state.graphicsCanvas) {
    state.graphicsCanvas.width = displayWidth;
    state.graphicsCanvas.height = displayHeight;
    if (state.graphicsCtx) {
      state.graphicsCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }
  }

  if (state.uiCanvas) {
    state.uiCanvas.width = displayWidth;
    state.uiCanvas.height = displayHeight;
    if (state.uiCtx) {
      state.uiCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }
  }

  if (state.entityCanvas) {
    state.entityCanvas.width = displayWidth;
    state.entityCanvas.height = displayHeight;
    if (state.entityCtx) {
      state.entityCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }
  }
}

function startAnimation() {
  if (animationId) return;

  const animate = (timestamp: number) => {
    const deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    // Update animations
    updateAnimations(deltaTime);

    // Draw all canvases
    handleDraw();

    animationId = requestAnimationFrame(animate);
  };

  animationId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function updateAnimations(deltaTime: number) {
  // Update entity animations, etc.
  // This would contain the animation logic from the main thread
}

function drawGraphics() {
  if (!state.graphicsCtx || !state.graphicsCanvas) return;

  const ctx = state.graphicsCtx;
  const { width, height } = state;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Draw grid, axis, elements, etc.
  // This would contain the drawing logic from drawGraphics()
}

function drawUI() {
  if (!state.uiCtx || !state.uiCanvas) return;

  const ctx = state.uiCtx;
  const { width, height } = state;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw UI elements
  // This would contain the drawing logic from drawUI()
}

function drawEntities() {
  if (!state.entityCtx || !state.entityCanvas) return;

  const ctx = state.entityCtx;
  const { width, height } = state;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw entities
  // This would contain the drawing logic from drawEntities()
}

// Export for TypeScript
export {};