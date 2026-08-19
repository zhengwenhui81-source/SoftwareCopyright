import { generateDecision, buildDecisionContext } from './decisionEngine.js'
import { getProductionBatch, getProductionPlans, getProductionRuntime } from './productionPlan.js'
import { analyzeParameterStatus, getProcessParameters, processParameterRules } from './processParameter.js'
import { getProductionAdjustments } from './productionAdjustment.js'
import { getProductionEvents } from './productionEvent.js'
import { evaluateEquipmentHealth } from './equipmentHealth.js'
import { getEquipmentEvents } from './equipmentEvent.js'
import { getEquipmentRecoveries } from './equipmentRecovery.js'
import { getMaintenanceOrders } from './maintenance.js'
import { equipmentList } from './mock/equipment.js'
import { analyzeQualityStatus, getBatchQuality, getQualityData } from './qualityData.js'
import { getQualityEvents } from './qualityEvent.js'
import { getQualityInspectionTasks } from './qualityInspection.js'
import { getAlarmEvents } from './alarmEvent.js'
import { getEquipmentIdByProcess } from './industrialRelation.js'

const activeAlarmStatuses = new Set(['new', 'acknowledged', 'processing', 'recovery_pending'])
const processIds = { 板坯加热: 'heating', 粗轧: 'roughing', 精轧: 'finishing', 控冷: 'cooling', 质量检测: 'inspection' }
const routes = { production: '/production', equipment: '/equipment-health', maintenance: '/maintenance', quality: '/quality', alarm: '/alarm', decision: '/decision' }
const clone = (value) => JSON.parse(JSON.stringify(value))
const timeValue = (value) => Date.parse(String(value || '').replace(' ', 'T')) || 0
const newestFirst = (a, b) => timeValue(b.updateTime || b.completeTime || b.createTime) - timeValue(a.updateTime || a.completeTime || a.createTime)
const formatValue = (value, unit = '') => value === '' || value == null ? '暂无' : `${value}${unit ? ` ${unit}` : ''}`
const uniqueEvidence = (items) => items.filter((item, index, list) => item.id && list.findIndex((candidate) => `${candidate.type}:${candidate.id}:${candidate.label}` === `${item.type}:${item.id}:${item.label}`) === index)

function getCurrentBatch() {
  const batches = [getProductionBatch()].filter(Boolean)
  return batches[0] || null
}

function buildProductionContext(batch) {
  const batchId = batch?.batchId || ''
  const plan = getProductionPlans().find((item) => item.id === batch?.planId) || null
  const parameters = Object.keys(processParameterRules).map((process) => {
    const record = getProcessParameters(batchId, process)
    return { process, processId: processIds[process] || '', equipmentId: getEquipmentIdByProcess(processIds[process], process), record, statuses: analyzeParameterStatus(record) }
  })
  const abnormalParameters = parameters.flatMap((group) => group.statuses.filter((item) => item.status !== '正常').map((item) => ({ ...item, process: group.process, processId: group.processId, equipmentId: group.equipmentId, timestamp: group.record?.timestamp || '' })))
  const events = getProductionEvents().filter((item) => item.batchId === batchId)
  const adjustments = getProductionAdjustments().filter((item) => item.batchId === batchId).sort(newestFirst)
  const runtime = batch ? getProductionRuntime(batchId) : null
  return {
    plan, batch, runtime, currentProcess: batch?.processStatus === 'completed' || Number(batch?.progress) >= 100 ? '全部完成' : batch?.currentProcess || '暂无',
    parameters, abnormalParameters, activeEvents: events.filter((item) => item.status !== 'closed'),
    historicalEvents: events.filter((item) => item.status === 'closed').sort(newestFirst), recentAdjustments: adjustments.slice(0, 5),
  }
}

function buildEquipmentContext() {
  const healthStates = equipmentList.map((device) => evaluateEquipmentHealth(device))
  const events = getEquipmentEvents()
  const orders = getMaintenanceOrders()
  const recoveries = getEquipmentRecoveries().sort(newestFirst)
  return {
    healthStates, activeEvents: events.filter((item) => item.status !== 'closed'), historicalEvents: events.filter((item) => item.status === 'closed').sort(newestFirst),
    activeOrders: orders.filter((item) => item.status !== 'completed'), completedOrders: orders.filter((item) => item.status === 'completed').sort(newestFirst), recoveries,
  }
}

