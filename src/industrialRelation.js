import { getProductionBatch, getProductionPlans } from './productionPlan.js'
import { analyzeParameterStatus, getProcessParameters, processParameterRules } from './processParameter.js'
import { getProductionEvents } from './productionEvent.js'
import { getProductionAdjustments } from './productionAdjustment.js'
import { evaluateEquipmentHealth } from './equipmentHealth.js'
import { getEquipmentEvents } from './equipmentEvent.js'
import { getMaintenanceOrders } from './maintenance.js'
import { equipmentList } from './mock/equipment.js'
import { analyzeQualityStatus, getBatchQuality } from './qualityData.js'
import { getQualityEvents } from './qualityEvent.js'
import { getQualityInspectionTasks } from './qualityInspection.js'
import { getAlarmEvents } from './alarmEvent.js'

export const processEquipmentRelations = {
  steelmaking: { processName: '炼钢与连铸', equipmentId: '' }, heating: { processName: '板坯加热', equipmentId: 'RF-01' },
  roughing: { processName: '粗轧', equipmentId: 'RM-01' }, finishing: { processName: '精轧', equipmentId: 'FM-01' },
  cooling: { processName: '控冷', equipmentId: 'ACC-01' }, straightening: { processName: '矫直', equipmentId: '' },
  inspection: { processName: '质量检测', equipmentId: 'UT-01' }, storage: { processName: '入库', equipmentId: '' },
}
export function getEquipmentIdByProcess(processId, processName) { return processEquipmentRelations[processId]?.equipmentId || Object.values(processEquipmentRelations).find((item) => item.processName === processName)?.equipmentId || '' }

export const industrialGraphCategories = [{ name: '生产', key: 'production' }, { name: '设备', key: 'equipment' }, { name: '报警', key: 'alarm' }, { name: '质量', key: 'quality' }, { name: '处置', key: 'disposal' }]
const categoryIndex = Object.fromEntries(industrialGraphCategories.map((item, index) => [item.key, index]))
const processDefinitions = Object.entries(processEquipmentRelations).map(([id, item]) => ({ id, name: item.processName, equipmentId: item.equipmentId }))
const activeAlarmStatuses = new Set(['new', 'acknowledged', 'processing', 'recovery_pending'])
const terminalStatuses = new Set(['closed', 'cancelled', 'completed'])
const clone = (value) => JSON.parse(JSON.stringify(value))
const timestamp = (value) => Date.parse(String(value || '').replace(' ', 'T')) || 0
const newestFirst = (a, b) => timestamp(b.updateTime || b.completeTime || b.createTime) - timestamp(a.updateTime || a.completeTime || a.createTime)
const entityId = (type, id) => `${type}:${id}`
const statusLabels = { normal: '正常', warning: '风险关注', abnormal: '当前异常', recovery_pending: '待恢复确认', closed: '已关闭', completed: '已完成', processing: '处理中', running: '运行中', waiting: '待运行' }

function processBaseStatus(batch, id, index) {
  if (batch?.runtime?.baseStatuses?.[id]) return batch.runtime.baseStatuses[id]
  if (batch?.processStatus === 'completed' || Number(batch?.progress) >= 100) return 'completed'
  const current = processDefinitions.findIndex((item) => item.name === batch?.currentProcess)
  return current < 0 ? 'waiting' : index < current ? 'completed' : index === current ? 'running' : 'waiting'
}
function eventStatus(status) { return terminalStatuses.has(status) ? 'closed' : ['recovery_pending', 'verification_pending'].includes(status) ? 'recovery_pending' : ['processing', 'confirmed', 'inspecting', 'in_progress', 'scheduled'].includes(status) ? 'processing' : 'abnormal' }
function recentWithActive(records, active, limit = 3) { return [...records.filter(active), ...records.filter((item) => !active(item)).sort(newestFirst).slice(0, limit)] }
function addNode(nodes, input) {
  if (!input.businessId) return null
  const id = entityId(input.type, input.businessId); const existing = nodes.find((item) => item.id === id); if (existing) return existing
  const node = { id, businessId: input.businessId, name: input.name || input.businessId, type: input.type, domain: input.domain, category: categoryIndex[input.domain], status: input.status || 'normal', statusLabel: statusLabels[input.status] || input.status || '正常', historical: Boolean(input.historical), symbolSize: input.symbolSize || 43, properties: clone(input.properties || {}), navigation: input.navigation || '' }
  nodes.push(node); return node
}
function addLink(links, source, target, label) { if (source && target && source !== target && !links.some((item) => item.source === source && item.target === target && item.label === label)) links.push({ source, target, name: label, label, value: label }) }

