<script setup>
import * as Icons from '@element-plus/icons-vue'
defineProps({ metric: { type: Object, required: true } })
</script>

<template>
  <article class="quality-card" :class="`status-${metric.status}`">
    <div class="card-icon"><el-icon><component :is="Icons[metric.icon]" /></el-icon></div>
    <div><span>{{ metric.label }}</span><strong>{{ metric.value }}<small>{{ metric.unit }}</small></strong><em>{{ metric.target }}</em></div>
    <i class="status-dot"></i>
  </article>
</template>

<style scoped>
.quality-card{--accent:#35c6da;position:relative;display:flex;align-items:center;gap:13px;min-height:98px;padding:15px;overflow:hidden;background:linear-gradient(135deg,#0d3453,#09263e);border:1px solid #224e6c;border-bottom:2px solid var(--accent)}.status-excellent{--accent:#2dd497}.card-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;color:var(--accent);font-size:23px;background:color-mix(in srgb,var(--accent) 11%,transparent);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent)}.quality-card>div:last-of-type{display:flex;flex-direction:column}.quality-card span{color:#7696ac;font-size:10px}.quality-card strong{margin:4px 0 2px;color:#effaff;font:600 23px Consolas}.quality-card small{margin-left:3px;color:var(--accent);font:10px "Microsoft YaHei"}.quality-card em{color:#587c94;font-size:9px;font-style:normal;white-space:nowrap}.status-dot{position:absolute;right:10px;top:10px;width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 7px var(--accent)}
</style>
