import { computed, markRaw } from "vue";
import { useStudio } from "../../../shared/useStudio";
import type { Asset, Interpretation } from "../../../shared/document";
import { analyzeAsset, buildInterpretedCanvas } from "../lib/interpret";

export function defaultInterpretation(matte: string): Interpretation {
  return {
    mode: "display",
    intent: "hue",
    matte,
    unknownConfirmed: false,
    confirmedMarkers: [],
    appliedAt: Date.now(),
  };
}

export function useColor() {
  const { doc, notice, invalidate } = useStudio();

  /** 新图片载入：解析标记、建立首套有效解释（默认按显示效果） */
  function setupAsset(asset: Asset) {
    const scan = analyzeAsset(asset);
    // 内置示例没有原始文件字节，标记扫描不适用
    const report = asset.bytes
      ? scan
      : { ...scan, format: "DEMO" as const, markers: [], hasUnrecognized: false };
    const interpretation = defaultInterpretation(doc.settings.background);
    // 首套解释使用 display 模式（直接取浏览器解码结果），失败再退回原始绘制
    let canvas: HTMLCanvasElement;
    try {
      canvas = buildInterpretedCanvas(asset, interpretation).canvas;
    } catch {
      const c = document.createElement("canvas");
      c.width = asset.width;
      c.height = asset.height;
      c.getContext("2d")!.drawImage(asset.image, 0, 0);
      canvas = markRaw(c);
      notice.value = "色彩解释初始化异常，已使用浏览器原始绘制结果";
    }
    doc.report = report;
    doc.interpretation = interpretation;
    doc.interpreted = markRaw(canvas);
    doc.lastValid = { interpretation, canvas: markRaw(canvas) };
  }

  /**
   * 更换解释。新画布必须完整通过校验才会提交；
   * 失败时显式恢复到本次操作前的快照，不会出现部分颜色留在新色域的中间状态。
   * 裁剪与所有生成参数均不改动。
   */
  function apply(patch: Partial<Interpretation>): boolean {
    if (!doc.asset || !doc.interpretation || !doc.interpreted) return false;
    // 操作前快照：失败时的唯一回滚目标，即用户当前正在使用的一套有效解释
    const snapshot = {
      interpretation: { ...doc.interpretation },
      canvas: doc.interpreted,
    };
    const next: Interpretation = {
      ...doc.interpretation,
      ...patch,
      appliedAt: Date.now(),
    };
    const rebuildNeeded =
      patch.mode !== undefined || patch.intent !== undefined;
    let newCanvas: HTMLCanvasElement | null = null;
    try {
      if (rebuildNeeded) {
        // 构建与校验完成前不触碰文档状态
        newCanvas = markRaw(buildInterpretedCanvas(doc.asset, next).canvas);
      }
      // 全部通过后才提交
      doc.interpretation = next;
      if (newCanvas) doc.interpreted = newCanvas;
      // 已提交的新状态成为“上一套有效解释”
      doc.lastValid = {
        interpretation: next,
        canvas: newCanvas ?? snapshot.canvas,
      };
      invalidate();
      notice.value = rebuildNeeded
        ? next.mode === "working"
          ? `已按 sRGB 工作色域转换（${next.intent === "hue" ? "保色相" : "保亮度"}）`
          : "已切换为按显示效果转换"
        : "合成底色已更新";
      return true;
    } catch (e) {
      // 显式回到操作前那套有效解释，而不是历史上任意一套
      doc.interpretation = snapshot.interpretation;
      doc.interpreted = snapshot.canvas;
      notice.value =
        (e instanceof Error ? e.message : "色彩转换失败") +
        "，已恢复上一套有效解释";
      invalidate();
      return false;
    }
  }

  /** 无法识别的标记：由用户确认采用默认解释，不宣称已准确还原 */
  function confirmUnknown() {
    if (!doc.interpretation || !doc.report) return;
    const codes = doc.report.markers
      .filter((m) => !m.recognized)
      .map((m) => m.code);
    doc.interpretation.unknownConfirmed = true;
    doc.interpretation.confirmedMarkers = codes;
    doc.interpretation.appliedAt = Date.now();
  }

  const unrecognized = computed(() =>
    (doc.report?.markers ?? []).filter((m) => !m.recognized),
  );

  /** 当前解释的可信状态，用于界面措辞——无法确认的内容不得表述为已准确还原 */
  const trustStatus = computed<"exact" | "assumed" | "confirmed-default">(() => {
    if (!doc.report) return "assumed";
    if (!doc.report.hasUnrecognized) return "exact";
    return doc.interpretation?.unknownConfirmed
      ? "confirmed-default"
      : "assumed";
  });

  return {
    doc,
    setupAsset,
    apply,
    confirmUnknown,
    unrecognized,
    trustStatus,
  };
}
