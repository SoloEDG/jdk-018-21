import type { Crop, Interpretation } from "../../../shared/document";
import { buildHistogram } from "../../color/lib/colorMath";

export interface SampleResult {
  data: Uint8ClampedArray;
  histogram: number[];
}

/**
 * 从当前解释画布采样：先按所选底色完成 alpha over 合成，再缩放到网格尺寸。
 * 同一透明边缘在任何底色上都走同一套标准合成公式。
 */
export function sample(
  interpreted: HTMLCanvasElement,
  interp: Interpretation,
  crop: Crop,
  sourceWidth: number,
  sourceHeight: number,
  columns: number,
  rows: number,
): SampleResult {
  const c = document.createElement("canvas");
  c.width = columns;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = interp.matte;
  g.fillRect(0, 0, columns, rows);
  g.drawImage(
    interpreted,
    crop.x * sourceWidth,
    crop.y * sourceHeight,
    crop.width * sourceWidth,
    crop.height * sourceHeight,
    0,
    0,
    columns,
    rows,
  );
  const data = g.getImageData(0, 0, columns, rows).data;
  return { data, histogram: buildHistogram(data) };
}
