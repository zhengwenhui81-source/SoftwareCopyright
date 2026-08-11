<script setup>
import { computed } from 'vue'

const props = defineProps({
  records: { type: Array, required: true },
  selectedId: { type: String, required: true },
})
const emit = defineEmits(['select', 'generate-event'])

const selected = computed(() => props.records.find((item) => item.id === props.selectedId) || props.records[0])
const riskTagType = { 高风险: 'danger', 中风险: 'warning', 低风险: 'success' }
</script>

<template>
  <section class="prediction-content">
    <div class="panel table-panel">
      <header><div><i></i><h3>设备故障风险列表</h3><span>FAILURE RISK LIST</span></div><small>故障预测演示 · 基于工业仿真数据</small></header>
      <el-table :data="records" highlight-current-row :current-row-key="selectedId" row-key="id" @current-change="row => row && emit('select', row.id)">
        <el-table-column label="设备名称" min-width="170"><template #default="{ row }"><div class="device-cell"><small>{{ row.id }}</small><b>{{ row.name }}</b></div></template></el-table-column>
        <el-table-column prop="score" label="健康评分" width="92" align="center" />
        <el-table-column label="健康等级" width="92" align="center"><template #default="{ row }"><span :style="{ color: row.level.color }">{{ row.level.label }}</span></template></el-table-column>
        <el-table-column label="故障概率" width="100" align="center"><template #default="{ row }"><b class="probability">{{ row.failureProbability }}%</b></template></el-table-column>
        <el-table-column label="风险等级" width="96" align="center"><template #default="{ row }"><el-tag :type="riskTagType[row.riskLevel]" size="small">{{ row.riskLevel }}</el-tag></template></el-table-column>
        <el-table-column prop="riskSummary" label="主要风险因素" min-width="150" show-overflow-tooltip />
        <el-table-column prop="predictedFailure" label="预测故障类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="suggestion" label="建议措施" min-width="180" show-overflow-tooltip />
      </el-table>
    </div>

    <div v-if="selected" class="panel detail-panel">
      <header><div><i></i><h3>风险分析详情</h3><span>{{ selected.id }} RISK ANALYSIS</span></div><small>故障预测演示 · 基于工业仿真数据</small></header>
      <div class="detail-head">
        <div><small>{{ selected.id }} · {{ selected.type }}</small><h3>{{ selected.name }}</h3></div>
        <div><span>风险等级</span><el-tag :type="riskTagType[selected.riskLevel]">{{ selected.riskLevel }}</el-tag></div>
        <div><span>预测故障概率</span><b>{{ selected.failureProbability }}%</b></div>
      </div>
      <div class="detail-grid">
        <article><h4>当前参数</h4><ul><li>温度 <b>{{ selected.device.temperature }} ℃</b></li><li>压力 <b>{{ selected.device.pressure }} MPa</b></li><li>振动 <b>{{ selected.device.vibration }} mm/s</b></li><li>负载 <b>{{ selected.device.load }}%</b></li></ul></article>
        <article><h4>风险因素</h4><ul v-if="selected.riskFactors.length"><li v-for="risk in selected.riskFactors" :key="risk.key"><b>{{ risk.label }}</b>：{{ risk.value }} {{ risk.unit }} / 阈值 {{ risk.warningThreshold }} {{ risk.unit }}</li></ul><p v-else>当前参数未超过模拟预警阈值。</p></article>
        <article><h4>预测依据</h4><p>{{ selected.reason }}</p><p class="basis">健康评分 {{ selected.score }} 分，依据现有风险因素和工业仿真参数计算。</p></article>
        <article><h4>推荐措施</h4><p>{{ selected.suggestion }}</p><ul class="recommend"><li v-for="item in selected.recommendedChecks" :key="item">{{ item }}</li></ul></article>
      </div>
      <footer><span>风险部件：{{ selected.riskComponent }} · 本结果仅用于故障预测功能演示。</span><el-button type="warning" size="small" @click="emit('generate-event', selected)">生成风险事件</el-button></footer>
    </div>
  </section>
</template>

<style scoped>
.prediction-content{display:grid;gap:12px}.panel{background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;padding:0 14px;border-bottom:1px solid rgba(55,107,142,.35)}.panel header>div{display:flex;align-items:center;gap:8px}.panel header i{width:3px;height:15px;background:#2bb7ec;box-shadow:0 0 8px #2bb7ec}.panel header h3{margin:0;color:#dceefa;font-size:14px}.panel header span,.panel header small{color:#557a92;font:9px Consolas}.table-panel :deep(.el-table){--el-table-bg-color:transparent;--el-table-tr-bg-color:transparent;--el-table-header-bg-color:#0d3553;--el-table-row-hover-bg-color:#124464;--el-table-current-row-bg-color:#124464;--el-table-border-color:#20465f;--el-table-text-color:#b9d2e1;--el-table-header-text-color:#7599af;background:transparent}.device-cell{display:flex;flex-direction:column}.device-cell small{color:#408eb8;font:9px Consolas}.device-cell b{margin-top:3px;font-size:11px}.probability{color:#ffad45;font:600 14px Consolas}.detail-panel{padding-bottom:12px}.detail-head{display:grid;grid-template-columns:1fr 180px 180px;align-items:center;margin:12px;padding:13px 16px;background:#0d3552;border:1px solid #255875}.detail-head>div:not(:first-child){padding-left:20px;border-left:1px solid #28556f}.detail-head small{color:#4f91b5;font:9px Consolas}.detail-head h3{margin:4px 0 0;font-size:15px}.detail-head span{display:block;color:#6e91a7;font-size:9px}.detail-head b{display:block;margin-top:5px;color:#ffad45;font:600 20px Consolas}.detail-head .el-tag{margin-top:5px}.detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 12px}.detail-grid article{min-height:112px;padding:12px 14px;background:#09263e;border-left:2px solid #287ba6}.detail-grid h4{margin:0 0 9px;color:#8fc8e4;font-size:11px}.detail-grid p,.detail-grid li{color:#7595a8;font-size:10px;line-height:1.7}.detail-grid ul{margin:0;padding-left:17px}.detail-grid li b{color:#c4dce9}.basis{color:#53788e!important}.recommend{margin-top:5px!important}.detail-panel>footer{display:flex;align-items:center;justify-content:space-between;margin:10px 14px 0;color:#55778c;font-size:9px}@media(max-width:800px){.detail-head,.detail-grid{grid-template-columns:1fr}.detail-head>div:not(:first-child){padding:8px 0 0;border-left:0}.detail-grid article{min-height:0}}
</style>
