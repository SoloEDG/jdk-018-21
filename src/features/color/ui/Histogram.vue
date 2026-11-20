<script setup lang="ts">
defineProps<{ histogram: number[] | null }>();
</script>
<template>
  <div class="histogram" data-testid="luminance-histogram">
    <svg
      v-if="histogram"
      :viewBox="`0 0 ${histogram.length} 100`"
      preserveAspectRatio="none"
      role="img"
      aria-label="亮度分布直方图"
    >
      <g v-for="(v, i) in histogram" :key="i">
        <rect
          :x="i"
          :y="100 - Math.max(1.5, v * 100 * 2.2)"
          width="0.92"
          :height="Math.max(1.5, v * 100 * 2.2)"
          :fill="i < 11 ? '#9fb674' : i < 22 ? '#d5e99f' : '#eef4d8'"
        />
      </g>
    </svg>
    <div v-else class="histogram-empty">暂无亮度数据</div>
    <div class="histogram-scale"><span>暗</span><span>亮度分布 · 32 档</span><span>亮</span></div>
  </div>
</template>
