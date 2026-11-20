<script setup lang="ts">
import { computed } from "vue";
import { Palette, AlertTriangle, CheckCircle2, Info } from "lucide-vue-next";
import { useColor } from "../model/useColor";
import CompositePreview from "./CompositePreview.vue";

const c = useColor();

const trustText = computed(() => {
  switch (c.trustStatus.value) {
    case "exact":
      return { icon: CheckCircle2, text: "标记已识别，按标准准确解释", tone: "ok" };
    case "confirmed-default":
      return {
        icon: Info,
        text: "未知标记已由你确认采用默认解释，并非准确还原",
        tone: "warn",
      };
    default:
      return {
        icon: AlertTriangle,
        text: "存在无法识别的标记，默认解释尚未确认，不能宣称准确还原",
        tone: "warn",
      };
  }
});

const mattePresets = ["#000000", "#ffffff", "#101216"];

function setMode(mode: "display" | "working") {
  c.apply({ mode });
}
function setIntent(intent: "hue" | "luminance") {
  c.apply({ intent });
}
function setMatte(matte: string) {
  c.apply({ matte });
}
function percent(v: number | null) {
  return v === null ? "不可检测" : (v * 100).toFixed(2) + "%";
}
</script>

<template>
  <section v-if="c.doc.asset" class="panel color-panel">
    <div class="section-title"><span>02 / COLOR PROFILE</span><Palette :size="15" /></div>

    <!-- 可信度说明 -->
    <div class="trust-banner" :class="trustText.tone" data-testid="trust-banner">
      <component :is="trustText.icon" :size="14" />
      <span>{{ trustText.text }}</span>
    </div>

    <!-- 未知标记确认 -->
    <div v-if="c.unrecognized.value.length && !c.doc.interpretation?.unknownConfirmed"
      class="unknown-card" data-testid="unknown-marker-card">
      <strong>检测到无法识别的色彩标记</strong>
      <ul>
        <li v-for="m in c.unrecognized.value" :key="m.code">
          <code>{{ m.code }}</code> — {{ m.label }}<small v-if="m.detail">：{{ m.detail }}</small>
        </li>
      </ul>
      <p>默认将按浏览器解码结果与 sRGB 工作色域处理，这只是一种兜底解释，不代表已准确还原。</p>
      <button class="primary small" data-testid="confirm-unknown" @click="c.confirmUnknown">
        确认采用默认解释
      </button>
    </div>

    <!-- 可识别色彩信息 -->
    <dl class="report">
      <div><dt>容器格式</dt><dd>{{ c.doc.report?.format ?? "—" }}</dd></div>
      <div><dt>透明像素</dt><dd>{{ (c.doc.report?.transparentPixels ?? 0).toLocaleString() }} px</dd></div>
      <div><dt>半透明边缘</dt><dd>{{ (c.doc.report?.partialAlphaPixels ?? 0).toLocaleString() }} px</dd></div>
      <div>
        <dt>广色域超界</dt>
        <dd>{{ percent(c.doc.report?.outOfGamutRatio ?? null) }}</dd>
      </div>
    </dl>
    <ul v-if="c.doc.report?.markers.length" class="marker-list">
      <li v-for="m in c.doc.report.markers" :key="m.code + m.detail"
        :class="{ unknown: !m.recognized }">
        <code>{{ m.code }}</code>
        <span>{{ m.label }}<small v-if="m.detail"> · {{ m.detail }}</small></span>
      </li>
    </ul>
    <small v-else class="muted">未发现容器内色彩标记，按浏览器默认解码解释。</small>

    <!-- 转换模式 -->
    <div class="mode-cards">
      <button :class="{ active: c.doc.interpretation?.mode === 'display' }"
        data-testid="mode-display" @click="setMode('display')">
        <b>按显示效果</b>
        <small>直接使用浏览器解码后的颜色，所见即所得</small>
      </button>
      <button :class="{ active: c.doc.interpretation?.mode === 'working' }"
        data-testid="mode-working" @click="setMode('working')">
        <b>统一工作色域</b>
        <small>先映射到 sRGB 再转换，跨文件结果一致</small>
      </button>
    </div>

    <!-- 超界取舍 -->
    <div v-if="c.doc.interpretation?.mode === 'working'" class="intent-block"
      data-testid="intent-block">
      <small class="block-label">广色域颜色超出 sRGB 边界时</small>
      <label class="choice" :class="{ active: c.doc.interpretation.intent === 'hue' }">
        <input type="radio" name="gamut-intent" value="hue"
          :checked="c.doc.interpretation.intent === 'hue'"
          @change="setIntent('hue')" />
        <span><b>保色相</b><small>沿等色相裁到色域边界，颜色倾向不变、亮度可能变化</small></span>
      </label>
      <label class="choice" :class="{ active: c.doc.interpretation.intent === 'luminance' }">
        <input type="radio" name="gamut-intent" value="luminance"
          :checked="c.doc.interpretation.intent === 'luminance'"
          @change="setIntent('luminance')" />
        <span><b>保亮度</b><small>在等色相线上找亮度最接近的色域内颜色，明暗关系优先</small></span>
      </label>
      <small v-if="c.doc.report?.p3Supported === false" class="muted">
        当前浏览器不支持 display-p3 画布读取，工作色域退化为显示效果处理。
      </small>
    </div>

    <!-- 透明合成 -->
    <div class="matte-block">
      <small class="block-label">透明像素与底色合成（采样 / PNG 使用同一公式）</small>
      <div class="matte-row">
        <button v-for="p in mattePresets" :key="p"
          class="matte-swatch" :class="{ active: c.doc.interpretation?.matte === p }"
          :style="{ background: p }" :aria-label="`底色 ${p}`"
          @click="setMatte(p)" />
        <input type="color" aria-label="自定义底色"
          :value="c.doc.interpretation?.matte"
          @input="setMatte(($event.target as HTMLInputElement).value)" />
        <code class="matte-hex">{{ c.doc.interpretation?.matte.toUpperCase() }}</code>
      </div>
      <CompositePreview :source="c.doc.interpreted" :matte="c.doc.interpretation?.matte ?? '#000000'" />
    </div>
  </section>
</template>
