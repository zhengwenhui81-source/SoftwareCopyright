<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Connection, Refresh, Right } from '@element-plus/icons-vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { buildIndustrialKnowledgeGraph, getEntityDetail, getEntityNavigation } from '@/industrialRelation'

const router = useRouter()
const categoryColors = ['#36b9ed', '#2ed39b', '#ef6464', '#e66891', '#f1aa45']
const statusColors = { normal: '#2bd398', completed: '#2bd398', closed: '#6f8797', running: '#2cbee9', processing: '#2cbee9', waiting: '#607b8e', warning: '#e6a23c', recovery_pending: '#e6a23c', abnormal: '#ef5a5a' }
const graph = ref(buildIndustrialKnowledgeGraph())
const selectedCategory = ref('全部')
const selectedNodeId = ref(graph.value.nodes[0]?.id || '')
const search = ref('')
const isDev = import.meta.env.DEV
const devScenario = ref({ state: 'not_injected', label: '未注入', injected: false })
const devScenarioBusy = ref(false)

const selectedNode = computed(() => getEntityDetail(selectedNodeId.value, graph.value))
const selectedNavigation = computed(() => getEntityNavigation(selectedNode.value))
const selectedIsDevTest = computed(() => isDev && /KG-TEST|开发测试/.test(`${selectedNode.value?.businessId || ''}${selectedNode.value?.name || ''}`))
const visibleNodes = computed(() => graph.value.nodes.filter((node) => (selectedCategory.value === '全部' || node.domain === selectedCategory.value) && (!search.value || `${node.name}${node.businessId}`.toLowerCase().includes(search.value.toLowerCase()))))
const visibleIds = computed(() => new Set(visibleNodes.value.map((node) => node.id)))
const visibleLinks = computed(() => graph.value.links.filter((link) => visibleIds.value.has(link.source) && visibleIds.value.has(link.target)))
const relatedIds = computed(() => {
  if (!selectedNode.value) return new Set()
  const ids = new Set([selectedNode.value.id])
  selectedNode.value.relations.forEach((item) => ids.add(item.related?.id))
  return ids
})
const graphOption = computed(() => ({
  tooltip: { formatter: (params) => params.dataType === 'node' ? `<b>${params.data.name}</b><br/>${params.data.type}<br/>${params.data.statusLabel}` : params.data?.label || '关联' },
  legend: [{ data: graph.value.categories.map((item) => item.name), bottom: 8, textStyle: { color: '#88a3b7' } }],
  series: [{
    type: 'graph', layout: 'force', roam: true, draggable: true,
    data: visibleNodes.value.map((node) => {
      const focused = !selectedNodeId.value || relatedIds.value.has(node.id)
      const color = statusColors[node.status] || categoryColors[node.category]
      return { ...node, value: node.statusLabel, itemStyle: { color, opacity: focused ? (node.historical ? 0.5 : 1) : 0.16, borderColor: node.id === selectedNodeId.value ? '#ffffff' : color, borderWidth: node.id === selectedNodeId.value ? 3 : 1, shadowBlur: focused ? 12 : 0, shadowColor: `${color}66` }, label: { opacity: focused ? 1 : 0.2 } }
    }),
    links: visibleLinks.value.map((link) => ({ ...link, lineStyle: { opacity: !selectedNodeId.value || (relatedIds.value.has(link.source) && relatedIds.value.has(link.target)) ? 0.65 : 0.08, width: link.source === selectedNodeId.value || link.target === selectedNodeId.value ? 2 : 1 } })),
    categories: graph.value.categories, force: { repulsion: 420, edgeLength: [90, 190], gravity: 0.05 },
    label: { show: true, color: '#e7f4fb', fontSize: 10 }, edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 7,
    lineStyle: { color: '#4c7792', opacity: 0.45, curveness: 0.08 }, edgeLabel: { show: true, formatter: (params) => params.data?.label || '关联', color: '#7897aa', fontSize: 8 },
  }],
}))

function handleClick(params) { if (params.dataType === 'node') selectedNodeId.value = params.data.id }
function clearHighlight() { selectedNodeId.value = '' }
function refreshGraph() {
  const previous = selectedNodeId.value
  graph.value = buildIndustrialKnowledgeGraph()
  selectedNodeId.value = graph.value.nodes.some((item) => item.id === previous) ? previous : graph.value.nodes[0]?.id || ''
}
function navigateToEntity() { if (selectedNavigation.value) router.push(selectedNavigation.value.path) }

async function loadDevScenarioModule() {
  if (!isDev) return null
  return import('@/devKnowledgeGraphScenario.js')
}

async function refreshDevScenarioState() {
  const module = await loadDevScenarioModule()
  if (module) devScenario.value = module.getKnowledgeGraphTestScenarioState()
}

async function runDevScenario(method, successText) {
  if (!isDev || devScenarioBusy.value) return
  devScenarioBusy.value = true
  try {
    const module = await loadDevScenarioModule()
    const result = await module?.[method]?.()
    await refreshDevScenarioState()
    refreshGraph()
    if (result?.updated) ElMessage.success(successText)
    else ElMessage.warning(`场景操作未执行：${result?.reason || '状态不满足'}`)
  } finally {
    devScenarioBusy.value = false
  }
}

