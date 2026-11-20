export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** 显示效果：直接使用浏览器解码后的颜色；工作色域：先统一转换到 sRGB */
export type ColorMode = "display" | "working";
/** 广色域颜色超出 sRGB 边界时的取舍：保色相 / 保亮度 */
export type GamutIntent = "hue" | "luminance";
export interface ColorMarker {
  /** 容器内的标记代码，如 sRGB / iCCP / APP2-ICC_PROFILE / VP8X */
  code: string;
  /** 面向用户的说明 */
  label: string;
  /** 我们是否知道如何解释该标记 */
  recognized: boolean;
  /** 标记携带的细节（配置文件名、伽马值、渲染意图等） */
  detail: string;
}
export interface ColorReport {
  format: "PNG" | "JPEG" | "WEBP" | "DEMO" | "UNKNOWN";
  markers: ColorMarker[];
  /** 存在无法可靠识别的标记 */
  hasUnrecognized: boolean;
  /** 解码后是否包含 alpha 通道信息 */
  hasAlpha: boolean;
  /** 完全透明像素数（a === 0） */
  transparentPixels: number;
  /** 半透明边缘像素数（0 < a < 255） */
  partialAlphaPixels: number;
  /** 浏览器是否支持读取 display-p3 画布数据 */
  p3Supported: boolean;
  /** 是否检出超出 sRGB 色域的像素；无法检测时为 null */
  wideGamut: boolean | null;
  /** 超界像素占比（0..1），无法检测时为 null */
  outOfGamutRatio: number | null;
}
export interface Interpretation {
  mode: ColorMode;
  intent: GamutIntent;
  /** 透明像素合成所用底色 */
  matte: string;
  /** 无法识别的标记是否已由用户确认采用默认解释 */
  unknownConfirmed: boolean;
  /** 已确认的标记代码 */
  confirmedMarkers: string[];
  appliedAt: number;
}
export interface Asset {
  name: string;
  url: string;
  width: number;
  height: number;
  image: HTMLImageElement;
  /** 原始文件字节，用于解析容器标记；内置示例为 null */
  bytes: Uint8Array | null;
}
export interface Settings {
  columns: number;
  charset: string;
  custom: string;
  contrast: number;
  gamma: number;
  invert: boolean;
  color: boolean;
  background: string;
}
export interface Cell {
  glyph: string;
  color: string;
}
export interface Grid {
  columns: number;
  rows: number;
  cells: Cell[];
  /** 32 档亮度分布（归一化计数） */
  histogram: number[];
  revision: number;
}
export interface StudioDocument {
  asset: Asset | null;
  crop: Crop;
  settings: Settings;
  grid: Grid | null;
  revision: number;
  report: ColorReport | null;
  interpretation: Interpretation | null;
  /** 当前解释产出的画布（保留 alpha，合成在采样/预览阶段进行） */
  interpreted: HTMLCanvasElement | null;
  /** 上一套通过校验的有效解释，用于失败回滚 */
  lastValid: {
    interpretation: Interpretation;
    canvas: HTMLCanvasElement;
  } | null;
}
