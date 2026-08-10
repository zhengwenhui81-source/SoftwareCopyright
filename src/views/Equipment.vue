<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseChart from '@/components/charts/BaseChart.vue'
import EquipmentCard from '@/components/equipment/EquipmentCard.vue'
import { createTrendData, equipmentList, statusMap, trendTimes, vary } from '@/mock/equipment'

const devices = ref(equipmentList.map((item) => ({ ...item })))
const filterType = ref('全部设备')
const selectedId = ref(devices.value[0].id)
const detailVisible = ref(false)
const detailDevice = ref(null)
const trends = ref(Object.fromEntries(devices.value.map((device) => [device.id, createTrendData(device)])))
const types = ['全部设备', ...new Set(equipmentList.map((item) => item.type))]
const filteredDevices = computed(() => filterType.value === '全部设备' ? devices.value : devices.value.filter((item) => item.type === filterType.value))
const selectedDevice = computed(() => devices.value.find((item) => item.id === selectedId.value) || devices.value[0])
const runningCount = computed(() => devices.value.filter((item) => item.status === 'running').length)
const averageHealth = computed(() => Math.round(devices.value.reduce((sum, item) => sum + item.health, 0) / devices.value.length))

const chartOption = computed(() => {
  const data = trends.value[selectedDevice.value.id]
  const text = { color: '#7896ac', fontSize: 10 }
  return {
    color: ['#ffad45', '#2c9df1', '#32d5c4'], tooltip: { trigger: 'axis' },
    legend: { right: 10, top: 0, textStyle: text }, grid: { left: 45, right: 42, top: 42, bottom: 28 },
    xAxis: { type: 'category', data: trendTimes, boundaryGap: false, axisLine: { lineStyle: { color: '#31516a' } }, axisLabel: text },
    yAxis: [
      { type: 'value', name: '温度/压力', nameTextStyle: text, axisLabel: text, splitLine: { lineStyle: { color: 'rgba(100,145,177,.13)', type: 'dashed' } } },
      { type: 'value', name: '振动', nameTextStyle: text, axisLabel: text, splitLine: { show: false } },
    ],
    series: [
      { name: '温度 ℃', type: 'line', smooth: true, symbol: 'none', data: data.temperature, areaStyle: { color: 'rgba(255,173,69,.08)' } },
      { name: '压力 MPa', type: 'line', smooth: true, symbol: 'none', data: data.pressure },
      { name: '振动 mm/s', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', data: data.vibration },
    ],
  }
})

function selectDevice(device) { selectedId.value = device.id }
function showDetail(device) { detailDevice.value = device; detailVisible.value = true }
function createWorkOrder() { ElMessage.success(`已为 ${detailDevice.value.name} 创建预防性维护工单`) }
function updateDevices() {
  devices.value.forEach((device) => {
    device.temperature = vary(device.temperature, device.id === 'RF-01' ? 6 : 1.8, device.id === 'RF-01' ? 0 : 1)
    device.pressure = vary(device.pressure, Math.max(.04, device.pressure * .025), 2)
    device.vibration = Math.max(.2, vary(device.vibration, .25, 1))
    device.load = Math.min(100, Math.max(30, vary(device.load, 3, 0)))
    const trend = trends.value[device.id]
    trend.temperature = [...trend.temperature.slice(1), device.temperature]
    trend.pressure = [...trend.pressure.slice(1), device.pressure]
    trend.vibration = [...trend.vibration.slice(1), device.vibration]
  })
}
const timer = window.setInterval(updateDevices, 3000)
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="equipment-page">
    <section class="page-header"><div><p>EQUIPMENT HEALTH MANAGEMENT</p><h2>生产设备状态分析</h2></div><div class="online"><i></i>工业仿真数据 <b>{{ runningCount }}/{{ devices.length }}</b></div></section>
    <section class="overview">
      <div><span>设备总数</span><strong>{{ devices.length }}<small>台/套</small></strong><el-icon><Cpu /></el-icon></div>
      <div><span>运行设备</span><strong class="green">{{ runningCount }}<small>台/套</small></strong><el-icon><VideoPlay /></el-icon></div>
      <div><span>预警设备</span><strong class="orange">{{ devices.filter(item=>item.status==='warning').length }}<small>台/套</small></strong><el-icon><Warning /></el-icon></div>
      <div><span>平均健康度</span><strong class="cyan">{{ averageHealth }}<small>分</small></strong><el-icon><Odometer /></el-icon></div>
    </section>
    <section class="toolbar"><div class="filter"><button v-for="type in types" :key="type" :class="{active:filterType===type}" @click="filterType=type">{{ type }}</button></div><span>最后更新：实时</span></section>
    <section class="device-grid"><EquipmentCard v-for="device in filteredDevices" :key="device.id" :device="device" :selected="selectedId===device.id" @select="selectDevice" @detail="showDetail" /></section>
    <section class="trend-panel"><header><div><i></i><h3>{{ selectedDevice.name }} · 状态趋势</h3><span>{{ selectedDevice.id }} REAL-TIME TREND</span></div><div class="current-values"><span>负载率 <b>{{ selectedDevice.load }}%</b></span><span>健康度 <b>{{ selectedDevice.health }}</b></span></div></header><BaseChart :option="chartOption" height="310px" /></section>

    <el-dialog v-model="detailVisible" width="660px" title="设备运行详情">
      <template v-if="detailDevice">
        <div class="detail-head"><div><small>{{ detailDevice.id }}</small><h3>{{ detailDevice.name }}</h3><p>{{ detailDevice.type }}</p></div><el-progress type="circle" :percentage="detailDevice.health" :width="92" :stroke-width="8" :color="detailDevice.health<85?'#e6a23c':'#20bfa9'"><template #default><b>{{ detailDevice.health }}</b><small>健康分</small></template></el-progress></div>
        <el-descriptions :column="2" border><el-descriptions-item label="运行状态"><el-tag :type="statusMap[detailDevice.status].type">{{ statusMap[detailDevice.status].label }}</el-tag></el-descriptions-item><el-descriptions-item label="累计运行">{{ detailDevice.runtime.toLocaleString() }} 小时</el-descriptions-item><el-descriptions-item label="实时温度">{{ detailDevice.temperature }} ℃</el-descriptions-item><el-descriptions-item label="系统压力">{{ detailDevice.pressure }} MPa</el-descriptions-item><el-descriptions-item label="振动速度">{{ detailDevice.vibration }} mm/s</el-descriptions-item><el-descriptions-item label="当前负载">{{ detailDevice.load }}%</el-descriptions-item><el-descriptions-item label="计划维护" :span="2">{{ detailDevice.maintenance }}</el-descriptions-item></el-descriptions>
        <el-alert v-if="detailDevice.status==='warning'" title="振动指标接近预警阈值，建议检查轧辊轴承与润滑状态。" type="warning" show-icon :closable="false" class="detail-alert" />
      </template>
      <template #footer><el-button @click="detailVisible=false">关闭</el-button><el-button type="primary" @click="createWorkOrder">创建维护工单</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.equipment-page{color:#dcecf7}.page-header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.online{color:#6e91aa;font-size:11px}.online i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.online b{margin-left:8px;color:#39cda0;font:14px Consolas}.overview{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}.overview>div{position:relative;min-height:82px;padding:15px 18px;overflow:hidden;background:linear-gradient(135deg,#0d3554,#092640);border:1px solid #214d6b}.overview span{display:block;color:#7293aa;font-size:10px}.overview strong{display:block;margin-top:7px;color:#dcecf7;font:600 25px Consolas}.overview small{margin-left:4px;color:#6d8da4;font:10px "Microsoft YaHei"}.overview .el-icon{position:absolute;right:18px;top:25px;color:#245f82;font-size:30px}.green{color:#2bd398!important}.orange{color:#ffad45!important}.cyan{color:#31c9df!important}.toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:8px 10px;background:#092840;border:1px solid #1e4865}.filter{display:flex;flex-wrap:wrap;gap:5px}.filter button{padding:6px 13px;color:#7899b0;cursor:pointer;background:transparent;border:1px solid transparent;font-size:11px}.filter button:hover,.filter button.active{color:#d9effb;background:#17496a;border-color:#286b92}.toolbar>span{color:#587a92;font-size:9px}.device-grid{display:grid;grid-template-columns:repeat(5,minmax(200px,1fr));gap:12px;margin-bottom:12px}.trend-panel{padding:15px 16px 4px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.trend-panel>header{height:34px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(55,107,142,.35)}.trend-panel header>div:first-child{display:flex;align-items:center;gap:9px}.trend-panel header i{width:3px;height:15px;background:#2bb7ec;box-shadow:0 0 8px #2bb7ec}.trend-panel h3{margin:0;color:#dceefa;font-size:14px}.trend-panel header span{color:#49748e;font:9px Consolas}.current-values{display:flex;gap:20px}.current-values span{color:#688ba3!important;font:10px "Microsoft YaHei"!important}.current-values b{margin-left:5px;color:#35c7e2;font:13px Consolas}.detail-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding:15px 20px;background:#f2f7fa}.detail-head small{color:#2985b9;font:11px Consolas}.detail-head h3{margin:4px 0;color:#263e52;font-size:18px}.detail-head p{margin:0;color:#8797a3;font-size:11px}.detail-head :deep(.el-progress__text){display:flex;flex-direction:column}.detail-head :deep(.el-progress__text b){font:600 21px Consolas}.detail-head :deep(.el-progress__text small){font-size:9px;color:#8496a3}.detail-alert{margin-top:15px}@media(max-width:1400px){.device-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.overview,.device-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.overview,.device-grid{grid-template-columns:1fr}.toolbar,.page-header{align-items:flex-start;flex-direction:column;gap:10px}}
</style>
