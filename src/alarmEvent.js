import { closeProductionEvent, getProductionEvents, PRODUCTION_EVENT_CHANGED, setProductionEventRelatedAlarm } from './productionEvent.js'
import { EQUIPMENT_EVENT_CHANGED, getEquipmentEvents } from './equipmentEvent.js'
import { getMaintenanceOrders, MAINTENANCE_CHANGED } from './maintenance.js'
import { equipmentList } from './mock/equipment.js'
import { evaluateEquipmentHealth } from './equipmentHealth.js'
import { getEquipmentRecovery, updateEquipmentRecoveryOutcome } from './equipmentRecovery.js'
import { getLinkedAlarms, updateLinkedAlarm } from './industrialAlarmLink.js'
import { findProcessParameterRule } from './processParameterRules.js'
import { confirmQualityRecovery, getQualityEvents, QUALITY_EVENT_CHANGED, setQualityEventRelatedAlarm } from './qualityEvent.js'

/**
 * 统一报警事件业务层
 *
 * 负责多来源数据适配、报警去重、生命周期、处理记录与 localStorage 持久化。
 * 不依赖页面、图表或具体业务组件。
 */
const STORAGE_KEY = 'thick_plate_alarm_events'
export const ALARM_EVENT_CHANGED = 'alarm-event-changed'
export const alarmStatuses = ['new', 'acknowledged', 'processing', 'recovery_pending', 'closed', 'cancelled']

const transitions = {
  new: ['acknowledged', 'cancelled'],
  acknowledged: ['processing', 'cancelled'],
  processing: ['recovery_pending', 'cancelled'],
  recovery_pending: ['closed', 'processing', 'cancelled'],
  closed: [],
  cancelled: [],
}

const legacyStatusMap = {
  pending: 'new',
  processing: 'processing',
  recovery_pending: 'recovery_pending',
  resolved: 'recovery_pending',
  closed: 'closed',
}

