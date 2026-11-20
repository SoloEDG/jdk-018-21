import type { GamutIntent } from "../../../shared/document";

export type RGBA = [number, number, number, number];

export function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export function isFiniteNumber(v: number): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

/** sRGB 传递函数：线性光 → sRGB 编码分量 */
export function srgbEncode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** sRGB 传递函数：sRGB 编码分量 → 线性光 */
export function srgbDecode(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * display-p3（D65，与 sRGB 共用白点）线性光 → sRGB 线性光。
 * 矩阵由两组原色 xy 色度按 XYZ 推导，与 CSS Color 4 参考值一致。
 */
export const P3_TO_SRGB_LINEAR: number[][] = [
  [1.2249401, -0.2249404, 0.0],
  [-0.0420569, 1.0420571, 0.0],
  [-0.0196376, -0.0786361, 1.0982737],
];

export function matVec(m: number[][], v: number[]): number[] {
  return [
    m[0]![0]! * v[0]! + m[0]![1]! * v[1]! + m[0]![2]! * v[2]!,
    m[1]![0]! * v[0]! + m[1]![1]! * v[1]! + m[1]![2]! * v[2]!,
    m[2]![0]! * v[0]! + m[2]![1]! * v[1]! + m[2]![2]! * v[2]!,
  ];
}

/** 相对亮度（线性光域，BT.709 系数） */
export function relativeLuminance(linear: number[]): number {
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function inSrgbGamut(linear: number[]): boolean {
  return (
    linear[0]! >= -1e-7 &&
    linear[1]! >= -1e-7 &&
    linear[2]! >= -1e-7 &&
    linear[0]! <= 1 + 1e-7 &&
    linear[1]! <= 1 + 1e-7 &&
    linear[2]! <= 1 + 1e-7
  );
}

/**
 * CSS Color 4 风格的保色相色域裁剪：沿等色相平面与色域边界求交。
 * 输入/输出均为 sRGB 线性光。
 */
export function clipPreserveHue(rgb: number[]): number[] {
  if (inSrgbGamut(rgb)) return rgb.slice();
  const [r, g, b] = rgb;
  const max = Math.max(r!, g!, b!);
  const min = Math.min(r!, g!, b!);
  if (max <= 1 && min < 0) {
    // 仅下溢：沿过白点方向抬升到 0 平面
    const t = -min / (1 - min);
    return [
      r! + (1 - r!) * t,
      g! + (1 - g!) * t,
      b! + (1 - b!) * t,
    ];
  }
  if (min >= 0 && max > 1) {
    // 仅上溢：朝白点收缩到 1 平面
    const t = (max - 1) / max;
    return [r! * (1 - t), g! * (1 - t), b! * (1 - t)];
  }
  // 同时越界：先处理上溢，再处理下溢（色相保持不变）
  let out = rgb.slice();
  if (max > 1) {
    const t = (max - 1) / max;
    out = out.map((c) => c * (1 - t));
  }
  const outMin = Math.min(...out);
  if (outMin < 0) {
    const t = -outMin / (1 - outMin);
    out = out.map((c) => c + (1 - c) * t);
  }
  return out;
}

/**
 * 保亮度映射：在等色相线上搜索使相对亮度最接近原值、且落在 sRGB 色域内的点。
 * 若目标亮度在该色相线上不可达，则回退到保色相裁剪点（色域内最接近的点）。
 * 输入/输出均为 sRGB 线性光。
 */
export function clipPreserveLuminance(rgb: number[]): number[] {
  if (inSrgbGamut(rgb)) return rgb.slice();
  const target = relativeLuminance(rgb);
  const clipped = clipPreserveHue(rgb);
  const lClipped = relativeLuminance(clipped);
  if (Math.abs(lClipped - target) < 1e-9) return clipped;
  // 等色相线从裁剪点向白点延伸，亮度单调上升；
  // 目标低于裁剪点亮度时不可达，裁剪点即色域内最接近的点
  if (target <= lClipped) return clipped;
  // 在裁剪点与白点之间二分：亮度随混合比例单调，找最接近 target 的比例
  let lo = 0;
  let hi = 1;
  let best = clipped;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const candidate = clipped.map((c) => c * (1 - t) + t);
    const l = relativeLuminance(candidate);
    best = candidate;
    if (l > target) hi = t;
    else lo = t;
  }
  return best.map((c) => Math.max(0, Math.min(1, c)));
}

export function mapOutOfGamut(rgb: number[], intent: GamutIntent): number[] {
  return intent === "luminance"
    ? clipPreserveLuminance(rgb)
    : clipPreserveHue(rgb);
}

/** 解析 #rgb / #rrggbb，返回 0..255 三元组；非法值回退黑色 */
export function parseHex(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** 标准 alpha over 合成，输入输出均为 0..255 */
export function compositeOver(
  fg: RGBA,
  bg: [number, number, number],
): [number, number, number] {
  const a = fg[3] / 255;
  return [
    clampByte(fg[0] * a + bg[0] * (1 - a)),
    clampByte(fg[1] * a + bg[1] * (1 - a)),
    clampByte(fg[2] * a + bg[2] * (1 - a)),
  ];
}

/** 32 档亮度直方图，返回归一化计数（合计为 1，空图返回全 0） */
export function buildHistogram(data: Uint8ClampedArray): number[] {
  const bins = new Array<number>(32).fill(0);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y =
      0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    const idx = Math.min(31, Math.floor(y / 8));
    bins[idx]!++;
    total++;
  }
  return total ? bins.map((n) => n / total) : bins;
}