function buildQualityContext(batchId) {
  const current = batchId ? getBatchQuality(batchId) : null
  const analysis = current ? analyzeQualityStatus(current) : null
  const events = getQualityEvents().filter((item) => !batchId || item.batchId === batchId)
  const tasks = getQualityInspectionTasks().filter((item) => !batchId || item.batchId === batchId)
  return {
    current, analysis, allData: getQualityData(), activeEvents: events.filter((item) => item.status !== 'closed'),
    historicalEvents: events.filter((item) => item.status === 'closed').sort(newestFirst), activeTasks: tasks.filter((item) => item.status !== 'completed'),
    completedTasks: tasks.filter((item) => item.status === 'completed').sort(newestFirst), inspectionHistory: current?.inspectionHistory || [],
  }
}

export function buildIndustrialAssistantContext() {
  const batch = getCurrentBatch()
  const production = buildProductionContext(batch)
  const equipment = buildEquipmentContext()
  const quality = buildQualityContext(batch?.batchId || '')
  const allAlarms = getAlarmEvents().sort(newestFirst)
  const alarms = {
    active: allAlarms.filter((item) => activeAlarmStatuses.has(item.status)),
    recoveryPending: allAlarms.filter((item) => item.status === 'recovery_pending'),
    serious: allAlarms.filter((item) => activeAlarmStatuses.has(item.status) && item.level === 'critical'),
    recentlyClosed: allAlarms.filter((item) => item.status === 'closed').slice(0, 8),
  }
  const decisionContext = buildDecisionContext(batch?.batchId || '')
  const decision = generateDecision(decisionContext)
  return clone({ generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }), dataMode: '工业大模型助手演示 · 基于工业仿真数据与规则推理', production, equipment, quality, alarms, decision })
}

function parameterEvidence(batchId, processGroup) {
  return processGroup?.statuses.map((item) => ({ type: 'process_parameter', id: batchId, label: `${processGroup.process}${item.name}`, value: `${formatValue(item.value, item.unit)}；仿真范围 ${item.range}` })) || []
}

function processAnswer(context, processName) {
  const group = context.production.parameters.find((item) => item.process === processName)
  if (!group?.record) return { conclusion: `当前仿真数据中未找到${processName}参数记录。`, basis: [], state: '数据缺失', suggestions: ['前往生产监控确认当前批次和参数采样状态'], evidence: [], navigation: [{ label: '前往生产监控', path: routes.production }] }
  const abnormal = group.statuses.filter((item) => item.status !== '正常')
  const alarms = context.alarms.active.filter((item) => item.processId === group.processId || item.processName === processName)
  const recovery = alarms.filter((item) => item.status === 'recovery_pending')
  const latestAdjustment = context.production.recentAdjustments.find((item) => item.process === processName && item.status === 'completed')
  const evidence = [...parameterEvidence(context.production.batch?.batchId, group), ...alarms.map((item) => ({ type: 'alarm', id: item.id, label: item.title, value: item.status })), ...(latestAdjustment ? [{ type: 'production_adjustment', id: latestAdjustment.id, label: `${processName}${latestAdjustment.parameterName}调整`, value: `${latestAdjustment.beforeValue} → ${latestAdjustment.actualValue} ${latestAdjustment.unit}` }] : [])]
  if (abnormal.length) {
    const descriptions = abnormal.map((item) => `${item.name}${formatValue(item.value, item.unit)}，${item.status === '偏高' ? `高于${item.max} ${item.unit}仿真上限` : `低于${item.min} ${item.unit}仿真下限`}`)
    return { conclusion: `${processName}当前存在工艺参数异常。`, basis: descriptions, state: `当前异常参数 ${abnormal.length} 项${alarms.length ? `，关联活动报警 ${alarms.length} 条` : ''}`, suggestions: ['前往生产监控复核参数并执行经人工确认的仿真调整', '在报警中心记录处置过程'], evidence, navigation: [{ label: '前往生产监控', path: routes.production }, { label: '前往报警中心', path: routes.alarm }] }
  }
  if (recovery.length || alarms.length) {
    return { conclusion: `${processName}当前参数均在仿真范围内，但仍有${recovery.length || alarms.length}条历史触发报警尚未完成闭环确认。`, basis: group.statuses.map((item) => `${item.name}${formatValue(item.value, item.unit)}，仿真范围${item.range}`), state: recovery.length ? '参数已恢复，处于待恢复确认阶段' : '参数正常，仍有活动历史报警', suggestions: ['前往报警中心核对处理记录并完成恢复确认'], evidence, navigation: [{ label: '前往报警中心', path: routes.alarm }] }
  }
  return { conclusion: `${processName}当前参数正常，未发现活动报警。`, basis: group.statuses.map((item) => `${item.name}${formatValue(item.value, item.unit)}，处于${item.range}`), state: '当前正常', suggestions: ['继续观察参数趋势'], evidence, navigation: [{ label: '前往生产监控', path: routes.production }] }
}

