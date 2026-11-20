import { ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import { useColor } from "../../color/model/useColor";
import { decodeImage } from "../lib/decode";
import { demoImage } from "../lib/demo";
export function useSource() {
  const { doc, notice, invalidate } = useStudio();
  const color = useColor();
  const loading = ref(false);
  let ticket = 0;
  async function load(url: string, name: string, bytes: Uint8Array | null) {
    const id = ++ticket;
    loading.value = true;
    try {
      const asset = await decodeImage(url, name, bytes);
      if (id !== ticket) return;
      doc.asset = asset;
      doc.crop = { x: 0, y: 0, width: 1, height: 1 };
      color.setupAsset(asset);
      invalidate();
      notice.value = "图片已载入，可查看并选择色彩解释";
    } catch (e) {
      if (id === ticket)
        notice.value = e instanceof Error ? e.message : "无法读取图片";
    } finally {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      if (id === ticket) loading.value = false;
    }
  }
  async function file(f?: File) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 20 * 1024 * 1024) {
      notice.value = "请选择 20 MB 以内的 PNG、JPEG 或 WebP 图片";
      return;
    }
    let bytes: Uint8Array | null = null;
    try {
      bytes = new Uint8Array(await f.arrayBuffer());
    } catch {
      bytes = null;
    }
    void load(URL.createObjectURL(f), f.name, bytes);
  }
  return {
    doc,
    loading,
    file,
    demo: () => load(demoImage(), "Sunset ridge.png", null),
  };
}
