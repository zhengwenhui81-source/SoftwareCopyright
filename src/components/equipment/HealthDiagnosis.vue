<script setup>
defineProps({
  device: { type: Object, required: true },
  evaluation: { type: Object, required: true },
})

const riskLabels = { high: '高', medium: '中', low: '低' }
const riskTagTypes = { high: 'danger', medium: 'warning', low: 'success' }
</script>

<template>
  <section class="health-diagnosis">
    <header>
      <div><span>HEALTH DIAGNOSIS</span><h3>设备健康诊断</h3></div>
      <p>预测维护演示 · 基于工业仿真数据</p>
    </header>

    <div class="summary">
      <div><span>设备名称</span><b>{{ device.name }}</b></div>
      <div><span>设备编号</span><b>{{ device.id }}</b></div>
      <div><span>健康评分</span><b :style="{ color: evaluation.level.color }">{{ evaluation.score }} 分</b></div>
      <div><span>健康等级</span><b :style="{ color: evaluation.level.color }">{{ evaluation.level.label }}</b></div>
      <div><span>故障概率</span><b class="probability">{{ evaluation.failureProbability }}%</b></div>
    </div>

    <div class="section-title">风险因素分析</div>
    <div v-if="evaluation.riskFactors.length" class="risk-list">
      <article v-for="risk in evaluation.riskFactors" :key="risk.key">
        <div class="risk-name"><b>{{ risk.label }}</b><el-tag size="small" :type="riskTagTypes[risk.severity]">{{ riskLabels[risk.severity] || '低' }}风险</el-tag></div>
        <div class="risk-values"><span>当前值 <b>{{ risk.value }} {{ risk.unit }}</b></span><span>预警阈值 <b>{{ risk.warningThreshold }} {{ risk.unit }}</b></span></div>
        <p>{{ risk.description }}，建议持续关注该指标变化趋势。</p>
      </article>
    </div>
    <el-alert v-else title="当前关键参数均处于模拟预警阈值范围内。" type="success" show-icon :closable="false" />

    <div class="section-title">模拟诊断结论</div>
    <div class="conclusion">
      <div><span>主要异常</span><b>{{ evaluation.diagnosis.mainAbnormality }}</b></div>
      <div><span>可能风险部件</span><b>{{ evaluation.diagnosis.possibleRiskComponent }}</b></div>
      <div class="checks"><span>建议检查项目</span><ul><li v-for="item in evaluation.diagnosis.recommendedChecks" :key="item">{{ item }}</li></ul></div>
    </div>
    <footer>本诊断仅用于工业软件功能演示，不代表真实设备故障预测结果。</footer>
  </section>
</template>

<style scoped>
.health-diagnosis{margin-top:16px;padding:14px;background:#eef5f8;border:1px solid #cfdee6;color:#334e60}.health-diagnosis>header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:12px}.health-diagnosis header span{color:#2385b5;font:9px Consolas;letter-spacing:1.5px}.health-diagnosis h3{margin:2px 0 0;font-size:15px}.health-diagnosis header p{margin:0;color:#718a99;font-size:10px}.summary{display:grid;grid-template-columns:1.6fr 1fr repeat(3,.8fr);gap:1px;background:#cbdce5;border:1px solid #cbdce5}.summary>div{padding:9px 10px;background:#fff}.summary span,.conclusion span{display:block;color:#8295a1;font-size:9px}.summary b{display:block;margin-top:4px;color:#29485b;font:600 12px Consolas}.summary .probability{color:#e38a2f}.section-title{margin:14px 0 8px;padding-left:7px;border-left:3px solid #299ed2;color:#31566d;font-size:12px;font-weight:600}.risk-list{display:grid;gap:7px}.risk-list article{padding:10px 12px;background:#fff;border-left:3px solid #e5a13c}.risk-name{display:flex;align-items:center;justify-content:space-between}.risk-name>b{font-size:12px}.risk-values{display:flex;gap:28px;margin-top:7px;color:#728895;font-size:10px}.risk-values b{margin-left:4px;color:#385b70;font:600 11px Consolas}.risk-list p{margin:6px 0 0;color:#637d8d;font-size:10px}.conclusion{display:grid;grid-template-columns:1fr 1.3fr;gap:8px}.conclusion>div{padding:10px 12px;background:#fff;border:1px solid #d7e4ea}.conclusion b{display:block;margin-top:5px;color:#315469;font-size:11px}.conclusion .checks{grid-column:1/-1}.checks ul{display:flex;flex-wrap:wrap;gap:6px 24px;margin:7px 0 0;padding-left:18px;color:#45687d;font-size:10px}.health-diagnosis>footer{margin-top:10px;color:#8a9ba5;text-align:right;font-size:9px}@media(max-width:700px){.summary{grid-template-columns:repeat(2,1fr)}.conclusion{grid-template-columns:1fr}.conclusion .checks{grid-column:auto}}
</style>
