import { reactive, ref, provide, watch } from "vue";
import { createDocument } from "../shared/defaults";
import { studioKey } from "../shared/context";
import { generate } from "../features/mapping";
export function useWorkspace() {
  const doc = reactive(createDocument());
  const busy = ref(false),
    notice = ref("所有处理均在你的浏览器中完成");
  let timer: ReturnType<typeof setTimeout>;
  function invalidate() {
    doc.revision++;
    busy.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        doc.grid = generate(doc);
      } catch (e) {
        notice.value = e instanceof Error ? e.message : "生成失败";
      } finally {
        busy.value = false;
      }
    }, 60);
  }
  // 预览背景变化时，默认让合成底色跟随，保持字符画与预览一致
  watch(
    () => doc.settings.background,
    (bg) => {
      if (doc.interpretation) doc.interpretation.matte = bg;
      invalidate();
    },
  );
  // 解释参数（模式 / 取舍 / 底色）变化时，字符结果、比较、亮度分布、PNG 一起更新
  watch(
    () => [
      doc.interpretation?.mode,
      doc.interpretation?.intent,
      doc.interpretation?.matte,
      doc.interpretation?.unknownConfirmed,
    ],
    invalidate,
  );
  provide(studioKey, { doc, busy, notice, invalidate });
  return { doc, busy, notice };
}
