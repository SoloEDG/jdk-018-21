import type { ColorMarker } from "../../../shared/document";

export interface MarkerScan {
  format: "PNG" | "JPEG" | "WEBP" | "UNKNOWN";
  markers: ColorMarker[];
  hasAlpha: boolean;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const RENDERING_INTENT = [
  "感知渲染（Perceptual）",
  "相对色度（Relative Colorimetric）",
  "饱和度（Saturation）",
  "绝对色度（Absolute Colorimetric）",
];

function u32BE(b: Uint8Array, o: number): number {
  return (
    (b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!
  ) >>> 0;
}

function u32LE(b: Uint8Array, o: number): number {
  return (
    b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)
  ) >>> 0;
}

function ascii(b: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && b[i] !== 0; i++) s += String.fromCharCode(b[i]!);
  return s;
}

function marker(
  code: string,
  label: string,
  recognized: boolean,
  detail = "",
): ColorMarker {
  return { code, label, recognized, detail };
}

const KNOWN_ICC_SIGNATURES: Array<{ match: RegExp; label: string }> = [
  { match: /display\s*p3/i, label: "Display P3 配置文件" },
  { match: /adobe\s*rgb/i, label: "Adobe RGB (1998) 配置文件" },
  { match: /pro\s*photo|romm/i, label: "ProPhoto / ROMM RGB 配置文件" },
  { match: /rec\.?\s*2020|bt\.?\s*2020/i, label: "Rec. 2020 配置文件" },
  { match: /srgb|iec61966/i, label: "sRGB 配置文件" },
  { match: /generic\s*rgb/i, label: "Generic RGB 配置文件" },
];

/** 在 ICC 负载中查找可识别的配置文件签名，找不到则返回 null */
function classifyIcc(payload: Uint8Array): string | null {
  const text = ascii(payload, 0, payload.length);
  for (const sig of KNOWN_ICC_SIGNATURES) {
    if (sig.match.test(text)) return sig.label;
  }
  return null;
}

function scanPng(b: Uint8Array): MarkerScan {
  const markers: ColorMarker[] = [];
  let hasAlpha = false;
  let offset = 8;
  const knownChunks = new Set([
    "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "sRGB", "gAMA", "cHRM",
    "iCCP", "bKGD", "pHYs", "tIME", "tEXt", "zTXt", "iTXt", "acTL",
    "fcTL", "fdAT", "sBIT", "sPLT", "hIST", "oFFs", "pCAL",
  ]);
  while (offset + 8 <= b.length) {
    const length = u32BE(b, offset);
    const type = ascii(b, offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > b.length) {
      markers.push(marker(type || "PNG?", "截断的数据块，无法完整解析", false));
      break;
    }
    switch (type) {
      case "IHDR": {
        const colorType = b[dataStart + 9];
        if (colorType === 4 || colorType === 6) hasAlpha = true;
        markers.push(
          marker(
            "IHDR",
            "PNG 文件头",
            true,
            `色彩类型 ${colorType}${hasAlpha ? "（含 alpha 通道）" : ""}`,
          ),
        );
        break;
      }
      case "sRGB": {
        const intent = b[dataStart] ?? 0;
        markers.push(
          marker(
            "sRGB",
            "声明使用 sRGB 色域",
            true,
            RENDERING_INTENT[intent] ?? `渲染意图 ${intent}`,
          ),
        );
        break;
      }
      case "gAMA": {
        const gamma = u32BE(b, dataStart) / 100000;
        markers.push(
          marker("gAMA", "伽马标记", true, `gamma ≈ ${gamma.toFixed(4)}`),
        );
        break;
      }
      case "cHRM":
        markers.push(marker("cHRM", "原色与白点色度标记", true, "自定义色度坐标"));
        break;
      case "iCCP": {
        const name = ascii(b, dataStart, dataEnd);
        const profile = classifyIcc(b.subarray(dataStart, dataEnd));
        if (profile) {
          markers.push(marker("iCCP", "嵌入的 ICC 配置文件", true, `${name} · ${profile}`));
        } else {
          markers.push(
            marker(
              "iCCP",
              "嵌入的 ICC 配置文件（无法识别其色域）",
              false,
              name || "未命名配置文件",
            ),
          );
        }
        break;
      }
      case "tRNS":
        hasAlpha = true;
        markers.push(marker("tRNS", "透明色标记", true, "为索引/真彩色补充 alpha 信息"));
        break;
      default:
        if (!knownChunks.has(type)) {
          markers.push(marker(type, "未知 PNG 数据块，含义无法确认", false));
        }
    }
    offset = dataEnd + 4;
  }
  return { format: "PNG", markers, hasAlpha };
}

