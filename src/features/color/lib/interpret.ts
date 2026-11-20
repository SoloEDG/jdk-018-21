import type {
  Asset,
  ColorReport,
  Interpretation,
} from "../../../shared/document";
import {
  P3_TO_SRGB_LINEAR,
  clampByte,
  isFiniteNumber,
  mapOutOfGamut,
  matVec,
  srgbDecode,
  srgbEncode,
} from "./colorMath";
import { scanMarkers } from "./markers";

export interface InterpretationResult {
  canvas: HTMLCanvasElement;
  outOfGamutRatio: number | null;
}

let cachedP3Support: boolean | null = null;

/** 当前浏览器是否支持 display-p3 画布读取 */
export function supportsP3(): boolean {
  if (cachedP3Support !== null) return cachedP3Support;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const g = c.getContext("2d", { colorSpace: "display-p3" });
    cachedP3Support =
      !!g &&
      (g.getContextAttributes?.() as CanvasRenderingContext2DSettings | undefined)
        ?.colorSpace === "display-p3";
  } catch {
    cachedP3Support = false;
  }
  return cachedP3Support;
}

function drawImageToCanvas(
  asset: Asset,
  colorSpace: PredefinedColorSpace,
): { canvas: HTMLCanvasElement; data: Uint8ClampedArray } {
  const canvas = document.createElement("canvas");
  canvas.width = asset.width;
  canvas.height = asset.height;
  const g = canvas.getContext("2d", {
    willReadFrequently: true,
    colorSpace,
  })!;
  g.drawImage(asset.image, 0, 0);
  const data = g.getImageData(0, 0, asset.width, asset.height, {
    colorSpace,
  }).data;
  return { canvas, data };
}

/** 统计解码结果的 alpha 分布 */
function alphaStats(data: Uint8ClampedArray): {
  transparent: number;
  partial: number;
  hasAlpha: boolean;
} {
  let transparent = 0;
  let partial = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i]!;
    if (a === 0) transparent++;
    else if (a < 255) partial++;
  }
  return { transparent, partial, hasAlpha: transparent > 0 || partial > 0 };
}

/** 在 display-p3 原始数据中统计超出 sRGB 色域的像素比例 */
function measureOutOfGamut(p3Data: Uint8ClampedArray): number {
  let out = 0;
  const total = p3Data.length / 4;
  for (let i = 0; i < p3Data.length; i += 4) {
    const lp = [
      srgbDecode(p3Data[i]! / 255),
      srgbDecode(p3Data[i + 1]! / 255),
      srgbDecode(p3Data[i + 2]! / 255),
    ];
    const ls = matVec(P3_TO_SRGB_LINEAR, lp);
    if (
      ls[0]! < -1e-7 ||
      ls[1]! < -1e-7 ||
      ls[2]! < -1e-7 ||
      ls[0]! > 1 + 1e-7 ||
      ls[1]! > 1 + 1e-7 ||
      ls[2]! > 1 + 1e-7
    ) {
      out++;
    }
  }
  return total ? out / total : 0;
}

/** 解析容器标记并分析解码像素，生成色彩信息报告 */
export function analyzeAsset(asset: Asset): ColorReport {
  const scan = scanMarkers(asset.bytes);
  const p3Supported = supportsP3();
  const srgb = drawImageToCanvas(asset, "srgb");
  const stats = alphaStats(srgb.data);
  let outOfGamutRatio: number | null = null;
  let wideGamut: boolean | null = null;
  if (p3Supported) {
    try {
      const p3 = drawImageToCanvas(asset, "display-p3");
      outOfGamutRatio = measureOutOfGamut(p3.data);
      wideGamut = outOfGamutRatio > 0;
    } catch {
      outOfGamutRatio = null;
      wideGamut = null;
    }
  }
  return {
    format: scan.format,
    markers: scan.markers,
    hasUnrecognized: scan.markers.some((m) => !m.recognized),
    hasAlpha: scan.hasAlpha || stats.hasAlpha,
    transparentPixels: stats.transparent,
    partialAlphaPixels: stats.partial,
    p3Supported,
    wideGamut,
    outOfGamutRatio,
  };
}

/** 校验转换结果：尺寸、有限数值、通道范围、alpha 必须与源一致 */
export function validateOutput(
  data: Uint8ClampedArray,
  expectedLength: number,
  sourceAlpha: Uint8ClampedArray,
): string | null {
  if (data.length !== expectedLength) {
    return `输出长度异常（${data.length} ≠ ${expectedLength}），已放弃本次转换`;
  }
  for (let i = 0; i < data.length; i++) {
    if (!isFiniteNumber(data[i]!)) {
      return "转换产生了非有限数值，已放弃本次转换";
    }
  }
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== sourceAlpha[i]) {
      return "转换改变了原始 alpha 通道，已放弃本次转换";
    }
  }
  return null;
}

/**
 * 按解释方案构建工作画布。
 * display：直接采用浏览器解码后的显示颜色；
 * working：读取 display-p3 数据并统一映射到 sRGB 工作色域，alpha 原样保留。
 */
export function buildInterpretedCanvas(
  asset: Asset,
  interp: Interpretation,
): InterpretationResult {
  if (interp.mode === "display" || !supportsP3()) {
    const { canvas } = drawImageToCanvas(asset, "srgb");
    return { canvas, outOfGamutRatio: null };
  }
  const p3 = drawImageToCanvas(asset, "display-p3");
  const out = document.createElement("canvas");
  out.width = asset.width;
  out.height = asset.height;
  const g = out.getContext("2d", { willReadFrequently: true })!;
  const imageData = g.createImageData(asset.width, asset.height);
  const dst = imageData.data;
  for (let i = 0; i < p3.data.length; i += 4) {
    const lp = [
      srgbDecode(p3.data[i]! / 255),
      srgbDecode(p3.data[i + 1]! / 255),
      srgbDecode(p3.data[i + 2]! / 255),
    ];
    let ls = matVec(P3_TO_SRGB_LINEAR, lp);
    const outside =
      ls.some((v) => v < -1e-7) || ls.some((v) => v > 1 + 1e-7);
    if (outside) ls = mapOutOfGamut(ls, interp.intent);
    dst[i] = clampByte(srgbEncode(ls[0]!) * 255);
    dst[i + 1] = clampByte(srgbEncode(ls[1]!) * 255);
    dst[i + 2] = clampByte(srgbEncode(ls[2]!) * 255);
    dst[i + 3] = p3.data[i + 3]!;
  }
  const error = validateOutput(dst, p3.data.length, p3.data);
  if (error) throw new Error(error);
  g.putImageData(imageData, 0, 0);
  return { canvas: out, outOfGamutRatio: measureOutOfGamut(p3.data) };
}

/** 将带 alpha 的解释画布合成到指定底色上，返回新画布（不修改原图） */
export function renderComposite(
  source: HTMLCanvasElement,
  backgroundHex: string,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const g = c.getContext("2d")!;
  g.fillStyle = backgroundHex;
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(source, 0, 0);
  return c;
}
