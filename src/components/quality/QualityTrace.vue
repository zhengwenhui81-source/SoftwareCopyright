<script setup>
import { computed } from 'vue'
import { equipmentList } from '@/mock/equipment'
import { getProcessParameters } from '@/processParameter'
import { getProductionBatch, getProductionPlans } from '@/productionPlan'

const props = defineProps({ quality: { type: Object, required: true }, analysis: { type: Object, required: true } })
const batch = computed(() => getProductionBatch(props.quality.batchId))
const plan = computed(() => getProductionPlans().find((item) => item.id === batch.value?.planId))
const traceProcess = computed(() => props.analysis.abnormalItems.some((item) => item.includes('板形')) ? '控冷' : '精轧')
const processRecord = computed(() => getProcessParameters(props.quality.batchId, traceProcess.value))
const equipmentId = computed(() => traceProcess.value === '控冷' ? 'ACC-01' : 'FM-01')
const equipment = computed(() => equipmentList.find((item) => item.id === equipmentId.value))
const keyParameter = computed(() => {
  const record = processRecord.value
  if (record?.process === '精轧') return `轧制压力 ${record.parameters.rollingPressure} kN`
  if (record?.process === '控冷') return `终冷温度 ${record.parameters.finishCoolingTemperature} ℃`
  return `厚度偏差 ${props.quality.inspection.thicknessDeviation} mm（检测结果）`
})
const nodes = computed(() => [
  { title: '生产订单', value: plan.value?.orderNo || '未关联订单', icon: 'Document' },
  { title: '生产批次', value: batch.value?.batchId || props.quality.batchId, icon: 'CollectionTag' },
  { title: '关键工序', value: traceProcess.value, icon: 'Operation' },
  { title: '关键参数', value: keyParameter.value, icon: 'DataAnalysis' },
  { title: '关联设备', value: equipment.value ? `${equipment.value.id} ${equipment.value.name}` : '暂无关联设备', icon: 'Setting' },
  { title: '质量结果', value: `${props.analysis.qualityLevel.label} · ${props.analysis.qualityScore}分 · 厚度偏差${props.quality.inspection.thicknessDeviation}mm`, icon: 'CircleCheck' },
])
</script>

<template>
  <section class="trace-panel">
    <header><div><i></i><h3>质量形成追溯</h3><span>QUALITY FORMATION TRACE</span></div><small>质量分析演示 · 基于工业仿真数据</small></header>
    <div v-if="batch" class="trace-chain"><template v-for="(node, index) in nodes" :key="node.title"><article><el-icon><component :is="node.icon" /></el-icon><span>{{ node.title }}</span><b>{{ node.value }}</b></article><div v-if="index < nodes.length - 1" class="arrow"><el-icon><Right /></el-icon></div></template></div>
    <el-empty v-else description="暂无可追溯的生产批次数据" :image-size="60" />
    <footer>关联路径：生产计划 → 批次 → 工序参数 → 设备 → 质量检测结果</footer>
  </section>
</template>

<style scoped>
.trace-panel{padding:0 14px 12px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.trace-panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;border-bottom:1px solid rgba(55,107,142,.35)}.trace-panel header>div{display:flex;align-items:center;gap:8px}.trace-panel header i{width:3px;height:15px;background:#2bd398;box-shadow:0 0 8px #2bd398}.trace-panel h3{margin:0;font-size:14px}.trace-panel header span,.trace-panel header small{color:#55798f;font:9px Consolas}.trace-chain{display:flex;align-items:stretch;padding:14px 0}.trace-chain article{display:flex;align-items:center;justify-content:center;flex:1;min-width:0;flex-direction:column;padding:12px 8px;text-align:center;background:#092a43;border:1px solid #24516d}.trace-chain article>.el-icon{color:#39b9e8;font-size:20px}.trace-chain span{margin-top:6px;color:#63899f;font-size:9px}.trace-chain b{margin-top:5px;color:#c5dce8;font-size:10px;line-height:1.45}.arrow{display:grid;place-items:center;width:25px;color:#3d7897}.trace-panel footer{color:#4c7187;text-align:right;font-size:8px}@media(max-width:1000px){.trace-chain{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.arrow{display:none}}@media(max-width:600px){.trace-chain{grid-template-columns:1fr}}
</style>
