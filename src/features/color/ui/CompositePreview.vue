<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { renderComposite } from "../lib/interpret";

const props = defineProps<{
  source: HTMLCanvasElement | null;
  matte: string;
}>();

const blackRef = ref<HTMLCanvasElement>();
const whiteRef = ref<HTMLCanvasElement>();

function paint() {
  if (!props.source) return;
  for (const [el, bg] of [
    [blackRef.value, "#000000"],
    [whiteRef.value, "#ffffff"],
  ] as const) {
    if (!el) continue;
    const composite = renderComposite(props.source, bg);
    el.width = composite.width;
    el.height = composite.height;
    el.getContext("2d")!.drawImage(composite, 0, 0);
  }
}

onMounted(paint);
watch(() => [props.source, props.matte], paint);
</script>

<template>
  <div class="composite-preview" data-testid="composite-preview">
    <figure>
      <canvas ref="blackRef" aria-label="黑色底色合成预览" />
      <figcaption>黑底合成 <code>#000000</code></figcaption>
    </figure>
    <figure>
      <canvas ref="whiteRef" aria-label="白色底色合成预览" />
      <figcaption>白底合成 <code>#FFFFFF</code></figcaption>
    </figure>
  </div>
</template>