const productionProcessIds = {
  '炼钢与连铸': 'steelmaking',
  '板坯加热': 'heating',
  '粗轧': 'roughing',
  '精轧': 'finishing',
  '控冷': 'cooling',
  '矫直': 'leveling',
  '质量检测': 'inspection',
  '入库': 'storage',
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function nowText(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function readEvents() {
  if (typeof window === 'undefined') return []
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveEvents(events) {
  if (typeof window === 'undefined') return
  const copied = clone(events)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(copied))
  window.dispatchEvent?.(new CustomEvent(ALARM_EVENT_CHANGED, { detail: copied }))
}

function createAlarmId(events, date = new Date()) {
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `ALM-${day}-${String(events.length + 1).padStart(4, '0')}`
}

function extractEquipmentId(text = '') {
  return String(text).match(/\b[A-Z]{2,4}-\d{1,3}\b/)?.[0] || ''
}

function splitValueAndUnit(value, fallbackUnit = '') {
  if (typeof value === 'number') return { value, unit: fallbackUnit }
  const text = String(value ?? '').trim()
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/)
  if (!match) return { value: text, unit: fallbackUnit }
  return { value: Number(match[1]), unit: match[2] || fallbackUnit }
}

function normalizeLevel(level) {
  const map = { critical: 'critical', high: 'critical', warning: 'warning', medium: 'warning', info: 'info', low: 'info' }
  return map[level] || 'warning'
}

function normalizeSuggestions(value) {
  if (Array.isArray(value)) return [...value]
  return value ? [String(value)] : []
}

function baseAlarm(sourceType, sourceEventId, overrides = {}) {
  const time = overrides.createTime || nowText()
  return {
    id: overrides.id || '',
    sourceType,
    sourceEventId: sourceEventId || '',
    domain: overrides.domain || 'production',
    batchId: overrides.batchId || '',
    equipmentId: overrides.equipmentId || '',
    equipmentName: overrides.equipmentName || '',
    processId: overrides.processId || '',
    processName: overrides.processName || '',
    parameterKey: overrides.parameterKey || '',
    parameterName: overrides.parameterName || '',
    title: overrides.title || '工业异常报警',
    description: overrides.description || '',
    level: normalizeLevel(overrides.level),
    currentValue: overrides.currentValue ?? '',
    threshold: overrides.threshold ?? '',
    unit: overrides.unit || '',
    healthScore: Number.isFinite(Number(overrides.healthScore)) ? Number(overrides.healthScore) : null,
    failureProbability: Number.isFinite(Number(overrides.failureProbability)) ? Number(overrides.failureProbability) : null,
    status: alarmStatuses.includes(overrides.status) ? overrides.status : 'new',
    owner: overrides.owner || '未指派',
    causeAnalysis: overrides.causeAnalysis || '',
    suggestions: normalizeSuggestions(overrides.suggestions),
    relatedEventId: overrides.relatedEventId || '',
    relatedOrderId: overrides.relatedOrderId || '',
    timeline: Array.isArray(overrides.timeline) ? clone(overrides.timeline) : [],
    recovery: overrides.recovery ? clone(overrides.recovery) : null,
    qualityContext: overrides.qualityContext ? clone(overrides.qualityContext) : null,
    createTime: time,
    updateTime: overrides.updateTime || time,
  }
}

/** 将 industrialAlarmLink.js 的旧报警字段转换为统一结构。 */
export function normalizeLegacyAlarm(alarm = {}) {
  const parsed = splitValueAndUnit(alarm.value, alarm.unit)
  return baseAlarm('production_alarm', alarm.id, {
    domain: 'production',
    batchId: alarm.batchNo || alarm.batchId,
    equipmentId: alarm.equipmentId || extractEquipmentId(alarm.device),
    equipmentName: alarm.equipmentName || alarm.device,
    processId: alarm.processId,
    processName: alarm.triggerProcess || alarm.processName,
    parameterKey: alarm.parameterKey,
    parameterName: alarm.triggerParameter || alarm.parameterName,
    title: alarm.reason || alarm.title,
    description: alarm.description || alarm.reason,
    level: alarm.level,
    currentValue: parsed.value,
    threshold: alarm.threshold,
    unit: parsed.unit,
    status: legacyStatusMap[alarm.status] || 'new',
    owner: alarm.owner,
    causeAnalysis: alarm.reason,
    suggestions: alarm.suggestion,
    relatedEventId: alarm.eventKey,
    createTime: alarm.time || alarm.createTime,
    updateTime: alarm.updateTime || alarm.time || alarm.createTime,
  })
}

export function fromProductionAlarm(alarm = {}) {
  return normalizeLegacyAlarm(alarm)
}

export function fromProductionEvent(event = {}) {
  return baseAlarm('production_event', event.id, {
    domain: 'production',
    batchId: event.batchId,
    processId: event.processId || productionProcessIds[event.process] || '',
    processName: event.process,
    parameterKey: event.parameterKey,
    parameterName: event.parameter,
    title: event.title,
    description: event.description,
    level: event.level,
    currentValue: event.currentValue,
    threshold: event.threshold,
    unit: event.unit,
    status: legacyStatusMap[event.status] || 'new',
    causeAnalysis: event.description,
    suggestions: event.suggestion,
    relatedEventId: event.id,
    createTime: event.createTime,
    updateTime: event.updateTime,
  })
}

export function fromEquipmentEvent(event = {}) {
  return baseAlarm('equipment_event', event.id, {
    domain: 'equipment',
    equipmentId: event.equipmentId,
    equipmentName: event.equipmentName,
    parameterKey: event.type,
    parameterName: event.typeLabel,
    title: event.title,
    description: event.description,
    level: event.level,
    currentValue: event.currentValue,
    threshold: event.threshold,
    unit: event.unit,
    healthScore: event.healthScore,
    failureProbability: event.failureProbability,
    status: event.status === 'confirmed' ? 'acknowledged' : legacyStatusMap[event.status] || 'new',
    causeAnalysis: event.description,
    suggestions: event.suggestion,
    relatedEventId: event.id,
    createTime: event.createTime,
    updateTime: event.updateTime,
  })
}

export function fromMaintenanceOrder(order = {}) {
  const status = order.status === 'completed' ? 'recovery_pending'
    : order.status === 'in_progress' ? 'processing'
      : order.status === 'scheduled' ? 'acknowledged' : 'new'
  return baseAlarm('maintenance', order.id, {
    domain: 'equipment',
    equipmentId: order.equipmentId,
    equipmentName: order.equipmentName,
    parameterName: order.riskParameter?.name,
    title: `${order.equipmentName || '设备'}预测维护状态`,
    description: order.reason,
    level: order.priority,
    currentValue: order.riskParameter?.currentValue,
    threshold: order.riskParameter?.threshold,
    unit: order.riskParameter?.unit,
    healthScore: order.beforeHealth,
    failureProbability: order.beforeProbability,
    status,
    owner: order.owner,
    causeAnalysis: order.reason,
    suggestions: order.measures,
    relatedEventId: order.eventId,
    relatedOrderId: order.id,
    recovery: order.recovery,
    createTime: order.createTime,
    updateTime: order.updateTime,
  })
}

export function shouldCreateQualityAlarm(event = {}) {
  const criticalPerformance = (event.abnormalItems || []).some((item) => ['yieldStrength', 'tensileStrength'].includes(item.key))
  const failedReinspection = event.recovery?.verificationPassed === false && ['关注', '异常'].includes(event.recovery?.levelAfter)
  return event.level === 'critical' || event.qualityLevel === '异常' || criticalPerformance || failedReinspection
}

export function fromQualityEvent(event = {}) {
  const primary = event.abnormalItems?.[0]
  return baseAlarm('quality_event', event.id, {
    domain: 'quality', batchId: event.batchId, parameterKey: primary?.key, parameterName: primary?.name,
    title: `${event.batchId || '批次'}质量异常`, description: event.description, level: event.level,
    currentValue: primary?.value ?? '', unit: primary?.unit || '', causeAnalysis: '批次质量评价或关键力学性能未满足质量仿真规则',
    suggestions: event.suggestions, relatedEventId: event.id, recovery: event.recovery,
    qualityContext: { score: event.recovery?.scoreAfter ?? event.qualityScoreBefore, level: event.recovery?.levelAfter || event.qualityLevel, abnormalItems: event.abnormalItems || [], inspectionTaskId: event.recovery?.taskId || event.relatedInspectionTaskId || '', recovery: event.recovery || null },
    createTime: event.createTime, updateTime: event.updateTime,
  })
}

function inferSourceType(input = {}, explicitType) {
  if (explicitType) return explicitType
  if (input.sourceType) return input.sourceType
  if (String(input.id).startsWith('PE-')) return 'production_event'
  if (String(input.id).startsWith('EV-')) return 'equipment_event'
  if (String(input.id).startsWith('WO-')) return 'maintenance'
  if (String(input.id).startsWith('QE-')) return 'quality_event'
  return 'production_alarm'
}

function adaptSource(input, sourceType) {
  const adapters = {
    production_alarm: fromProductionAlarm,
    production_event: fromProductionEvent,
    equipment_event: fromEquipmentEvent,
    maintenance: fromMaintenanceOrder,
    quality_event: fromQualityEvent,
  }
  if (input?.sourceType && alarmStatuses.includes(input.status) && input.sourceEventId) return baseAlarm(input.sourceType, input.sourceEventId, input)
  return (adapters[sourceType] || fromProductionAlarm)(input)
}

/** 转换来源数据、按 sourceType + sourceEventId 去重并保存标准报警。 */
export function createAlarmEvent(input = {}, sourceType) {
  const type = inferSourceType(input, sourceType)
  const normalized = adaptSource(input, type)
  if (!normalized.sourceEventId) return { created: false, reason: 'invalid_source', event: null }
  const events = readEvents()
  const duplicated = events.find((item) => item.sourceType === normalized.sourceType && item.sourceEventId === normalized.sourceEventId)
  if (duplicated) return { created: false, reason: 'duplicate', event: clone(duplicated) }
  const time = normalized.createTime || nowText()
  normalized.id = createAlarmId(events)
  normalized.createTime = time
  normalized.updateTime = normalized.updateTime || time
  if (!normalized.timeline.length) normalized.timeline.push({ action: 'create', operator: '系统', result: `来源：${normalized.sourceType}`, time })
  events.unshift(normalized)
  saveEvents(events)
  return { created: true, reason: 'created', event: clone(normalized) }
}

/**
 * 将现有业务事件单向汇聚到统一报警存储。
 * 生产事件仅同步未关闭项；设备事件以“已生成风险事件”为准；维护工单只建立关联。
 */
export function syncBusinessEventsToAlarms() {
  const productionEvents = getProductionEvents().filter((event) => event.status !== 'closed')
  const equipmentEvents = getEquipmentEvents()

  productionEvents.forEach((event) => createAlarmEvent(event, 'production_event'))
  equipmentEvents.forEach((event) => createAlarmEvent(event, 'equipment_event'))
  const qualityEvents = getQualityEvents()
  qualityEvents.filter(shouldCreateQualityAlarm).forEach((event) => createAlarmEvent(event, 'quality_event'))

  const orders = getMaintenanceOrders()
  const events = readEvents()
  let relationChanged = false
  qualityEvents.filter(shouldCreateQualityAlarm).forEach((qualityEvent) => {
    const alarm = events.find((item) => item.sourceType === 'quality_event' && item.sourceEventId === qualityEvent.id)
    if (!alarm) return
    setQualityEventRelatedAlarm(qualityEvent.id, alarm.id)
    const recovery = qualityEvent.recovery
    if (!recovery || alarm.status !== 'processing' || alarm.timeline.some((item) => item.action === 'quality_reinspection_completed' && item.taskId === recovery.taskId)) return
    const time = nowText()
    alarm.qualityContext = { score: recovery.scoreAfter, level: recovery.levelAfter, abnormalItems: qualityEvent.abnormalItems || [], inspectionTaskId: recovery.taskId, recovery: clone(recovery) }
    alarm.recovery = { type: 'quality_reinspection', verificationType: '质量复检', verificationPassed: recovery.verificationPassed, verificationResult: recovery.verificationPassed ? 'passed' : 'failed', taskId: recovery.taskId, scoreBefore: recovery.scoreBefore, scoreAfter: recovery.scoreAfter, levelBefore: recovery.levelBefore, levelAfter: recovery.levelAfter, description: recovery.message, operator: '质量复检系统', time }
    alarm.status = 'recovery_pending'; alarm.updateTime = time
    alarm.timeline.push({ action: 'quality_reinspection_completed', operator: '质量复检系统', taskId: recovery.taskId, result: `复检评分 ${recovery.scoreBefore} → ${recovery.scoreAfter}，${recovery.levelBefore} → ${recovery.levelAfter}`, time })
    relationChanged = true
  })
  orders.forEach((order) => {
    if (!order.eventId || !order.id) return
    const alarm = events.find((item) => item.sourceType === 'equipment_event' && item.sourceEventId === order.eventId)
    if (!alarm || alarm.relatedOrderId) return
    alarm.relatedEventId = alarm.relatedEventId || order.eventId
    alarm.relatedOrderId = order.id
    alarm.updateTime = nowText()
    relationChanged = true
  })
  orders.filter((order) => order.status === 'completed').forEach((order) => {
    const alarm = events.find((item) => item.sourceType === 'equipment_event' && item.sourceEventId === order.eventId)
    if (!alarm || alarm.status !== 'processing' || alarm.timeline.some((item) => item.action === 'maintenance_completed' && item.orderId === order.id)) return
    const device = equipmentList.find((item) => item.id === order.equipmentId)
    const evaluation = device ? evaluateEquipmentHealth(device) : null
    const snapshot = getEquipmentRecovery(order.equipmentId)
    if (!evaluation || !snapshot) return
    const verificationPassed = evaluation.score >= 80 && evaluation.failureProbability <= 25
    const time = nowText()
    updateEquipmentRecoveryOutcome(order.id, {
      alarmId: alarm.id, afterHealth: evaluation.score, afterProbability: evaluation.failureProbability,
      riskLevelAfter: verificationPassed ? '低风险' : '需继续关注',
    })
    alarm.relatedOrderId = alarm.relatedOrderId || order.id
    alarm.healthScore = evaluation.score
    alarm.failureProbability = evaluation.failureProbability
    alarm.recovery = {
      verificationType: '维护完成设备健康复核',
      verificationStatus: 'submitted',
      verificationResult: verificationPassed ? 'passed' : 'failed',
      verificationPassed,
      orderId: order.id,
      maintenanceCompletedTime: order.updateTime,
      beforeHealth: snapshot.beforeHealth,
      afterHealth: evaluation.score,
      beforeProbability: snapshot.beforeProbability,
      afterProbability: evaluation.failureProbability,
      description: snapshot.description,
      operator: '系统',
      time,
    }
    alarm.status = 'recovery_pending'
    alarm.updateTime = time
    alarm.timeline.push({
      action: 'maintenance_completed', operator: '系统', orderId: order.id,
      result: `工单 ${order.id} 已完成，设备健康由 ${snapshot.beforeHealth} 提升至 ${evaluation.score}，进入恢复验证`, time,
    })
    relationChanged = true
  })
  if (relationChanged) saveEvents(events)
  return getAlarmEvents()
}

let businessSyncCleanup = null

/** 在应用启动时监听现有业务模块事件，无需先进入报警中心页面。 */
export function initializeBusinessAlarmSync() {
  if (typeof window === 'undefined') return () => {}
  if (businessSyncCleanup) return businessSyncCleanup
  const synchronize = () => syncBusinessEventsToAlarms()
  const eventNames = [PRODUCTION_EVENT_CHANGED, EQUIPMENT_EVENT_CHANGED, MAINTENANCE_CHANGED, QUALITY_EVENT_CHANGED]
  eventNames.forEach((eventName) => window.addEventListener(eventName, synchronize))
  synchronize()
  businessSyncCleanup = () => {
    eventNames.forEach((eventName) => window.removeEventListener(eventName, synchronize))
    businessSyncCleanup = null
  }
  return businessSyncCleanup
}

/** 支持 status、equipmentId/equipment、sourceType 过滤。 */
export function getAlarmEvents(filters = {}) {
  const statuses = Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : []
  return readEvents().filter((item) => {
    if (statuses.length && !statuses.includes(item.status)) return false
    if (filters.sourceType && item.sourceType !== filters.sourceType) return false
    if (filters.equipmentId && item.equipmentId !== filters.equipmentId) return false
    if (filters.equipment && !`${item.equipmentId}${item.equipmentName}`.toLowerCase().includes(String(filters.equipment).toLowerCase())) return false
    return true
  }).map(clone)
}

export function getAlarmEventById(alarmId) {
  return clone(readEvents().find((item) => item.id === alarmId) || null)
}

export function validateAlarmTransition(currentStatus, nextStatus) {
  return Boolean(transitions[currentStatus]?.includes(nextStatus))
}

function transitionAlarm(alarmId, nextStatus, action, operator, result = '') {
  const events = readEvents()
  const event = events.find((item) => item.id === alarmId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (!validateAlarmTransition(event.status, nextStatus)) return { updated: false, reason: 'invalid_transition', event: clone(event) }
  const time = nowText()
  event.status = nextStatus
  event.updateTime = time
  event.timeline.push({ action, operator: operator || '当前用户', result, time })
  saveEvents(events)
  return { updated: true, reason: 'updated', event: clone(event) }
}

export function acknowledgeAlarm(alarmId, operator, owner = operator) {
  const result = transitionAlarm(alarmId, 'acknowledged', 'acknowledge', operator, '报警已确认')
  if (!result.updated) return result
  const events = readEvents()
  const event = events.find((item) => item.id === alarmId)
  event.owner = owner || operator || '当前用户'
  event.updateTime = nowText()
  saveEvents(events)
  return { ...result, event: clone(event) }
}

export function startAlarmProcessing(alarmId, operator) {
  return transitionAlarm(alarmId, 'processing', 'start_processing', operator, '开始处理报警')
}

export function appendAlarmAction(alarmId, action, operator, result = '') {
  const events = readEvents()
  const event = events.find((item) => item.id === alarmId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (['closed', 'cancelled'].includes(event.status)) return { updated: false, reason: 'terminal_status', event: clone(event) }
  const record = typeof action === 'object'
    ? { action: action.action || '处理记录', operator: action.operator || operator || '当前用户', result: action.result || result, time: action.time || nowText() }
    : { action: action || '处理记录', operator: operator || '当前用户', result, time: nowText() }
  event.timeline.push(record)
  event.updateTime = record.time
  saveEvents(events)
  return { updated: true, reason: 'appended', event: clone(event) }
}

/** 仅处理中的报警可提交恢复验证，并进入 recovery_pending。 */
export function submitRecoveryVerification(alarmId, recovery = {}, operator) {
  const events = readEvents()
  const event = events.find((item) => item.id === alarmId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (!validateAlarmTransition(event.status, 'recovery_pending')) return { updated: false, reason: 'invalid_transition', event: clone(event) }
  const time = nowText()
  event.recovery = { ...clone(recovery), verificationStatus: recovery.verificationStatus || recovery.status || 'submitted', operator: operator || '当前用户', time }
  event.status = 'recovery_pending'
  event.updateTime = time
  event.timeline.push({ action: recovery.timelineAction || 'submit_recovery', operator: operator || '当前用户', result: recovery.result || recovery.description || '已提交恢复验证', adjustmentId: recovery.adjustmentId || '', time })
  saveEvents(events)
  return { updated: true, reason: 'recovery_submitted', event: clone(event) }
}

/** 恢复验证未通过时，将报警退回处理中并保留验证记录。 */
export function returnAlarmToProcessing(alarmId, operator, result = '恢复验证未通过，返回继续处理') {
  const events = readEvents()
  const event = events.find((item) => item.id === alarmId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (!validateAlarmTransition(event.status, 'processing')) return { updated: false, reason: 'invalid_transition', event: clone(event) }
  const time = nowText()
  event.status = 'processing'
  event.updateTime = time
  event.timeline.push({ action: 'recovery_rejected', operator: operator || '当前用户', result, time })
  saveEvents(events)
  if (event.sourceType === 'production_alarm') {
    const legacy = getLinkedAlarms().find((item) => item.id === event.sourceEventId)
    if (legacy) updateLinkedAlarm({ ...legacy, status: 'processing' })
  }
  return { updated: true, reason: 'returned_to_processing', event: clone(event) }
}

/** 只有 recovery_pending 状态允许关闭。 */
export function closeAlarmEvent(alarmId, operator, result = '恢复验证通过，报警关闭') {
  const event = readEvents().find((item) => item.id === alarmId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.status === 'closed') return { updated: true, reason: 'already_closed', event: clone(event) }
  if (!validateAlarmTransition(event.status, 'closed')) {
    return { updated: false, reason: 'invalid_transition', event: clone(event) }
  }
  const verificationResult = event.recovery?.verificationResult || event.recovery?.result
  if (!['passed', '通过'].includes(verificationResult)) {
    return { updated: false, reason: 'recovery_not_passed', event: clone(event) }
  }
  if (event.sourceType === 'production_event') {
    const productionResult = closeProductionEvent(event.sourceEventId)
    if (!productionResult.closed) return { updated: false, reason: 'source_event_close_failed', event: clone(event) }
  }
  if (event.sourceType === 'quality_event') {
    const qualityResult = confirmQualityRecovery({ eventId: event.sourceEventId, operator, comment: result })
    if (!qualityResult.updated && !['already_closed'].includes(qualityResult.reason)) return { updated: false, reason: 'source_event_close_failed', event: clone(event) }
  }
  const closed = transitionAlarm(alarmId, 'closed', 'close', operator, result)
  if (closed.updated && event.sourceType === 'production_alarm') {
    const legacy = getLinkedAlarms().find((item) => item.id === event.sourceEventId)
    if (legacy) updateLinkedAlarm({ ...legacy, status: 'closed' })
  }
  return closed
}

/** 将生产参数调整结果写入对应 production_event 报警并推进恢复验证。 */
export function submitProductionAdjustmentAlarmRecovery(productionEvent, adjustment, statusResult) {
  const events = readEvents()
  const event = events.find((item) => item.sourceType === 'production_event' && item.sourceEventId === productionEvent?.id)
  if (!event) return { updated: false, reason: 'alarm_not_found', event: null }
  if (event.timeline.some((item) => item.action === 'production_parameter_adjusted' && item.adjustmentId === adjustment.id)) return { updated: true, reason: 'already_submitted', event: clone(event) }
  if (!['processing', 'recovery_pending'].includes(event.status)) return { updated: false, reason: 'invalid_transition', event: clone(event) }
  const time = nowText()
  const passed = statusResult?.status === '正常'
  event.timeline.push({
    action: 'production_parameter_adjusted', operator: adjustment.operator, adjustmentId: adjustment.id,
    result: `${adjustment.process}${adjustment.parameterName}由 ${adjustment.beforeValue} ${adjustment.unit} 调整为 ${adjustment.actualValue} ${adjustment.unit}，参数${passed ? '已恢复正常' : '仍未恢复正常'}`, time,
  })
  event.timeline.push({
    action: 'recovery_verification', operator: '系统', adjustmentId: adjustment.id,
    result: `参数重新分析结果：${statusResult?.status || '未知'}，等待人工验证`, time,
  })
  event.currentValue = adjustment.actualValue
  event.recovery = {
    type: 'production_parameter_adjustment', verificationType: '工艺参数调整', adjustmentId: adjustment.id,
    beforeValue: adjustment.beforeValue, afterValue: adjustment.actualValue, parameterName: adjustment.parameterName,
    unit: adjustment.unit, standardRange: `${adjustment.lowerLimit}–${adjustment.upperLimit} ${adjustment.unit}`,
    verificationPassed: passed, verificationResult: passed ? 'passed' : 'failed',
    description: passed ? `${adjustment.parameterName}已恢复至标准范围` : `${adjustment.parameterName}重新分析后仍异常`,
    operator: '系统', time,
  }
  event.status = 'recovery_pending'
  event.updateTime = time
  saveEvents(events)
  setProductionEventRelatedAlarm(productionEvent.id, event.id)
  return { updated: true, reason: 'recovery_submitted', event: clone(event) }
}

/** 将同一参数对应的实时 production_alarm 推进恢复验证，保持其与 production_event 独立。 */
export function submitProductionAlarmAdjustmentRecovery(adjustment, statusResult) {
  if (statusResult?.status !== '正常') return { updated: false, reason: 'parameter_not_recovered', event: null }
  const rule = findProcessParameterRule({ processId: adjustment.processId, processName: adjustment.process, parameterKey: adjustment.parameterKey })
  const events = readEvents()
  const candidates = events.filter((item) => {
    if (item.sourceType !== 'production_alarm' || item.status !== 'processing' || item.batchId !== adjustment.batchId) return false
    const processMatched = item.processId === adjustment.processId || item.processName === adjustment.process
    const parameterMatched = item.parameterKey === adjustment.parameterKey || rule?.aliases.includes(item.parameterName)
    return processMatched && parameterMatched
  }).sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))
  const event = candidates[0]
  if (!event) return { updated: false, reason: 'alarm_not_found', event: null }
  if (event.timeline.some((item) => item.action === 'production_parameter_adjusted' && item.adjustmentId === adjustment.id)) return { updated: true, reason: 'already_submitted', event: clone(event) }
  const time = nowText()
  event.currentValue = adjustment.actualValue
  event.parameterKey = event.parameterKey || adjustment.parameterKey
  event.parameterName = rule?.parameterName || adjustment.parameterName
  event.timeline.push({ action: 'production_parameter_adjusted', operator: adjustment.operator, adjustmentId: adjustment.id, result: `${adjustment.process}${event.parameterName}由 ${adjustment.beforeValue} ${adjustment.unit} 调整至 ${adjustment.actualValue} ${adjustment.unit}`, time })
  event.timeline.push({ action: 'recovery_verification', operator: '系统', adjustmentId: adjustment.id, result: `系统重新分析工艺参数，当前值已进入 ${adjustment.lowerLimit}–${adjustment.upperLimit} ${adjustment.unit} 范围，等待人工确认`, time })
  event.recovery = {
    type: 'production_parameter_adjustment', verificationType: '工艺参数调整', adjustmentId: adjustment.id,
    beforeValue: adjustment.beforeValue, afterValue: adjustment.actualValue, parameterName: event.parameterName,
    unit: adjustment.unit, standardRange: `${adjustment.lowerLimit}–${adjustment.upperLimit} ${adjustment.unit}`,
    verificationPassed: true, verificationResult: 'passed', description: '工艺参数已恢复至仿真标准范围', operator: '系统', time,
  }
  event.status = 'recovery_pending'
  event.updateTime = time
  saveEvents(events)
  const legacy = getLinkedAlarms().find((item) => item.id === event.sourceEventId)
  if (legacy) updateLinkedAlarm({ ...legacy, status: 'resolved' })
  return { updated: true, reason: 'recovery_submitted', event: clone(event) }
}
