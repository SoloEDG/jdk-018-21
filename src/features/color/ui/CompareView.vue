<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import type { Asset, Interpretation } from "../../../shared/document";
import { renderComposite } from "../lib/interpret";

const props = defineProps<{
  asset: Asset | null;
  interpreted: HTMLCanvasElement | null;
  interp: Interpretation | null;
}>();

const rawRef = ref<HTMLCanvasElement>();
const interpRef = ref<HTMLCanvasElement>();

const MAX_H = 150;

function paint() {
  const raw = rawRef.value;
  const target = interpRef.value;
  if (!props.asset || !props.interpreted || !props.interp || !raw || !target) return;
  const scale = Math.min(1, MAX_H / props.asset.height);
  const w = Math.max(1, Math.round(props.asset.width * scale));
  const h = Math.max(1, Math.round(props.asset.height * scale));

  raw.width = w;
  raw.height = h;
  const rg = raw.getContext("2d")!;
  rg.drawImage(props.asset.image, 0, 0, w, h);

  const comp = renderComposite(props.interpreted, props.interp.matte);
  target.width = w;
  target.height = h;
  target.getContext("2d")!.drawImage(comp, 0, 0, w, h);
}

onMounted(paint);
watch(() => [props.interpreted, props.interp?.matte], paint);
</script>

<template>
  <div class="compare" data-testid="original-compare">
    <figure>
      <div class="checker"><canvas ref="rawRef" aria-label="浏览器解码原图" /></div>
      <figcaption>浏览器解码原图<small>棋盘格 = 透明区域</small></figcaption>
    </figure>
    <span class="compare-arrow">→</span>
    <figure>
      <div class="checker"><canvas ref="interpRef" aria-label="当前解释结果" /></div>
      <figcaption>
        当前解释
        <small v-if="interp">
          {{ interp.mode === "display" ? "按显示效果" : "sRGB 工作色域" }}
          · 底色 {{ interp.matte.toUpperCase() }}
        </small>
      </figcaption>
    </figure>
  </div>
</template>
