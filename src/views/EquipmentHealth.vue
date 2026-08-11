<script setup>
import { computed, ref } from 'vue'
import HealthDiagnosis from '@/components/equipment/HealthDiagnosis.vue'
import { equipmentList, statusMap } from '@/mock/equipment'
import { evaluateEquipmentList } from '@/equipmentHealth'

const devices = equipmentList.map((item) => ({ ...item }))
const selectedId = ref(devices[0].id)
const evaluations = computed(() => evaluateEquipmentList(devices))
const evaluationMap = computed(() => Object.fromEntries(evaluations.value.map((item) => [item.equipmentId, item])))
const selectedDevice = computed(() => devices.find((item) => item.id === selectedId.value) || devices[0])
const selectedEvaluation = computed(() => evaluationMap.value[selectedDevice.value.id])
</script>

<template>
  <div class="health-page">
    <section class="page-header">
      <div><p>EQUIPMENT HEALTH DIAGNOSIS</p><h2>设备健康管理</h2></div>
      <span><i></i>预测维护演示 · 基于工业仿真数据</span>
    </section>

    <section class="selector-panel">
      <div class="selector-title"><small>DIAGNOSIS OBJECT</small><h3>诊断设备选择</h3></div>
      <el-select v-model="selectedId" class="device-select" size="large">
        <el-option v-for="device in devices" :key="device.id" :label="`${device.id} · ${device.name}`" :value="device.id" />
      </el-select>
      <div class="selected-status">
        <span>设备类型 <b>{{ selectedDevice.type }}</b></span>
        <span>运行状态 <el-tag :type="statusMap[selectedDevice.status].type" size="small">{{ statusMap[selectedDevice.status].label }}</el-tag></span>
        <span>计划维护 <b>{{ selectedDevice.maintenance }}</b></span>
      </div>
    </section>

    <section class="score-panel">
      <div class="score-ring"><el-progress type="dashboard" :percentage="selectedEvaluation.score" :width="130" :stroke-width="10" :color="selectedEvaluation.level.color"><template #default><strong>{{ selectedEvaluation.score }}</strong><small>健康评分</small></template></el-progress></div>
      <div><span>健康等级</span><b :style="{ color: selectedEvaluation.level.color }">{{ selectedEvaluation.level.label }}</b></div>
      <div><span>未来24小时故障概率</span><b class="probability">{{ selectedEvaluation.failureProbability }}%</b></div>
      <div><span>识别风险因素</span><b>{{ selectedEvaluation.riskFactors.length }}<small> 项</small></b></div>
      <p>预测维护演示 · 基于工业仿真数据</p>
    </section>

    <HealthDiagnosis :device="selectedDevice" :evaluation="selectedEvaluation" />
  </div>
</template>

<style scoped>
.health-page{color:#dcecf7}.page-header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.page-header>span{color:#6e91aa;font-size:11px}.page-header i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.selector-panel{display:flex;align-items:center;gap:22px;padding:15px 18px;background:linear-gradient(135deg,#0d3554,#092640);border:1px solid #214d6b}.selector-title{min-width:130px}.selector-title small{color:#3d9ccb;font:9px Consolas;letter-spacing:1px}.selector-title h3{margin:4px 0 0;font-size:14px}.device-select{width:280px}.selected-status{display:flex;align-items:center;gap:24px;margin-left:auto}.selected-status span{color:#7091a7;font-size:10px}.selected-status b{display:block;margin-top:4px;color:#c9e1ef;font:11px Consolas}.score-panel{position:relative;display:grid;grid-template-columns:170px repeat(3,1fr);align-items:center;gap:1px;margin-top:12px;padding:14px;background:#092840;border:1px solid #1e4865}.score-panel>div:not(.score-ring){padding:16px 22px;border-left:1px solid #21465f}.score-panel span{display:block;color:#688ba3;font-size:10px}.score-panel b{display:block;margin-top:8px;color:#32d3ce;font:600 26px Consolas}.score-panel b small{font-size:10px}.score-panel .probability{color:#ffad45}.score-ring{display:flex;justify-content:center}.score-ring :deep(.el-progress__text){display:flex;flex-direction:column}.score-ring strong{font:600 27px Consolas}.score-ring small{margin-top:2px;color:#718da0;font-size:9px}.score-panel>p{position:absolute;right:14px;bottom:5px;margin:0;color:#496e85;font-size:8px}.health-page :deep(.health-diagnosis){margin-top:12px}@media(max-width:900px){.selector-panel{align-items:flex-start;flex-direction:column}.selected-status{margin-left:0;flex-wrap:wrap}.score-panel{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.score-panel{grid-template-columns:1fr}.score-panel>div:not(.score-ring){border-left:0;border-top:1px solid #21465f}}
</style>