function equipmentAnswer(context, equipmentId) {
  const health = context.equipment.healthStates.find((item) => item.equipmentId === equipmentId)
  if (!health) return { conclusion: `当前仿真数据中未找到设备 ${equipmentId}。`, basis: [], state: '数据缺失', suggestions: ['核对设备编号'], evidence: [], navigation: [{ label: '前往设备健康', path: routes.equipment }] }
  const risks = context.equipment.activeEvents.filter((item) => item.equipmentId === equipmentId)
  const orders = [...context.equipment.activeOrders, ...context.equipment.completedOrders].filter((item) => item.equipmentId === equipmentId)
  const recovery = context.equipment.recoveries.find((item) => item.equipmentId === equipmentId)
  const restored = recovery && health.score >= recovery.afterHealth && health.failureProbability <= recovery.afterProbability
  const evidence = [{ type: 'equipment_health', id: equipmentId, label: health.equipmentName, value: `健康评分${health.score}，故障概率${health.failureProbability}%` }, ...risks.map((item) => ({ type: 'equipment_event', id: item.id, label: item.title, value: item.status })), ...orders.slice(0, 2).map((item) => ({ type: 'maintenance_order', id: item.id, label: item.equipmentName, value: item.status })), ...(recovery ? [{ type: 'equipment_recovery', id: recovery.orderId, label: '维护恢复结果', value: `${recovery.beforeHealth} → ${recovery.afterHealth}分；${recovery.beforeProbability}% → ${recovery.afterProbability}%` }] : [])]
  return {
    conclusion: restored ? `${equipmentId}当前健康状态已完成仿真恢复。` : risks.length ? `${equipmentId}当前仍存在设备风险事件。` : health.score < 70 || health.failureProbability > 50 ? `${equipmentId}当前健康评价处于风险区间，但尚未生成设备风险事件。` : `${equipmentId}当前未发现活动设备风险事件。`,
    basis: [`${health.equipmentName}健康评分 ${health.score}`, `故障概率 ${health.failureProbability}%`, ...(recovery ? [`最近恢复记录关联工单 ${recovery.orderId}`] : [])],
    state: `${health.level.label || health.level}；${risks.length}条活动风险事件；${context.equipment.activeOrders.filter((item) => item.equipmentId === equipmentId).length}张活动工单`,
    suggestions: restored ? ['继续按当前周期观察设备健康趋势'] : risks.length ? ['前往维护管理查看风险事件对应工单'] : health.score < 70 || health.failureProbability > 50 ? ['前往设备健康复核风险因素；助手不直接生成风险事件'] : ['保持日常点检'],
    evidence, navigation: [{ label: '前往设备健康', path: routes.equipment }, { label: '前往维护管理', path: routes.maintenance }],
  }
}