export function buildIndustrialKnowledgeGraph() {
  const nodes = [], links = []
  const batch = getProductionBatch(), batchId = batch?.batchId || '', plan = getProductionPlans().find((item) => item.id === batch?.planId)
  const alarms = recentWithActive(getAlarmEvents().filter((item) => !batchId || !item.batchId || item.batchId === batchId), (item) => activeAlarmStatuses.has(item.status), 5)
  const activeAlarms = alarms.filter((item) => activeAlarmStatuses.has(item.status))
  const productionEventsAll = getProductionEvents().filter((item) => !batchId || item.batchId === batchId)
  const equipmentEventsAll = getEquipmentEvents()
  const unreportedParameterRisks = []
  const batchNode = batch && addNode(nodes, { type: 'batch', businessId: batchId, name: batchId, domain: 'production', status: batch.processStatus === 'completed' ? 'completed' : 'running', symbolSize: 68, navigation: '/production', properties: { 当前订单: plan?.orderNo || '暂无', 钢种: batch.steelGrade, 规格: batch.specification, 生产进度: `${batch.progress}%`, 当前工序: batch.processStatus === 'completed' ? '全部完成' : batch.currentProcess, 生产状态: batch.processStatus } })

  const processNodes = new Map(), parameterNodes = new Map()
  processDefinitions.forEach((process, index) => {
    const record = getProcessParameters(batchId, process.name), statuses = analyzeParameterStatus(record), abnormal = statuses.some((item) => item.status !== '正常')
    const relatedAlarms = activeAlarms.filter((item) => item.processId === process.id || item.processName === process.name)
    const relatedProductionEvents = productionEventsAll.filter((item) => (item.processId === process.id || item.process === process.name) && !terminalStatuses.has(item.status))
    const currentProductionRisks = [...relatedAlarms, ...relatedProductionEvents].filter((item) => item.status !== 'recovery_pending')
    const recoveryRisks = [...relatedAlarms, ...relatedProductionEvents].filter((item) => item.status === 'recovery_pending')
    const equipmentRisks = equipmentEventsAll.filter((item) => item.equipmentId === process.equipmentId && !terminalStatuses.has(item.status))
    const baseStatus = processBaseStatus(batch, process.id, index)
    const status = abnormal || currentProductionRisks.length ? 'abnormal' : recoveryRisks.length ? 'recovery_pending' : equipmentRisks.length ? 'warning' : baseStatus
    const riskReason = abnormal ? '当前参数越界' : currentProductionRisks.length ? '活动生产异常' : recoveryRisks.length ? '待恢复确认' : equipmentRisks.length ? '关联设备风险' : '无活动风险'
    const riskSources = [...currentProductionRisks, ...recoveryRisks, ...equipmentRisks].map((item) => item.id).filter(Boolean)
    const processNode = addNode(nodes, { type: 'process', businessId: process.id, name: process.name, domain: 'production', status, symbolSize: 50, navigation: '/production', properties: { 工序编号: process.id, 基础状态: statusLabels[baseStatus], 当前风险: statusLabels[status], 风险说明: riskReason, 风险来源: riskSources.join('、') || '暂无', 当前异常参数: statuses.filter((item) => item.status !== '正常').length, 关联设备: process.equipmentId || '暂无' } })
    processNodes.set(process.id, processNode); addLink(links, batchNode?.id, processNode.id, '包含工序')
    statuses.forEach((parameter) => {
      const businessId = `${batchId}:${process.id}:${parameter.key}`
      const node = addNode(nodes, { type: 'parameter', businessId, name: parameter.name, domain: 'production', status: parameter.status === '正常' ? 'normal' : 'abnormal', navigation: '/production', properties: { 所属批次: batchId, 所属工序: process.name, 参数键: parameter.key, 当前值: `${parameter.value} ${parameter.unit}`, 仿真范围: parameter.range, 参数状态: parameter.status, 采样时间: record?.timestamp || '暂无' } })
      parameterNodes.set(`${process.id}:${parameter.key}`, node); addLink(links, processNode.id, node.id, '监控参数')
      if (parameter.status !== '正常' && ![...relatedAlarms, ...relatedProductionEvents].some((item) => !item.parameterKey || item.parameterKey === parameter.key)) unreportedParameterRisks.push({ id: node.businessId, type: 'parameter', status: 'abnormal', processId: process.id })
    })
  })

  const equipmentNodes = new Map()
  equipmentList.map(evaluateEquipmentHealth).forEach((health) => {
    const activeRisks = equipmentEventsAll.filter((item) => item.equipmentId === health.equipmentId && !terminalStatuses.has(item.status))
    const status = activeRisks.length || health.score < 70 || health.failureProbability > 50 ? 'warning' : 'normal'
    const node = addNode(nodes, { type: 'equipment', businessId: health.equipmentId, name: `${health.equipmentId} ${health.equipmentName}`, domain: 'equipment', status, symbolSize: 52, navigation: '/equipment-health', properties: { 设备编号: health.equipmentId, 设备名称: health.equipmentName, 当前健康评分: health.score, 当前健康等级: health.level.label || health.level, 当前故障概率: `${health.failureProbability}%`, 当前风险事件: activeRisks.length, 最近恢复工单: health.recovery?.orderId || '暂无', 恢复说明: health.recovery?.description || '暂无恢复记录' } })
    equipmentNodes.set(health.equipmentId, node)
  })
  processDefinitions.forEach((process) => addLink(links, processNodes.get(process.id)?.id, equipmentNodes.get(process.equipmentId)?.id, '关联设备'))

  const productionEvents = recentWithActive(productionEventsAll, (item) => !terminalStatuses.has(item.status), 3), productionEventNodes = new Map()
  productionEvents.forEach((event) => {
    const node = addNode(nodes, { type: 'production_event', businessId: event.id, name: event.title || event.id, domain: 'alarm', status: eventStatus(event.status), historical: event.status === 'closed', navigation: '/production', properties: { 事件编号: event.id, 生产批次: event.batchId, 工序: event.process, 参数: event.parameter || event.parameterName, 触发值: `${event.currentValue ?? ''}${event.unit ? ` ${event.unit}` : ''}`, 标准范围: event.threshold || '暂无', 当前状态: event.status, 关联报警: event.relatedAlarmId || '暂无' } })
    productionEventNodes.set(event.id, node)
    const processNode = processNodes.get(event.processId) || [...processNodes.values()].find((item) => item.name === event.process)
    const parameterNode = parameterNodes.get(`${event.processId}:${event.parameterKey}`) || [...parameterNodes.values()].find((item) => item.properties.所属工序 === event.process && item.properties.参数键 === event.parameterKey)
    addLink(links, node.id, processNode?.id, '发生于'); addLink(links, node.id, parameterNode?.id, '涉及参数')
  })

  const equipmentEvents = recentWithActive(equipmentEventsAll, (item) => !terminalStatuses.has(item.status), 3), equipmentEventNodes = new Map()
  equipmentEvents.forEach((event) => {
    const node = addNode(nodes, { type: 'equipment_event', businessId: event.id, name: event.title || event.id, domain: 'alarm', status: eventStatus(event.status), historical: event.status === 'closed', navigation: '/equipment-prediction', properties: { 事件编号: event.id, 设备编号: event.equipmentId, 设备名称: event.equipmentName, 健康评分: event.healthScore ?? '暂无', 故障概率: event.failureProbability != null ? `${event.failureProbability}%` : '暂无', 风险等级: event.level, 当前状态: event.status } })
    equipmentEventNodes.set(event.id, node); addLink(links, node.id, equipmentNodes.get(event.equipmentId)?.id, '发生于')
  })

  const quality = getBatchQuality(batchId), qualityAnalysis = quality ? analyzeQualityStatus(quality) : null
  const qualityNode = quality && addNode(nodes, { type: 'quality', businessId: quality.id, name: `${batchId} 质量结果`, domain: 'quality', status: ['优秀', '合格'].includes(qualityAnalysis.qualityLevel.label) ? 'normal' : 'warning', symbolSize: 55, navigation: '/quality', properties: { 质量记录: quality.id, 生产批次: batchId, 当前质量评分: qualityAnalysis.qualityScore, 当前质量等级: qualityAnalysis.qualityLevel.label, 当前异常指标: qualityAnalysis.abnormalItems.length, 最近检测时间: quality.inspectionHistory?.at(-1)?.time || quality.createTime } })
  addLink(links, qualityNode?.id, batchNode?.id, '评价')
  const qualityEvents = recentWithActive(getQualityEvents().filter((item) => !batchId || item.batchId === batchId), (item) => !terminalStatuses.has(item.status), 3), qualityEventNodes = new Map()
  qualityEvents.forEach((event) => {
    const node = addNode(nodes, { type: 'quality_event', businessId: event.id, name: event.title || event.id, domain: 'quality', status: eventStatus(event.status), historical: event.status === 'closed', navigation: '/quality', properties: { 事件编号: event.id, 生产批次: event.batchId, 初始质量评分: event.qualityScoreBefore ?? '暂无', 初始质量等级: event.qualityLevel || '暂无', 当前状态: event.status, 复检任务: event.relatedInspectionTaskId || '暂无' } })
    qualityEventNodes.set(event.id, node); addLink(links, node.id, batchNode?.id, '发生于')
  })

  const alarmNodes = new Map()
  alarms.forEach((alarm) => {
    const status = terminalStatuses.has(alarm.status) ? 'closed' : alarm.status === 'recovery_pending' ? 'recovery_pending' : alarm.status === 'processing' ? 'processing' : alarm.level === 'critical' ? 'abnormal' : 'warning'
    const node = addNode(nodes, { type: 'alarm', businessId: alarm.id, name: alarm.title || alarm.id, domain: 'alarm', status, historical: terminalStatuses.has(alarm.status), navigation: '/alarm', properties: { 报警编号: alarm.id, 报警标题: alarm.title, 报警等级: alarm.level, 报警状态: alarm.status, 来源类型: alarm.sourceType, 来源事件: alarm.sourceEventId || '暂无', 当前值: alarm.currentValue === '' || alarm.currentValue == null ? '暂无' : `${alarm.currentValue}${alarm.unit ? ` ${alarm.unit}` : ''}`, 阈值: alarm.threshold || '暂无', 负责人: alarm.owner || '未指派' } })
    alarmNodes.set(alarm.id, node)
    if (alarm.sourceType === 'production_event') addLink(links, node.id, productionEventNodes.get(alarm.sourceEventId)?.id, '来源于')
    if (alarm.sourceType === 'equipment_event') addLink(links, node.id, equipmentEventNodes.get(alarm.sourceEventId)?.id, '关联')
    if (alarm.sourceType === 'quality_event') addLink(links, node.id, qualityEventNodes.get(alarm.sourceEventId)?.id, '关联')
    if (alarm.sourceType === 'production_alarm') { addLink(links, node.id, processNodes.get(alarm.processId)?.id, '发生于'); addLink(links, node.id, parameterNodes.get(`${alarm.processId}:${alarm.parameterKey}`)?.id, '涉及参数') }
    addLink(links, node.id, equipmentNodes.get(alarm.equipmentId)?.id, '关联设备')
  })

  const adjustments = getProductionAdjustments().filter((item) => !batchId || item.batchId === batchId).sort(newestFirst).slice(0, 5)
  adjustments.forEach((adjustment) => {
    const node = addNode(nodes, { type: 'production_adjustment', businessId: adjustment.id, name: `${adjustment.parameterName}参数调整`, domain: 'disposal', status: adjustment.status === 'completed' ? 'completed' : 'processing', navigation: '/production', properties: { 调整编号: adjustment.id, 工序: adjustment.process, 参数: adjustment.parameterName, 调整前: `${adjustment.beforeValue} ${adjustment.unit}`, 调整后: adjustment.actualValue == null ? '尚未执行' : `${adjustment.actualValue} ${adjustment.unit}`, 执行状态: adjustment.status, 操作人: adjustment.operator } })
    addLink(links, node.id, parameterNodes.get(`${adjustment.processId}:${adjustment.parameterKey}`)?.id, '调整')
    const related = productionEvents.find((event) => event.recovery?.adjustmentId === adjustment.id); addLink(links, node.id, productionEventNodes.get(related?.id)?.id, '处理')
  })

  const orderNodes = new Map(), orders = recentWithActive(getMaintenanceOrders(), (item) => item.status !== 'completed', 3)
  orders.forEach((order) => {
    const node = addNode(nodes, { type: 'maintenance_order', businessId: order.id, name: order.id, domain: 'disposal', status: order.status === 'completed' ? 'completed' : order.status === 'in_progress' ? 'processing' : 'warning', historical: order.status === 'completed', navigation: '/maintenance', properties: { 工单编号: order.id, 设备: `${order.equipmentId} ${order.equipmentName}`, 维护部件: order.component, 工单状态: order.status, 关联事件: order.eventId, 负责人: order.owner, 恢复结果: order.recovery ? `${order.recovery.beforeHealth} → ${order.recovery.afterHealth}分` : '暂无' } })
    orderNodes.set(order.id, node); addLink(links, node.id, equipmentNodes.get(order.equipmentId)?.id, '维护'); addLink(links, node.id, equipmentEventNodes.get(order.eventId)?.id, '处理')
  })
  alarms.forEach((alarm) => addLink(links, alarmNodes.get(alarm.id)?.id, orderNodes.get(alarm.relatedOrderId)?.id, '关联工单'))

  const inspections = recentWithActive(getQualityInspectionTasks().filter((item) => !batchId || item.batchId === batchId), (item) => item.status !== 'completed', 3)
  inspections.forEach((task) => {
    const node = addNode(nodes, { type: 'quality_inspection', businessId: task.id, name: task.id, domain: 'disposal', status: task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'processing' : 'warning', historical: task.status === 'completed', navigation: '/quality', properties: { 复检任务: task.id, 生产批次: task.batchId, 关联质量事件: task.eventId, 复检状态: task.status, 操作人: task.operator, 复检结果: task.afterResult ? `${task.afterResult.qualityScore}分 · ${task.afterResult.qualityLevel}` : '暂无' } })
    addLink(links, node.id, qualityEventNodes.get(task.eventId)?.id, '复检')
  })

  const ids = new Set(nodes.map((item) => item.id)), validLinks = links.filter((item) => ids.has(item.source) && ids.has(item.target))
  const activeAlarmRisks = activeAlarms.filter((item) => item.status !== 'recovery_pending').map((item) => ({ id: item.id, type: 'alarm', sourceType: item.sourceType, status: item.status, processId: item.processId || '' }))
  const representedSourceIds = new Set(activeAlarms.map((item) => item.sourceEventId).filter(Boolean))
  const orphanEventRisks = [...productionEvents, ...equipmentEvents, ...qualityEvents].filter((item) => !terminalStatuses.has(item.status) && item.status !== 'recovery_pending' && !representedSourceIds.has(item.id)).map((item) => ({ id: item.id, type: item.process || item.processId ? 'production_event' : item.equipmentId ? 'equipment_event' : 'quality_event', status: item.status, processId: item.processId || '' }))
  const activeRiskItems = [...activeAlarmRisks, ...orphanEventRisks, ...unreportedParameterRisks]
  const summary = { batchId: batchId || '暂无当前批次', entityCount: nodes.length, relationCount: validLinks.length, activeRiskCount: activeRiskItems.length, activeRiskItems, recoveryPendingCount: nodes.filter((item) => item.status === 'recovery_pending' && ['alarm', 'production_event', 'equipment_event', 'quality_event'].includes(item.type)).length, hasActiveRelations: activeRiskItems.length > 0 || activeAlarms.some((item) => item.status === 'recovery_pending') || productionEvents.some((item) => !terminalStatuses.has(item.status)) || equipmentEvents.some((item) => !terminalStatuses.has(item.status)) || qualityEvents.some((item) => !terminalStatuses.has(item.status)) }
  return clone({ nodes, links: validLinks, categories: industrialGraphCategories, summary, generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }), dataMode: '图谱关系基于当前工业仿真业务数据动态构建' })
}

export function getEntityRelations(id, graph = buildIndustrialKnowledgeGraph()) {
  const nodes = new Map(graph.nodes.map((item) => [item.id, item]))
  return graph.links.filter((item) => item.source === id || item.target === id).map((item) => { const relatedId = item.source === id ? item.target : item.source; return { ...item, direction: item.source === id ? 'outgoing' : 'incoming', related: clone(nodes.get(relatedId) || null) } })
}
export function getEntityDetail(id, graph = buildIndustrialKnowledgeGraph()) { const node = graph.nodes.find((item) => item.id === id); if (!node) return null; const relations = getEntityRelations(id, graph); return clone({ ...node, relationCount: relations.length, relations }) }
export function getEntityNavigation(entity) {
  const labels = { alarm: '前往报警中心', maintenance_order: '前往维护管理', quality: '前往质量管理', quality_event: '前往质量管理', quality_inspection: '前往质量管理', equipment: '前往设备健康', equipment_event: '前往故障预测', batch: '前往生产监控', process: '前往生产监控', parameter: '前往生产监控', production_event: '前往生产监控', production_adjustment: '前往生产监控' }
  return entity?.navigation ? { label: labels[entity.type] || '前往业务页面', path: entity.navigation } : null
}
