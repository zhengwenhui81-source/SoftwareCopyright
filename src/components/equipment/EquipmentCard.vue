<script setup>
import { computed } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import { statusMap } from '@/mock/equipment'

const props = defineProps({ device: { type: Object, required: true }, healthEvaluation: { type: Object, required: true }, selected: Boolean })
defineEmits(['select', 'detail'])
const score = computed(() => props.healthEvaluation.score)
</script>

<template>
  <article class="device-card" :class="[{ selected }, `status-${device.status}`]" @click="$emit('select', device)">
    <header><div class="device-icon"><el-icon><component :is="Icons[device.icon]" /></el-icon></div><div><small>{{ device.id }} · {{ device.type }}</small><h3>{{ device.name }}</h3></div><el-tag :type="statusMap[device.status].type" size="small" effect="dark">{{ statusMap[device.status].label }}</el-tag></header>
    <div class="health-row"><div><span>设备健康评分</span><strong :class="{ warning: score < 80 }">{{ score }}<small>分</small></strong><span class="health-level" :style="{ color: healthEvaluation.level.color }">{{ healthEvaluation.level.label }}</span></div><div class="failure"><span>未来24小时故障概率</span><b>{{ healthEvaluation.failureProbability }}%</b></div><el-progress type="dashboard" :percentage="score" :width="66" :stroke-width="6" :show-text="false" :color="healthEvaluation.level.color" /></div>
    <div class="params"><div><span>温度</span><b>{{ device.temperature }}<small>℃</small></b></div><div><span>压力</span><b>{{ device.pressure }}<small>MPa</small></b></div><div><span>振动</span><b :class="{ warning: device.vibration > 4 }">{{ device.vibration }}<small>mm/s</small></b></div></div>
    <p class="demo-note">预测维护演示 · 基于工业仿真数据</p><footer><span>累计运行 <b>{{ device.runtime.toLocaleString() }} h</b></span><el-button text type="primary" size="small" @click.stop="$emit('detail',device)">设备详情 <el-icon><ArrowRight /></el-icon></el-button></footer>
  </article>
</template>

<style scoped>
.device-card{padding:15px;cursor:pointer;background:linear-gradient(145deg,#0d3452,#09263e);border:1px solid #244e6b;transition:.25s}.device-card:hover,.device-card.selected{transform:translateY(-2px);border-color:#2ca5df;box-shadow:0 8px 22px rgba(0,14,27,.32),inset 0 0 20px rgba(35,152,211,.07)}.status-warning{border-top:2px solid #eea142}.device-card header{display:flex;align-items:center;gap:10px}.device-card header>div:nth-child(2){min-width:0;flex:1}.device-icon{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;color:#3fbaf0;font-size:21px;background:#123f60;border:1px solid #286889}.device-card small{font-size:9px;color:#5e8199}.device-card h3{margin:4px 0 0;color:#e3f0f8;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.health-row{display:flex;align-items:center;justify-content:space-between;height:82px;margin-top:10px;padding:8px 4px 4px 12px;background:rgba(7,27,44,.45);border:1px solid rgba(42,87,116,.55)}.health-row>div{display:flex;flex-direction:column}.health-row span{color:#688aa2;font-size:10px}.health-row strong{margin-top:6px;color:#32d3ce;font:600 25px Consolas}.health-row strong small{margin-left:3px}.warning{color:#ffad45!important}.params{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.params>div{display:flex;flex-direction:column;padding:8px;background:#0a2941;border-left:2px solid #255a7a}.params span{color:#63849b;font-size:9px}.params b{margin-top:4px;color:#c9e1ef;font:600 14px Consolas}.params small{margin-left:2px}.device-card footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:#64869e;font-size:9px}.device-card footer b{color:#9bb5c6;font:11px Consolas}
.health-row{position:relative;height:96px;padding-bottom:25px}.health-level{margin-top:2px;font-size:9px}.failure{position:absolute;left:12px;bottom:6px;display:flex!important;align-items:center!important;flex-direction:row!important;gap:7px}.failure span{font-size:8px}.failure b{color:#ffad45;font:600 14px Consolas}.demo-note{margin:8px 0 0;color:#476f87;text-align:center;font-size:8px}.device-card footer{margin-top:6px}
</style>