function qualityAnswer(context, requestedBatchId = '') {
  const quality = requestedBatchId ? buildQualityContext(requestedBatchId) : context.quality
  const { current, analysis, activeEvents, historicalEvents, activeTasks, completedTasks, inspectionHistory } = quality
  const relatedEvents = [...activeEvents, ...historicalEvents].sort(newestFirst)
  if (!current || !analysis) {
    if (relatedEvents.length || activeTasks.length || completedTasks.length) {
      const event = relatedEvents[0]
      const task = [...activeTasks, ...completedTasks].sort(newestFirst)[0]
      return {
        conclusion: `批次${requestedBatchId || event?.batchId || '—'}存在质量异常事件或复检记录，当前尚无可用的最新质量检测结果。`,
        basis: [...relatedEvents.slice(0, 2).map((item) => `质量事件 ${item.id}：${item.title || '质量异常'}（${item.status}）`), ...(task ? [`复检任务 ${task.id}：${task.status}`] : [])],
        state: activeEvents.length || activeTasks.length ? '处于质量处理或复检阶段' : '存在历史质量处置记录',
        suggestions: ['前往质量管理核对质量事件与复检结果'],
        evidence: uniqueEvidence([...relatedEvents.map((item) => ({ type: 'quality_event', id: item.id, label: item.title || '质量异常事件', value: item.status })), ...[...activeTasks, ...completedTasks].map((item) => ({ type: 'quality_inspection', id: item.id, label: '质量复检任务', value: item.status }))]),
        navigation: [{ label: '前往质量管理', path: routes.quality }],
      }
    }
    return { conclusion: '当前仿真数据中未找到对应批次质量记录。', basis: [], state: '暂无检测数据', suggestions: ['前往质量管理核对批次'], evidence: [], navigation: [{ label: '前往质量管理', path: routes.quality }] }
  }
  const latestInspection = inspectionHistory.filter((item) => item.type === 'reinspection').at(-1)
  const initialInspection = inspectionHistory.find((item) => item.type === 'initial')
  const historyEvent = historicalEvents[0]
  const evidence = [{ type: 'quality_data', id: current.id, label: `批次${current.batchId}最新质量结果`, value: `${analysis.qualityScore}分 · ${analysis.qualityLevel.label}` }, ...(initialInspection ? [{ type: 'quality_inspection', id: current.id, label: `批次${current.batchId}初检`, value: `${initialInspection.score}分 · ${initialInspection.level}` }] : []), ...relatedEvents.map((item) => ({ type: 'quality_event', id: item.id, label: item.title || '质量异常事件', value: item.status })), ...completedTasks.slice(0, 2).map((item) => ({ type: 'quality_inspection', id: item.id, label: '质量复检', value: `${item.afterResult?.qualityScore ?? '暂无'}分 · ${item.afterResult?.qualityLevel || '暂无'}` }))]
  return {
    conclusion: `批次${current.batchId}当前最新质量结果为${analysis.qualityScore}分，等级${analysis.qualityLevel.label}。`,
    basis: [`异常指标 ${analysis.abnormalItems.length} 项`, ...(initialInspection ? [`历史初检 ${initialInspection.score}分 · ${initialInspection.level}`] : []), ...(latestInspection ? [`最近复检 ${latestInspection.score}分 · ${latestInspection.level}`] : []), ...(historyEvent?.qualityScoreBefore != null ? [`质量事件 ${historyEvent.id} 记录初始评分 ${historyEvent.qualityScoreBefore}分`] : [])],
    state: activeEvents.length ? `仍有${activeEvents.length}条活动质量事件，${activeTasks.length}项复检任务未完成` : latestInspection ? '质量复检已完成，当前以最新检测结果为准' : '当前无活动质量异常事件',
    suggestions: activeEvents.length ? ['前往质量管理完成复检与恢复确认'] : ['继续按批次保存质量检测记录'], evidence, navigation: [{ label: '前往质量管理', path: routes.quality }],
  }
}

function productionAnswer(context) {
  const { plan, batch, currentProcess, abnormalParameters, activeEvents } = context.production
  if (!batch) return { conclusion: '当前仿真数据中未找到生产批次。', basis: [], state: '暂无生产数据', suggestions: ['前往生产监控核对生产计划'], evidence: [], navigation: [{ label: '前往生产监控', path: routes.production }] }
  const pending = context.alarms.recoveryPending.filter((item) => item.domain === 'production')
  const completed = batch.processStatus === 'completed' || Number(batch.progress) >= 100
  return {
    conclusion: completed ? `批次${batch.batchId}生产流程已完成。` : `批次${batch.batchId}正在${currentProcess}工序运行，进度${batch.progress}%。`,
    basis: [`订单 ${plan?.orderNo || '暂无'}`, `钢种 ${batch.steelGrade}`, `规格 ${batch.specification}`, `当前异常参数 ${abnormalParameters.length}项`, `活动生产事件 ${activeEvents.length}条`],
    state: abnormalParameters.length ? '存在当前工艺参数异常' : pending.length ? `当前参数无越界，仍有${pending.length}条生产报警待恢复确认` : '当前生产参数稳定',
    suggestions: abnormalParameters.length ? ['前往生产监控查看异常参数'] : pending.length ? ['前往报警中心完成恢复确认'] : ['继续观察批次运行状态'],
    evidence: uniqueEvidence([{ type: 'production_batch', id: batch.batchId, label: '当前批次', value: `${batch.progress}% · ${currentProcess}` }, ...abnormalParameters.map((item) => ({ type: 'process_parameter', id: batch.batchId, label: `${item.process}${item.name}`, value: formatValue(item.value, item.unit) })), ...pending.map((item) => ({ type: 'alarm', id: item.id, label: item.title, value: item.status }))]), navigation: [{ label: '前往生产监控', path: routes.production }],
  }
}

