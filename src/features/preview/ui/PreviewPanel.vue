<script setup lang="ts">
import { computed } from "vue";
import { Code2, Scan, Minus, Plus, Images, BarChart3 } from "lucide-vue-next";
import { usePreview } from "../model/usePreview";
import { gridRows } from "../lib/rows";
import ArtCanvas from "./ArtCanvas.vue";
import { CompareView, Histogram } from "../../color";
const p = usePreview();
const text = computed(() =>
  p.doc.grid ? gridRows(p.doc.grid).join("\n") : "",
);
</script>
<template>
  <main class="workspace">
    <div class="preview-toolbar">
      <div class="tabs">
        <button
          :class="{ active: p.mode.value === 'art' }"
          @click="p.mode.value = 'art'"
        >
          <Scan :size="14" /> 字符预览</button
        ><button
          :class="{ active: p.mode.value === 'text' }"
          @click="p.mode.value = 'text'"
        >
          <Code2 :size="14" /> 纯文本</button
        ><button
          :class="{ active: p.mode.value === 'compare' }"
          data-testid="tab-compare"
          @click="p.mode.value = 'compare'"
        >
          <Images :size="14" /> 原图比较</button
        ><button
          :class="{ active: p.mode.value === 'histogram' }"
          data-testid="tab-histogram"
          @click="p.mode.value = 'histogram'"
        >
          <BarChart3 :size="14" /> 亮度分布
        </button>
      </div>
      <label class="color-toggle"
        ><span class="color-dot" /> 彩色<input
          aria-label="彩色预览"
          type="checkbox"
          v-model="p.doc.settings.color"
      /></label>
    </div>
    <div class="art-stage">
      <div class="stage-label">OUTPUT / LIVE RENDER <span>●</span></div>
      <div class="art-scroll">
        <ArtCanvas
          v-if="p.doc.grid && p.mode.value === 'art'"
          :grid="p.doc.grid"
          :color="p.doc.settings.color"
          :background="p.doc.settings.background"
          :zoom="p.zoom.value"
        />
        <pre
          v-else-if="p.doc.grid && p.mode.value === 'text'"
          data-testid="text-preview"
          :style="{
            fontSize: (14 * p.zoom.value) / 100 + 'px',
            lineHeight: (16 * p.zoom.value) / 100 + 'px',
          }"
          >{{ text }}</pre
        >
        <CompareView
          v-else-if="p.mode.value === 'compare'"
          :asset="p.doc.asset"
          :interpreted="p.doc.interpreted"
          :interp="p.doc.interpretation"
        />
        <Histogram
          v-else-if="p.mode.value === 'histogram'"
          :histogram="p.doc.grid?.histogram ?? null"
        />
        <span v-else>正在准备字符画…</span>
      </div>
      <div class="stage-corner">
        {{ p.doc.grid?.columns }} COL × {{ p.doc.grid?.rows }} ROW
      </div>
    </div>
    <div class="preview-bottom">
      <span class="mono"
        ><i class="status-dot" />{{
          p.busy.value
            ? "生成中"
            : p.doc.grid?.revision === p.doc.revision
              ? "已同步"
              : "待重新生成"
        }}
        <span class="muted">/ {{ p.count.value }} 个字符</span></span
      >
      <div class="zoom">
        <button
          aria-label="缩小"
          @click="p.zoom.value = Math.max(25, p.zoom.value - 25)"
        >
          <Minus :size="14" /></button
        ><span>{{ p.zoom.value }}%</span
        ><button
          aria-label="放大"
          @click="p.zoom.value = Math.min(200, p.zoom.value + 25)"
        >
          <Plus :size="14" />
        </button>
      </div>
    </div>
    <div class="workspace-note">
      <span>从像素，到字符。</span
      ><small>每一个符号，都是光影的另一种表达。</small
      ><span class="note-symbol">{ Aa }</span>
    </div>
  </main>
</template>