if (isDev) refreshDevScenarioState()
</script>
<template>
  <div class="kg-page">
    <section class="page-header"><div><p>INDUSTRIAL ONTOLOGY KNOWLEDGE GRAPH</p><h2>工业本体知识图谱</h2></div><div class="stats"><span>当前批次 <b>{{ graph.summary.batchId }}</b></span><span>实体 <b>{{ graph.summary.entityCount }}</b></span><span>关系 <b>{{ graph.summary.relationCount }}</b></span><span>活动风险 <b>{{ graph.summary.activeRiskCount }}</b></span><span>待恢复确认 <b>{{ graph.summary.recoveryPendingCount }}</b></span></div></section>
    <nav class="layer-nav"><span>业务实体筛选</span><button :class="{ active: selectedCategory === '全部' }" @click="selectedCategory = '全部'"><i></i>全部</button><button v-for="(item,index) in graph.categories" :key="item.key" :class="{ active: selectedCategory === item.key }" :style="{ '--layer-color': categoryColors[index] }" @click="selectedCategory = item.key"><i></i>{{ item.name }}</button></nav>
    <section v-if="isDev" class="dev-scenario-panel">
      <div><strong>知识图谱业务状态测试注入器</strong><span>仅开发环境显示 · 当前阶段：{{ devScenario.label }}</span></div>
      <div class="dev-scenario-actions">
        <el-button size="small" type="danger" :loading="devScenarioBusy" :disabled="devScenario.state !== 'not_injected'" @click="runDevScenario('injectFinishingAbnormalScenario', '已注入精轧当前异常场景')">注入精轧当前异常</el-button>
        <el-button size="small" type="warning" :loading="devScenarioBusy" :disabled="devScenario.state !== 'current_abnormal'" @click="runDevScenario('setFinishingRecoveryPendingScenario', '已进入待恢复确认场景')">恢复参数并进入待确认</el-button>
        <el-button size="small" type="success" :loading="devScenarioBusy" :disabled="devScenario.state !== 'recovery_pending'" @click="runDevScenario('closeFinishingTestScenario', '测试报警与生产事件已关闭')">关闭测试场景</el-button>
        <el-button size="small" :loading="devScenarioBusy" :disabled="devScenario.state === 'not_injected'" @click="runDevScenario('cleanupKnowledgeGraphTestScenario', '测试数据已清理并恢复原始参数')">清理知识图谱测试数据</el-button>
      </div>
    </section>
    <section class="workspace">
      <article class="graph-panel">
        <header><div><i></i><h3>当前业务状态工业关系图谱</h3><span>DYNAMIC BUSINESS ONTOLOGY</span></div><div class="graph-actions"><el-input v-model="search" size="small" clearable prefix-icon="Search" placeholder="搜索实体名称或ID" /><el-button size="small" @click="clearHighlight">清除高亮</el-button><el-button type="primary" size="small" :icon="Refresh" @click="refreshGraph">刷新图谱</el-button></div></header>
        <el-alert v-if="!graph.summary.hasActiveRelations" title="当前无活动异常关系，图谱继续展示当前批次、工序、参数、设备与质量结果。" type="success" :closable="false" />
        <BaseChart :option="graphOption" height="650px" @chart-click="handleClick" />
        <div class="tips">滚轮缩放 · 拖动画布与节点 · 点击节点追踪直接关系</div>
      </article>
      <aside>
        <header><i></i><h3>实体业务详情</h3></header>
        <template v-if="selectedNode">
          <div class="node-profile"><span :style="{ background: statusColors[selectedNode.status] }">{{ selectedNode.statusLabel }}</span><b v-if="selectedIsDevTest" class="dev-test-badge">DEV TEST</b><h2>{{ selectedNode.name }}</h2><small>{{ selectedNode.type }} · {{ selectedNode.businessId }}</small></div>
          <h4>基础信息</h4><dl class="basic-info"><div><dt>实体类型</dt><dd>{{ selectedNode.type }}</dd></div><div><dt>业务ID</dt><dd>{{ selectedNode.businessId }}</dd></div><div><dt>当前状态</dt><dd>{{ selectedNode.statusLabel }}</dd></div><div><dt>关联实体</dt><dd>{{ selectedNode.relationCount }}</dd></div></dl>
          <h4>核心属性</h4><dl><div v-for="(value,key) in selectedNode.properties" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div></dl>
          <h4>关联关系</h4><div class="relations"><div v-for="relation in selectedNode.relations" :key="`${relation.source}-${relation.target}-${relation.label}`"><span>{{ relation.direction === 'outgoing' ? selectedNode.name : relation.related?.name }} → {{ relation.direction === 'outgoing' ? relation.related?.name : selectedNode.name }}</span><em>{{ relation.label }}</em></div><el-empty v-if="!selectedNode.relations.length" description="暂无可靠关联关系" :image-size="45" /></div>
          <el-button v-if="selectedNavigation" class="navigate-button" type="primary" @click="navigateToEntity">{{ selectedNavigation.label }}<el-icon><Right /></el-icon></el-button>
        </template>
        <el-empty v-else description="点击节点查看业务详情" :image-size="70" />
        <div class="ontology-note"><el-icon><Connection /></el-icon><p><b>工业本体动态建模演示</b><span>{{ graph.dataMode }}，不连接真实知识图谱数据库。</span></p></div>
      </aside>
    </section>
  </div>