function anomalyAnswer(context) {
  const productionCount = context.production.abnormalParameters.length
  const equipmentCount = context.equipment.activeEvents.length
  const qualityCount = context.quality.activeEvents.length
  const alarmCount = context.alarms.active.length
  const evidence = [...context.production.abnormalParameters.map((item) => ({ type: 'process_parameter', id: context.production.batch?.batchId, label: `${item.process}${item.name}`, value: formatValue(item.value, item.unit) })), ...context.equipment.activeEvents.map((item) => ({ type: 'equipment_event', id: item.id, label: item.title, value: item.status })), ...context.quality.activeEvents.map((item) => ({ type: 'quality_event', id: item.id, label: item.title || '质量异常事件', value: item.status })), ...context.alarms.active.map((item) => ({ type: 'alarm', id: item.id, label: item.title, value: item.status }))]
  return { conclusion: productionCount + equipmentCount + qualityCount + alarmCount ? '当前系统存在尚未完成闭环的业务异常或报警。' : '当前未发现活动生产、设备、质量异常或统一报警。', basis: [`当前异常生产参数 ${productionCount}项`, `活动设备风险事件 ${equipmentCount}条`, `活动质量事件 ${qualityCount}条`, `活动统一报警 ${alarmCount}条`], state: `其中待恢复确认报警 ${context.alarms.recoveryPending.length}条，严重报警 ${context.alarms.serious.length}条`, suggestions: productionCount ? ['前往生产监控处理当前异常参数'] : alarmCount ? ['前往报警中心按状态完成处置'] : equipmentCount ? ['前往设备健康查看风险事件'] : qualityCount ? ['前往质量管理查看质量事件'] : ['继续监控业务状态'], evidence: uniqueEvidence(evidence), navigation: [{ label: productionCount ? '前往生产监控' : '前往报警中心', path: productionCount ? routes.production : routes.alarm }] }
}

function alarmExplanation(context) {
  const groups = Object.entries(context.alarms.active.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {}))
  const basis = groups.length ? groups.map(([key, count]) => `${key} ${count}条`) : ['当前没有活动报警']
  return { conclusion: context.alarms.active.length ? `当前还有${context.alarms.active.length}条统一报警未关闭；参数恢复不等于报警闭环完成。` : '当前统一报警均已关闭或取消。', basis, state: `待恢复确认 ${context.alarms.recoveryPending.length}条；当前参数异常 ${context.production.abnormalParameters.length}项`, suggestions: context.alarms.recoveryPending.length ? ['在报警中心核对处理记录并完成恢复验证/关闭'] : ['按报警状态完成确认和处理'], evidence: context.alarms.active.map((item) => ({ type: 'alarm', id: item.id, label: `${item.sourceType} · ${item.title}`, value: item.status })), navigation: [{ label: '前往报警中心', path: routes.alarm }] }
}

function priorityAnswer(context) {
  const decision = context.decision
  const first = decision.recommendations[0]
  return { conclusion: first ? `当前最高优先级建议：${first.text}。` : decision.summary, basis: decision.evidence.slice(0, 6).map((item) => item.text), state: `决策风险等级 ${decision.riskLevel}；有效建议 ${decision.recommendations.length}项`, suggestions: decision.recommendations.slice(0, 4).map((item) => `${item.priority}. ${item.text}（${item.reason}）`), evidence: decision.evidence.map((item) => ({ type: item.type, id: item.refId, label: '决策证据', value: item.text })), navigation: [{ label: '前往智能决策', path: routes.decision }, ...(first?.actionType === 'maintenance' ? [{ label: '前往维护管理', path: routes.maintenance }] : first?.actionType === 'quality_reinspection' ? [{ label: '前往质量管理', path: routes.quality }] : first?.actionType === 'alarm_handling' ? [{ label: '前往报警中心', path: routes.alarm }] : first ? [{ label: '前往生产监控', path: routes.production }] : [])] }
}