function scanJpeg(b: Uint8Array): MarkerScan {
  const markers: ColorMarker[] = [];
  let offset = 2;
  const standalone = new Set([0xd8, 0xd9]);
  while (offset + 4 <= b.length) {
    if (b[offset] !== 0xff) {
      offset++;
      continue;
    }
    const code = b[offset + 1]!;
    if (standalone.has(code) || (code >= 0xd0 && code <= 0xd7) || code === 0x01) {
      offset += 2;
      continue;
    }
    const length = (b[offset + 2]! << 8) | b[offset + 3]!;
    if (length < 2 || offset + 2 + length > b.length) {
      if (code >= 0xe0 && code <= 0xef) {
        markers.push(
          marker(`APP${code - 0xe0}`, "截断的应用数据段，无法确认色彩含义", false),
        );
      }
      break;
    }
    const payload = b.subarray(offset + 4, offset + 2 + length);
    if (code >= 0xe0 && code <= 0xef) {
      const appId = `APP${code - 0xe0}`;
      const tag = ascii(payload, 0, Math.min(payload.length, 12));
      if (tag.startsWith("JFIF")) {
        markers.push(marker(appId, "JFIF 段，默认按 sRGB 解释", true, tag.trim()));
      } else if (tag.startsWith("Exif")) {
        markers.push(marker(appId, "Exif 元数据", true, "色彩空间标记通常为 sRGB"));
      } else if (tag.startsWith("http://ns.adobe.com/xap/")) {
        markers.push(marker(appId, "XMP 元数据", true));
      } else if (tag.startsWith("ICC_PROFILE")) {
        const icc = payload.subarray(14);
        const profile = classifyIcc(icc);
        if (profile) {
          markers.push(marker(appId, "嵌入的 ICC 配置文件", true, profile));
        } else {
          markers.push(
            marker(appId, "嵌入的 ICC 配置文件（无法识别其色域）", false, "ICC_PROFILE"),
          );
        }
      } else if (code === 0xed) {
        markers.push(marker(appId, "Photoshop IRB 数据段", true));
      } else if (tag.length > 0) {
        markers.push(marker(appId, `无法识别的应用数据段（${tag.trim()}）`, false));
      } else {
        markers.push(marker(appId, "无法识别的应用数据段", false));
      }
    } else if (code >= 0xc0 && code <= 0xcf && code !== 0xc4 && code !== 0xc8) {
      markers.push(marker("SOF", "JPEG 帧数据", true, "JPEG 不携带 alpha 通道"));
    }
    offset += 2 + length;
  }
  return { format: "JPEG", markers, hasAlpha: false };
}

function scanWebp(b: Uint8Array): MarkerScan {
  const markers: ColorMarker[] = [];
  let hasAlpha = false;
  let offset = 12;
  const knownChunks = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "EXIF", "XMP "])
  while (offset + 8 <= b.length) {
    const type = ascii(b, offset, offset + 4);
    const size = u32LE(b, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > b.length) {
      markers.push(marker(type || "WEBP?", "截断的数据块，无法完整解析", false));
      break;
    }
    switch (type) {
      case "VP8 ":
        markers.push(marker("VP8", "有损 WebP 码流", true, "不携带 alpha 通道"));
        break;
      case "VP8L": {
        const flags = u32LE(b, dataStart + 1);
        hasAlpha = ((flags >> 28) & 1) === 1;
        markers.push(
          marker("VP8L", "无损 WebP 码流", true, hasAlpha ? "包含透明像素" : "无 alpha"),
        );
        break;
      }
      case "VP8X": {
        hasAlpha = (b[dataStart]! & 0x10) === 0x10;
        markers.push(
          marker("VP8X", "扩展格式 WebP", true, hasAlpha ? "声明含 alpha 标志" : "无 alpha 标志"),
        );
        break;
      }
      case "ALPH":
        hasAlpha = true;
        markers.push(marker("ALPH", "独立 alpha 通道数据", true));
        break;
      case "ICCP": {
        const profile = classifyIcc(b.subarray(dataStart, dataEnd));
        if (profile) {
          markers.push(marker("ICCP", "嵌入的 ICC 配置文件", true, profile));
        } else {
          markers.push(marker("ICCP", "嵌入的 ICC 配置文件（无法识别其色域）", false));
        }
        break;
      }
      case "EXIF":
        markers.push(marker("EXIF", "Exif 元数据", true));
        break;
      case "XMP ":
        markers.push(marker("XMP", "XMP 元数据", true));
        break;
      case "ANIM":
      case "ANMF":
        markers.push(marker(type, "动画 WebP 数据", true));
        break;
      default:
        if (!knownChunks.has(type)) {
          markers.push(marker(type, "未知 WebP 数据块，含义无法确认", false));
        }
    }
    offset = dataEnd + (size & 1);
  }
  return { format: "WEBP", markers, hasAlpha };
}

export function scanMarkers(bytes: Uint8Array | null): MarkerScan {
  if (!bytes || bytes.length < 12) {
    return { format: "UNKNOWN", markers: [], hasAlpha: false };
  }
  const isPng = PNG_SIGNATURE.every((v, i) => bytes[i] === v);
  if (isPng) return scanPng(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return scanJpeg(bytes);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return scanWebp(bytes);
  }
  return { format: "UNKNOWN", markers: [], hasAlpha: false };
}
