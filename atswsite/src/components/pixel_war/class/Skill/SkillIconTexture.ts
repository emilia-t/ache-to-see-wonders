/**
 * 技能图标贴图(资源层)
 *
 * 贴图统一存放于: src/components/pixel_war/resource/skill_icon/
 * 贴图规格: 100px × 100px 的 PNG
 * 文件名由技能(Skill)的只读属性 icon 指定(含扩展名,例如 'va2_shoot_skill.png')
 *
 * 本模块只负责"按文件名取贴图并绘制",不关心技能本身的逻辑,
 * 通过 Vite 的 import.meta.glob 在构建期收集贴图 URL,运行期懒加载 + 缓存。
 */

/** 文件名 -> 贴图 URL(build 期静态收集,新增贴图无需改动代码) */
const SKILL_ICON_URL_MAP: ReadonlyMap<string, string> = (() => {
  const modules = import.meta.glob('../../resource/skill_icon/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>;

  const map = new Map<string, string>();
  for (const [path, url] of Object.entries(modules)) {
    map.set(path.slice(path.lastIndexOf('/') + 1), url);
  }
  return map;
})();

/** 单个贴图的加载状态 */
type SkillIconTextureState = {
  img: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
};

/** 贴图缓存:key 为解析后的贴图 URL */
const SKILL_ICON_TEXTURE_CACHE = new Map<string, SkillIconTextureState>();

/**
 * 获取(必要时开始加载)指定技能图标贴图
 * @param icon 技能图标文件名(含扩展名,如 'va2_shoot_skill.png')
 * @returns 贴图状态,目录中不存在该文件时返回 null
 */
const H_getSkillIconTexture = (icon: string): SkillIconTextureState | null => {
  const url = SKILL_ICON_URL_MAP.get(icon);
  if (!url) return null;

  const cached = SKILL_ICON_TEXTURE_CACHE.get(url);
  if (cached) return cached;

  const state: SkillIconTextureState = {
    img: new Image(),
    loaded: false,
    failed: false
  };
  state.img.onload = () => {
    state.loaded = true;
  };
  state.img.onerror = () => {
    state.failed = true;
    console.warn(`[pixel_war] 技能图标贴图加载失败: ${icon}(${url})`);
  };
  state.img.src = url;
  SKILL_ICON_TEXTURE_CACHE.set(url, state);
  return state;
};

/**
 * 预加载技能图标贴图(初始化时调用,避免首帧图标缺失)
 * @param icons 技能图标文件名列表
 */
const H_preloadSkillIconTextures = (icons: readonly string[]): void => {
  for (const icon of icons) {
    H_getSkillIconTexture(icon);
  }
};

/**
 * 判断技能图标贴图是否已就绪(可直接绘制)
 * @param icon 技能图标文件名
 */
const H_isSkillIconTextureReady = (icon: string): boolean => {
  return H_getSkillIconTexture(icon)?.loaded === true;
};

/**
 * 以 (cx, cy) 为中心绘制技能图标贴图(等比缩放为 size × size)
 * @param ctx 目标画布上下文
 * @param icon 技能图标文件名
 * @param cx 中心 x(画布 CSS px)
 * @param cy 中心 y(画布 CSS px)
 * @param size 绘制边长(画布 CSS px,贴图按 1:1 等比缩放)
 * @param alpha 额外透明度(0~1),冷却中可用于压暗图标
 * @returns 是否成功绘制(贴图缺失或尚未加载完成时返回 false)
 */
const H_drawSkillIconTexture = (
  ctx: CanvasRenderingContext2D,
  icon: string,
  cx: number,
  cy: number,
  size: number,
  alpha: number = 1
): boolean => {
  const state = H_getSkillIconTexture(icon);
  if (!state || !state.loaded) return false;

  const half = size / 2;
  const prevAlpha = ctx.globalAlpha;
  if (alpha !== 1) {
    ctx.globalAlpha = prevAlpha * Math.max(0, Math.min(1, alpha));
  }
  ctx.drawImage(state.img, cx - half, cy - half, size, size);
  ctx.globalAlpha = prevAlpha;
  return true;
};

export {
  SKILL_ICON_URL_MAP,
  H_getSkillIconTexture,
  H_preloadSkillIconTextures,
  H_isSkillIconTextureReady,
  H_drawSkillIconTexture
};
