<script setup>
defineProps({ data: { type: Object, required: true }, analysis: { type: Object, required: true } })
</script>

<template>
  <section class="quality-card">
    <div class="identity"><small>{{ data.orderNo }}</small><h3>{{ data.batchId }}</h3><p>{{ data.steelGrade }} · {{ data.specification }}</p></div>
    <div class="inspection">
      <div><span>厚度偏差</span><b>{{ data.inspection.thicknessDeviation }}<small>mm</small></b></div>
      <div><span>表面缺陷率</span><b>{{ data.inspection.surfaceDefectRate }}<small>%</small></b></div>
      <div><span>板形指标</span><b>{{ data.inspection.flatness }}</b></div>
      <div><span>屈服强度</span><b>{{ data.inspection.mechanical.yieldStrength }}<small>MPa</small></b></div>
      <div><span>抗拉强度</span><b>{{ data.inspection.mechanical.tensileStrength }}<small>MPa</small></b></div>
    </div>
    <div class="evaluation"><el-progress type="dashboard" :percentage="analysis.qualityScore" :width="92" :stroke-width="8" :color="analysis.qualityLevel.color"><template #default><strong>{{ analysis.qualityScore }}</strong><small>质量评分</small></template></el-progress><div><span>质量等级</span><b :style="{ color: analysis.qualityLevel.color }">{{ analysis.qualityLevel.label }}</b><p>{{ analysis.analysisText }}</p></div></div>
    <div class="abnormal"><span>异常指标</span><template v-if="analysis.abnormalItems.length"><el-tag v-for="item in analysis.abnormalItems" :key="item" type="warning" size="small">{{ item }}</el-tag></template><b v-else>未发现超标指标</b><small>{{ analysis.dataMode }}</small></div>
    <div v-if="data.inspectionHistory?.length" class="history"><span>检测历史</span><div v-for="item in data.inspectionHistory" :key="item.taskId || item.time"><b>{{ item.type === 'reinspection' ? '复检' : '初检' }}</b><em>{{ item.score }}分 · {{ item.level }}</em><small>{{ item.time }}</small></div><i>质量复检演示 · 基于工业仿真数据</i></div>
  </section>
</template>

<style scoped>
.quality-card{display:grid;grid-template-columns:220px 1fr 270px;gap:18px;padding:15px 18px;background:linear-gradient(135deg,#0d3554,#092640);border:1px solid #235372}.identity{display:flex;justify-content:center;flex-direction:column}.identity small{color:#4898bf;font:9px Consolas}.identity h3{margin:4px 0;color:#50c5ff;font:600 18px Consolas}.identity p{margin:0;color:#7797aa;font-size:10px}.inspection{display:grid;grid-template-columns:repeat(5,1fr);align-items:center}.inspection>div{padding:5px 12px;border-left:1px solid #254f69}.inspection span{display:block;color:#6789a0;font-size:9px}.inspection b{display:block;margin-top:6px;color:#d7e9f3;font:600 16px Consolas}.inspection b small{margin-left:3px;color:#6c8da2;font-size:8px}.evaluation{display:flex;align-items:center;gap:15px}.evaluation :deep(.el-progress__text){display:flex;flex-direction:column}.evaluation :deep(.el-progress__text strong){font:600 21px Consolas}.evaluation :deep(.el-progress__text small){color:#7891a0;font-size:8px}.evaluation>div>span{color:#718fa3;font-size:9px}.evaluation>div>b{display:block;margin-top:3px;font-size:16px}.evaluation p{margin:4px 0 0;color:#5e8297;font-size:9px;line-height:1.5}.abnormal{grid-column:1/-1;display:flex;align-items:center;gap:7px;padding-top:10px;border-top:1px solid #244d67}.abnormal>span{color:#7898ab;font-size:9px}.abnormal>b{color:#2bd398;font-size:10px}.abnormal>small{margin-left:auto;color:#4b7187;font-size:8px}@media(max-width:1100px){.quality-card{grid-template-columns:200px 1fr}.evaluation{grid-column:1/-1}.inspection{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.quality-card{grid-template-columns:1fr}.inspection{grid-template-columns:repeat(2,1fr)}}
.history{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding-top:10px;border-top:1px solid #244d67}.history>span{color:#7898ab;font-size:9px}.history>div{display:flex;align-items:center;gap:6px;padding:5px 9px;background:#082238;border:1px solid #1b4662}.history b{color:#43bce9;font-size:9px}.history em{color:#c6dae5;font:10px Consolas;font-style:normal}.history small{color:#587b91;font-size:8px}.history>i{margin-left:auto;color:#4b7187;font-size:8px;font-style:normal}
</style>