function detectIntent(question) {
  const text = String(question || '').trim()
  const batchId = text.match(/\bPL-\d{8}-\d{3,}\b/i)?.[0]?.toUpperCase() || ''
  if (/最优先|优先.*处理|应该处理什么|当前建议/.test(text)) return { type: 'priority' }
  const equipmentId = text.match(/\b[A-Z]{2,4}-\d{1,3}\b/i)?.[0]?.toUpperCase()
  if (equipmentId) return { type: 'equipment', equipmentId }
  if (/精轧/.test(text)) return { type: 'process', processName: '精轧' }
  if (/控冷|冷却速度|终冷温度/.test(text)) return { type: 'process', processName: '控冷' }
  if (/为什么.*报警|报警.*为什么|报警.*没.*消失|还有报警/.test(text)) return { type: 'alarm' }
  if (/质量|复检|板厚|缺陷/.test(text)) return { type: 'quality', batchId }
  if (/设备|故障|维护|健康/.test(text)) return { type: 'equipment_overview' }
  if (/异常|风险/.test(text)) return { type: 'anomaly' }
  if (/生产|批次|订单|运行情况|产线/.test(text)) return { type: 'production' }
  return { type: 'unknown' }
}

function equipmentOverview(context) {
  const risky = context.equipment.activeEvents
  const highest = [...context.equipment.healthStates].sort((a, b) => b.failureProbability - a.failureProbability)[0]
  return { conclusion: risky.length ? `当前存在${risky.length}条设备风险事件。` : '当前没有活动设备风险事件。', basis: highest ? [`当前故障概率最高设备为${highest.equipmentId}，健康评分${highest.score}，故障概率${highest.failureProbability}%`] : [], state: `活动维护工单 ${context.equipment.activeOrders.length}张；最近恢复记录 ${context.equipment.recoveries.length}条`, suggestions: risky.length ? ['前往设备健康或维护管理查看风险依据'] : ['继续执行预测维护演示监测'], evidence: [...risky.map((item) => ({ type: 'equipment_event', id: item.id, label: item.title, value: item.status })), ...(highest ? [{ type: 'equipment_health', id: highest.equipmentId, label: highest.equipmentName, value: `${highest.score}分 / ${highest.failureProbability}%` }] : [])], navigation: [{ label: '前往设备健康', path: routes.equipment }, { label: '前往维护管理', path: routes.maintenance }] }
}

function formatAnswer(answer) {
  const lines = [`结论：\n${answer.conclusion}`]
  if (answer.basis.length) lines.push(`关键依据：\n${answer.basis.map((item) => `- ${item}`).join('\n')}`)
  lines.push(`当前状态：\n${answer.state}`)
  if (answer.suggestions.length) lines.push(`建议下一步：\n${answer.suggestions.map((item) => `- ${item}`).join('\n')}`)
  return lines.join('\n\n')
}

export function answerIndustrialQuestion(question) {
  const context = buildIndustrialAssistantContext()
  const intent = detectIntent(question)
  let answer
  if (intent.type === 'production') answer = productionAnswer(context)
  else if (intent.type === 'anomaly') answer = anomalyAnswer(context)
  else if (intent.type === 'process') answer = processAnswer(context, intent.processName)
  else if (intent.type === 'equipment') answer = equipmentAnswer(context, intent.equipmentId)
  else if (intent.type === 'equipment_overview') answer = equipmentOverview(context)
  else if (intent.type === 'quality') answer = qualityAnswer(context, intent.batchId)
  else if (intent.type === 'alarm') answer = alarmExplanation(context)
  else if (intent.type === 'priority') answer = priorityAnswer(context)
  else answer = { conclusion: '当前问题未匹配到明确工业对象。', basis: [], state: '未执行推测，避免编造仿真数据', suggestions: ['请提供生产工序、设备编号、质量批次或报警问题'], evidence: [], navigation: [] }
  return { role: 'assistant', content: formatAnswer(answer), evidence: uniqueEvidence(answer.evidence || []), navigation: answer.navigation || [], intent: intent.type, contextTime: context.generatedAt, dataMode: context.dataMode }
}

export function getSuggestedIndustrialQuestions() {
  return ['当前生产状态怎么样？', '现在有哪些异常？', '精轧当前是否正常？', '控冷报警为什么还没消失？', 'FM-01当前健康情况如何？', '当前质量风险是什么？', '现在最优先应该处理什么？']
}

export function getAssistantEvidence(question) {
  return answerIndustrialQuestion(question).evidence
}
