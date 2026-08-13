<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getDefectAnalysis, QUALITY_DATA_CHANGED } from '@/qualityData'

const props = defineProps({ batchId: { type: String, required: true } })
const revision = ref(0)
const defects = computed(() => { revision.value; return getDefectAnalysis(props.batchId) })
function refreshDefects() { revision.value += 1 }
onMounted(() => window.addEventListener(QUALITY_DATA_CHANGED, refreshDefects))
onBeforeUnmount(() => window.removeEventListener(QUALITY_DATA_CHANGED, refreshDefects))
const riskMap = { high: { label: '高风险', type: 'danger' }, medium: { label: '中风险', type: 'warning' }, low: { label: '低风险', type: 'success' } }
</script>

<template>
  <section class="defect-panel">
    <header><div><i></i><h3>质量缺陷分析</h3><span>QUALITY DEFECT ANALYSIS</span></div><small>质量分析演示 · 基于工业仿真数据</small></header>
    <div v-if="defects.length" class="defect-grid">
      <article v-for="item in defects" :key="item.key" :class="`risk-${item.riskLevel}`">
        <div class="defect-head"><div><small>{{ item.key.toUpperCase() }}</small><h4>{{ item.name }}</h4></div><el-tag :type="riskMap[item.riskLevel].type" size="small">{{ riskMap[item.riskLevel].label }}</el-tag></div>
        <div class="numbers"><span>缺陷数量 <b>{{ item.count }}</b><small>项</small></span><span>缺陷占比 <b>{{ item.percentage }}</b><small>%</small></span></div>
        <div class="cause"><span>可能原因</span><ul><li v-for="cause in item.causes" :key="cause">{{ cause }}</li></ul></div>
      </article>
    </div>
    <el-empty v-else description="暂无缺陷分析数据" :image-size="60" />
  </section>
</template>

<style scoped>
.defect-panel{padding:0 14px 14px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.defect-panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;border-bottom:1px solid rgba(55,107,142,.35)}.defect-panel header>div{display:flex;align-items:center;gap:8px}.defect-panel header i{width:3px;height:15px;background:#ffad45;box-shadow:0 0 8px #ffad45}.defect-panel h3{margin:0;font-size:14px}.defect-panel header span,.defect-panel header small{color:#55798f;font:9px Consolas}.defect-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding-top:12px}.defect-grid article{padding:12px 13px;background:#09263e;border-top:2px solid #2bd398}.defect-grid article.risk-medium{border-color:#ffad45}.defect-grid article.risk-high{border-color:#ef6262}.defect-head{display:flex;align-items:center;justify-content:space-between}.defect-head small{color:#477992;font:8px Consolas}.defect-head h4{margin:3px 0 0;color:#cce2ed;font-size:12px}.numbers{display:grid;grid-template-columns:repeat(2,1fr);margin-top:10px;padding:9px 0;border-top:1px solid #183f59;border-bottom:1px solid #183f59}.numbers span{color:#668aa0;font-size:9px}.numbers b{margin-left:4px;color:#43bee9;font:600 18px Consolas}.numbers small{margin-left:2px;color:#55788e;font-size:8px}.cause{margin-top:9px}.cause>span{color:#688ba0;font-size:9px}.cause ul{margin:5px 0 0;padding-left:16px;color:#8ca7b7;font-size:9px;line-height:1.7}@media(max-width:1100px){.defect-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.defect-grid{grid-template-columns:1fr}}
</style>
