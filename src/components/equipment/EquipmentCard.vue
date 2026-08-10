<script setup>
import * as Icons from '@element-plus/icons-vue'
import { statusMap } from '@/mock/equipment'

defineProps({ device: { type: Object, required: true }, selected: Boolean })
defineEmits(['select', 'detail'])
</script>

<template>
  <article class="device-card" :class="[{ selected }, `status-${device.status}`]" @click="$emit('select', device)">
    <header><div class="device-icon"><el-icon><component :is="Icons[device.icon]" /></el-icon></div><div><small>{{ device.id }} · {{ device.type }}</small><h3>{{ device.name }}</h3></div><el-tag :type="statusMap[device.status].type" size="small" effect="dark">{{ statusMap[device.status].label }}</el-tag></header>
    <div class="health-row"><div><span>设备健康评分</span><strong :class="{ warning: device.health < 85 }">{{ device.health }}<small>分</small></strong></div><el-progress type="dashboard" :percentage="device.health" :width="66" :stroke-width="6" :show-text="false" :color="device.health < 85 ? '#ffad45' : '#2bc5db'" /></div>
    <div class="params"><div><span>温度</span><b>{{ device.temperature }}<small>℃</small></b></div><div><span>压力</span><b>{{ device.pressure }}<small>MPa</small></b></div><div><span>振动</span><b :class="{ warning: device.vibration > 4 }">{{ device.vibration }}<small>mm/s</small></b></div></div>
    <footer><span>累计运行 <b>{{ device.runtime.toLocaleString() }} h</b></span><el-button text type="primary" size="small" @click.stop="$emit('detail',device)">设备详情 <el-icon><ArrowRight /></el-icon></el-button></footer>
  </article>
</template>

<style scoped>
.device-card{padding:15px;cursor:pointer;background:linear-gradient(145deg,#0d3452,#09263e);border:1px solid #244e6b;transition:.25s}.device-card:hover,.device-card.selected{transform:translateY(-2px);border-color:#2ca5df;box-shadow:0 8px 22px rgba(0,14,27,.32),inset 0 0 20px rgba(35,152,211,.07)}.status-warning{border-top:2px solid #eea142}.device-card header{display:flex;align-items:center;gap:10px}.device-card header>div:nth-child(2){min-width:0;flex:1}.device-icon{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;color:#3fbaf0;font-size:21px;background:#123f60;border:1px solid #286889}.device-card small{font-size:9px;color:#5e8199}.device-card h3{margin:4px 0 0;color:#e3f0f8;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.health-row{display:flex;align-items:center;justify-content:space-between;height:82px;margin-top:10px;padding:8px 4px 4px 12px;background:rgba(7,27,44,.45);border:1px solid rgba(42,87,116,.55)}.health-row>div{display:flex;flex-direction:column}.health-row span{color:#688aa2;font-size:10px}.health-row strong{margin-top:6px;color:#32d3ce;font:600 25px Consolas}.health-row strong small{margin-left:3px}.warning{color:#ffad45!important}.params{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.params>div{display:flex;flex-direction:column;padding:8px;background:#0a2941;border-left:2px solid #255a7a}.params span{color:#63849b;font-size:9px}.params b{margin-top:4px;color:#c9e1ef;font:600 14px Consolas}.params small{margin-left:2px}.device-card footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:#64869e;font-size:9px}.device-card footer b{color:#9bb5c6;font:11px Consolas}
</style>
