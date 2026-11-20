import type { StudioDocument, Grid } from "../../../shared/document";
import { glyphs } from "../lib/charsets";
import { gridSize } from "../lib/gridSize";
import { sample } from "../lib/sample";
import { tone, luminance } from "../lib/tone";
export function generate(doc: StudioDocument): Grid | null {
  if (!doc.asset || !doc.interpreted || !doc.interpretation) return null;
  const s = doc.settings;
  const size = gridSize(
    doc.asset.width * doc.crop.width,
    doc.asset.height * doc.crop.height,
    s.columns,
  );
  const { data: pixels, histogram } = sample(
    doc.interpreted,
    doc.interpretation,
    doc.crop,
    doc.asset.width,
    doc.asset.height,
    size.columns,
    size.rows,
  );
  const chars = glyphs(s.charset, s.custom);
  const cells = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!,
      g = pixels[i + 1]!,
      b = pixels[i + 2]!;
    const t = tone(luminance(r, g, b), s.contrast, s.gamma, s.invert);
    cells.push({
      glyph: chars[Math.round(t * (chars.length - 1))]!,
      color:
        "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
    });
  }
  return { ...size, cells, histogram, revision: doc.revision };
}