</template>
<style scoped>
.kg-page{color:#dcecf7}.page-header{display:flex;justify-content:space-between;align-items:center;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.stats{display:flex;gap:25px}.stats span{color:#6c8ca2;font-size:10px}.stats b{margin-left:6px;color:#40b8e9;font:16px Consolas}.workspace{display:grid;grid-template-columns:1fr 290px;gap:12px}.graph-panel,aside{position:relative;padding:15px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.graph-panel>header{height:40px;display:flex;justify-content:space-between;border-bottom:1px solid #173e58}.graph-panel header>div{display:flex;align-items:center;gap:8px}.graph-panel header>div:last-child{width:360px}.graph-panel header .el-select{width:130px}.graph-panel header i,aside header i{width:3px;height:15px;background:#2bb7ec}.graph-panel h3,aside h3{margin:0;color:#dceefa;font-size:14px}.graph-panel header span{color:#49748e;font:9px Consolas}.tips{position:absolute;left:20px;bottom:17px;color:#496f87;font-size:9px}aside header{display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid #173e58}.node-profile{padding:20px 5px;border-bottom:1px solid #173e58}.node-profile>span{padding:4px 8px;color:#fff;font-size:9px}.node-profile h2{margin:12px 0 4px;color:#eef9ff}.node-profile small{color:#4b738b;font:9px Consolas}aside h4{margin:18px 0 9px;color:#7da0b5;font-size:11px}dl{margin:0}dl>div{display:flex;justify-content:space-between;padding:8px;background:#0a2942;border-bottom:1px solid #173e58;font-size:10px}dt{color:#63869d}dd{margin:0;color:#b7cfdd}.relations{max-height:170px;overflow:auto}.relations>div{display:flex;justify-content:space-between;padding:7px 9px;margin-bottom:4px;background:#0e3551;color:#9db8c8;font-size:10px}.relations em{color:#39afd9;font-style:normal}.ontology-note{display:flex;gap:10px;padding:12px;margin-top:18px;color:#3eb4df;background:rgba(38,144,191,.08);border:1px solid #245873}.ontology-note .el-icon{font-size:22px}.ontology-note p{display:flex;flex-direction:column;margin:0}.ontology-note b{font-size:10px}.ontology-note span{margin-top:4px;color:#65889e;font-size:9px;line-height:1.5}@media(max-width:900px){.workspace{grid-template-columns:1fr}.stats{display:none}}
.layer-nav{display:flex;align-items:center;gap:7px;padding:8px 12px;margin-bottom:10px;background:#092840;border:1px solid #1e4865}.layer-nav>span{margin-right:8px;color:#5d8198;font-size:9px}.layer-nav button{--layer-color:#35a9e9;display:flex;align-items:center;gap:5px;padding:5px 10px;color:#7899ae;cursor:pointer;background:transparent;border:1px solid transparent;font-size:9px}.layer-nav button i{width:6px;height:6px;border-radius:50%;background:var(--layer-color)}.layer-nav button:hover,.layer-nav button.active{color:#dceef8;background:#103b58;border-color:var(--layer-color)}.basic-info{border:1px solid #21506d}
.graph-panel header .graph-actions{width:auto;min-width:520px}.graph-actions .el-input{width:230px}.navigate-button{width:100%;margin-top:14px}.node-profile>span{display:inline-block}.relations span{max-width:185px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stats{flex-wrap:wrap;justify-content:flex-end}.stats span:first-child b{font-size:12px}@media(max-width:1200px){.graph-panel header .graph-actions{min-width:0}.graph-actions .el-input{width:180px}}
.dev-scenario-panel{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 12px;margin-bottom:10px;background:rgba(230,162,60,.08);border:1px dashed #9b7136}.dev-scenario-panel>div:first-child{display:flex;flex-direction:column;gap:3px}.dev-scenario-panel strong{color:#f0b75f;font-size:12px}.dev-scenario-panel span{color:#8ea7b7;font-size:9px}.dev-scenario-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.dev-scenario-actions .el-button+.el-button{margin-left:0}.dev-test-badge{display:inline-block;padding:3px 6px;margin-left:6px;color:#071f34;background:#f0b75f;font:9px Consolas}.node-profile>span+.dev-test-badge{vertical-align:top}@media(max-width:1100px){.dev-scenario-panel{align-items:flex-start;flex-direction:column}.dev-scenario-actions{justify-content:flex-start}}
</style>
