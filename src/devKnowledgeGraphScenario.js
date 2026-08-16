import { appendParameterSample, getProcessParameters } from './processParameter.js'
import { closeProductionEvent, getProductionEvents, submitProductionEventRecovery } from './productionEvent.js'
import { closeAlarmEvent, getAlarmEvents, submitRecoveryVerification } from './alarmEvent.js'
import { getProductionBatch } from './productionPlan.js'

const BACKUP_KEY = 'thick_plate_dev_kg_test_backup'
const PARAMETER_KEY = 'thick_plate_process_parameters'
const PRODUCTION_EVENT_KEY = 'thick_plate_production_events'
const ALARM_EVENT_KEY = 'thick_plate_alarm_events'
const ADJUSTMENT_KEY = 'thick_plate_production_adjustments'
const SCENARIO = 'knowledge_graph_finishing'
const PRODUCTION_EVENT_ID = 'PE-KG-TEST-001'
const ALARM_EVENT_ID = 'ALM-KG-TEST-001'
const ADJUSTMENT_ID = 'ADJ-KG-TEST-001'
const PROCESS_NAME = '精轧'
const PROCESS_ID = 'finishing'
const PARAMETER_NAME = '轧制压力'
const PARAMETER_KEY_NAME = 'rollingPressure'
const ABNORMAL_VALUE = 31457
const RECOVERY_VALUE = 29500
const RANGE = '28000–31000 kN'

const clone = (value) => JSON.parse(JSON.stringify(value))
const nowText = () => new Date().toLocaleString('sv-SE').replace('T', ' ')
const isDev = () => import.meta.env?.DEV === true
function readArray(key) { try { const value = JSON.parse(window.localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] } }
function writeArray(key, value, eventName) { window.localStorage.setItem(key, JSON.stringify(value)); if (eventName) window.dispatchEvent(new CustomEvent(eventName, { detail: clone(value) })) }
function isScenarioRecord(item) { return item?.testScenario === SCENARIO && (item.isDevTest === true || String(item.id || item.adjustmentId || '').includes('KG-TEST')) }
function isTestAlarm(item) {
  return item?.sourceType === 'production_event' && (
    item.id === ALARM_EVENT_ID
    || (item.isDevTest === true && item.testScenario === SCENARIO)
    || (item.title === '精轧轧制压力开发测试异常' && item.processId === PROCESS_ID && item.parameterKey === PARAMETER_KEY_NAME)
  )
}
function findTestAlarms() { return getAlarmEvents().filter(isTestAlarm) }
function findTestProductionEvent() {
  const events = getProductionEvents()
  const sourceIds = new Set(findTestAlarms().map((item) => item.sourceEventId).filter(Boolean))
  return events.find((item) => item.id === PRODUCTION_EVENT_ID)
    || events.find((item) => item.isDevTest === true && item.testScenario === SCENARIO)
    || events.find((item) => sourceIds.has(item.id))
}
function findTestAlarm() { return findTestAlarms()[0] }

function ensureBackup(batchId) {
  const existing = window.localStorage.getItem(BACKUP_KEY)
  if (existing) return JSON.parse(existing)
  const current = getProcessParameters(batchId, PROCESS_NAME)
  const backup = {
    batchId, processId: PROCESS_ID, processName: PROCESS_NAME, parameterKey: PARAMETER_KEY_NAME,
    value: current?.parameters?.[PARAMETER_KEY_NAME] ?? null, timestamp: current?.timestamp || '', source: current?.source || 'formal',
    productionEvent: clone(readArray(PRODUCTION_EVENT_KEY).find((item) => item.id === PRODUCTION_EVENT_ID) || null),
    alarmEvent: clone(readArray(ALARM_EVENT_KEY).find((item) => item.id === ALARM_EVENT_ID) || null),
    createdAt: nowText(),
  }
  window.localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
  return backup
}

function appendDevParameter(batchId, value, stage) {
  const sampleId = `${ADJUSTMENT_ID}-${stage}`
  const result = appendParameterSample({ batchId, process: PROCESS_NAME, parameterKey: PARAMETER_KEY_NAME, value, adjustmentId: sampleId, timestamp: nowText() })
  if (!result.appended && result.reason !== 'duplicate_adjustment') return result
  const records = readArray(PARAMETER_KEY)
  const target = records.find((item) => item.adjustmentId === sampleId)
  if (target) { target.source = 'dev-test'; target.isDevTest = true; target.testScenario = SCENARIO; target.devStage = stage }
  writeArray(PARAMETER_KEY, records, 'process-parameter-changed')
  return { appended: true, reason: result.reason, record: clone(target || result.record) }
}

function ensureTestProductionEvent(batchId) {
  const events = readArray(PRODUCTION_EVENT_KEY)
  let event = events.find((item) => item.id === PRODUCTION_EVENT_ID)
  const time = nowText()
  if (!event) {
    event = { id: PRODUCTION_EVENT_ID, batchId, steelGrade: getProductionBatch(batchId)?.steelGrade || '', process: PROCESS_NAME, processId: PROCESS_ID, parameterKey: PARAMETER_KEY_NAME, parameter: PARAMETER_NAME, parameterName: PARAMETER_NAME, currentValue: ABNORMAL_VALUE, unit: 'kN', threshold: RANGE, level: 'warning', title: '精轧轧制压力开发测试异常', description: '知识图谱开发测试：精轧轧制压力超过仿真范围。', status: 'processing', suggestion: ['仅用于知识图谱开发状态验证'], adjustmentRecord: null, recovery: null, relatedAlarmId: ALARM_EVENT_ID, isDevTest: true, testScenario: SCENARIO, createTime: time, updateTime: time }
    events.unshift(event)
  } else if (event.status === 'closed' || event.status === 'recovery_pending') {
    event.status = 'processing'; event.currentValue = ABNORMAL_VALUE; event.adjustmentRecord = null; event.recovery = null; event.updateTime = time
  }
  writeArray(PRODUCTION_EVENT_KEY, events, 'production-event-changed')
  return clone(event)
}

function ensureTestAlarm(batchId) {
  const events = readArray(ALARM_EVENT_KEY)
  let event = events.find((item) => item.sourceType === 'production_event' && item.sourceEventId === PRODUCTION_EVENT_ID) || events.find((item) => item.id === ALARM_EVENT_ID)
  const time = nowText()
  if (!event) {
    event = { id: ALARM_EVENT_ID, sourceType: 'production_event', sourceEventId: PRODUCTION_EVENT_ID, domain: 'production', batchId, equipmentId: 'FM-01', equipmentName: '四辊精轧机', processId: PROCESS_ID, processName: PROCESS_NAME, parameterKey: PARAMETER_KEY_NAME, parameterName: PARAMETER_NAME, title: '精轧轧制压力开发测试异常', description: '知识图谱开发测试报警', level: 'warning', currentValue: ABNORMAL_VALUE, threshold: RANGE, unit: 'kN', healthScore: null, failureProbability: null, status: 'processing', owner: '开发测试', causeAnalysis: '开发测试参数样本超过仿真范围', suggestions: ['仅用于知识图谱状态联动验证'], relatedEventId: PRODUCTION_EVENT_ID, relatedOrderId: '', timeline: [{ action: 'create', operator: '开发测试', result: '创建知识图谱开发测试报警', time }], recovery: null, isDevTest: true, testScenario: SCENARIO, createTime: time, updateTime: time }
    events.unshift(event)
  } else if (event.status === 'closed' || event.status === 'recovery_pending') {
    event.status = 'processing'; event.currentValue = ABNORMAL_VALUE; event.recovery = null; event.updateTime = time; event.timeline = [...(event.timeline || []), { action: 'dev_test_reinject', operator: '开发测试', result: '重新注入当前异常场景', time }]
  }
  event.isDevTest = true
  event.testScenario = SCENARIO
  writeArray(ALARM_EVENT_KEY, events, 'alarm-event-changed')
  return clone(event)
}

function reconnectTestAlarms(productionEvent) {
  const events = readArray(ALARM_EVENT_KEY)
  let changed = false
  events.forEach((item) => {
    if (!isTestAlarm(item)) return
    if (item.sourceEventId !== productionEvent.id || item.relatedEventId !== productionEvent.id || !item.isDevTest || item.testScenario !== SCENARIO) {
      item.sourceEventId = productionEvent.id
      item.relatedEventId = productionEvent.id
      item.isDevTest = true
      item.testScenario = SCENARIO
      item.updateTime = nowText()
      changed = true
    }
  })
  if (changed) writeArray(ALARM_EVENT_KEY, events, 'alarm-event-changed')
}

function repairOrphanTestScenario() {
  const alarms = findTestAlarms()
  let productionEvent = findTestProductionEvent()
  if (!productionEvent && alarms.length) {
    const batchId = alarms[0].batchId || getProductionBatch()?.batchId
    if (!batchId) return { repaired: false, reason: 'batch_not_found', productionEvent: null }
    productionEvent = ensureTestProductionEvent(batchId)
    const recovery = submitProductionEventRecovery({ eventId: productionEvent.id, adjustmentId: ADJUSTMENT_ID, beforeValue: ABNORMAL_VALUE, afterValue: RECOVERY_VALUE, operator: '开发测试', reason: '修复知识图谱测试孤儿报警关联', result: '恢复验证已存在，重建测试生产事件', parameterStatus: 'normal', verificationPassed: true, executeTime: nowText(), relatedAlarmId: alarms[0].id })
    if (!recovery.updated) return { repaired: false, reason: recovery.reason, productionEvent: recovery.event }
    productionEvent = recovery.event
  }
  if (productionEvent) reconnectTestAlarms(productionEvent)
  return { repaired: Boolean(productionEvent), reason: productionEvent ? 'reconnected' : 'scenario_not_injected', productionEvent }
}

export function injectFinishingAbnormalScenario() {
  if (!isDev()) return { updated: false, reason: 'dev_only' }
  const batch = getProductionBatch(); if (!batch) return { updated: false, reason: 'batch_not_found' }
  ensureBackup(batch.batchId)
  const parameter = appendDevParameter(batch.batchId, ABNORMAL_VALUE, 'current_abnormal')
  if (!parameter.appended) return { updated: false, reason: parameter.reason }
  return { updated: true, state: 'current_abnormal', parameter, productionEvent: ensureTestProductionEvent(batch.batchId), alarm: ensureTestAlarm(batch.batchId) }
}

export function setFinishingRecoveryPendingScenario() {
  if (!isDev()) return { updated: false, reason: 'dev_only' }
  const backup = JSON.parse(window.localStorage.getItem(BACKUP_KEY) || 'null')
  const productionEvent = findTestProductionEvent(), alarms = findTestAlarms()
  if (!backup || !productionEvent || !alarms.length) return { updated: false, reason: 'scenario_not_injected' }
  const parameter = appendDevParameter(backup.batchId, RECOVERY_VALUE, 'recovery_pending')
  if (!parameter.appended) return { updated: false, reason: parameter.reason }
  const productionResult = productionEvent.status === 'recovery_pending' ? { updated: true, event: productionEvent } : submitProductionEventRecovery({ eventId: PRODUCTION_EVENT_ID, adjustmentId: ADJUSTMENT_ID, beforeValue: ABNORMAL_VALUE, afterValue: RECOVERY_VALUE, operator: '开发测试', reason: '知识图谱 recovery_pending 状态验证', result: '轧制压力已恢复至仿真范围', parameterStatus: 'normal', verificationPassed: true, executeTime: nowText(), relatedAlarmId: ALARM_EVENT_ID })
  if (!productionResult.updated) return { updated: false, reason: productionResult.reason }
  const alarmResults = alarms.map((alarm) => alarm.status === 'recovery_pending' ? { updated: true, event: alarm } : submitRecoveryVerification(alarm.id, { verificationType: '开发场景验证', description: '知识图谱 recovery_pending 状态验证', verificationResult: 'passed', result: '恢复参数并进入待确认', adjustmentId: ADJUSTMENT_ID }, '开发测试'))
  const failed = alarmResults.find((item) => !item.updated)
  return { updated: !failed, state: 'recovery_pending', parameter, productionEvent: productionResult.event, alarm: alarmResults[0]?.event, reason: failed?.reason || 'recovery_submitted' }
}

export function closeFinishingTestScenario() {
  if (!isDev()) return { updated: false, reason: 'dev_only' }
  const repair = repairOrphanTestScenario()
  if (!repair.repaired) return { updated: false, reason: repair.reason }
  const alarms = findTestAlarms(); if (!alarms.length) return { updated: false, reason: 'scenario_not_injected' }
  const results = alarms.map((alarm) => alarm.status === 'closed' ? { updated: true, reason: 'already_closed', event: alarm } : alarm.status === 'recovery_pending' ? closeAlarmEvent(alarm.id, '开发测试', '知识图谱开发测试恢复验证通过，关闭报警') : { updated: false, reason: 'recovery_required', event: alarm })
  const failed = results.find((item) => !item.updated)
  if (failed) {
    console.error('[KG dev test] close alarm failed', { alarmId: failed.event?.id || '', reason: failed.reason })
    return { updated: false, reason: failed.reason, state: 'recovery_pending', alarm: failed.event, productionEvent: findTestProductionEvent() }
  }
  const productionEvent = repair.productionEvent || findTestProductionEvent()
  if (productionEvent?.status === 'recovery_pending') closeProductionEvent(PRODUCTION_EVENT_ID)
  return { updated: true, reason: 'closed', state: 'closed', alarm: results[0]?.event, productionEvent: findTestProductionEvent() }
}

export function cleanupKnowledgeGraphTestScenario() {
  if (!isDev()) return { updated: false, reason: 'dev_only' }
  const backup = JSON.parse(window.localStorage.getItem(BACKUP_KEY) || 'null')
  const parameters = readArray(PARAMETER_KEY).filter((item) => !(item.source === 'dev-test' && item.testScenario === SCENARIO) && !String(item.adjustmentId || '').startsWith(ADJUSTMENT_ID))
  const productionEvents = readArray(PRODUCTION_EVENT_KEY).filter((item) => !isScenarioRecord(item) && item.id !== PRODUCTION_EVENT_ID)
  const alarms = readArray(ALARM_EVENT_KEY).filter((item) => !isScenarioRecord(item) && !isTestAlarm(item))
  const adjustments = readArray(ADJUSTMENT_KEY).filter((item) => !isScenarioRecord(item) && !String(item.id || '').startsWith(ADJUSTMENT_ID))
  if (backup?.productionEvent) productionEvents.unshift(backup.productionEvent)
  if (backup?.alarmEvent) alarms.unshift(backup.alarmEvent)
  writeArray(PARAMETER_KEY, parameters, 'process-parameter-changed'); writeArray(PRODUCTION_EVENT_KEY, productionEvents, 'production-event-changed'); writeArray(ALARM_EVENT_KEY, alarms, 'alarm-event-changed'); writeArray(ADJUSTMENT_KEY, adjustments, 'production-adjustment-changed')
  window.localStorage.removeItem(BACKUP_KEY)
  const restored = backup ? getProcessParameters(backup.batchId, PROCESS_NAME)?.parameters?.[PARAMETER_KEY_NAME] : null
  return { updated: true, reason: 'cleaned', state: 'not_injected', restoredValue: restored, backupValue: backup?.value ?? null }
}

export function getKnowledgeGraphTestScenarioState() {
  if (!isDev()) return { state: 'unavailable', label: '仅开发环境可用', injected: false }
  const alarms = findTestAlarms(), alarm = alarms[0], productionEvent = findTestProductionEvent(), backup = JSON.parse(window.localStorage.getItem(BACKUP_KEY) || 'null')
  const state = !backup && !alarm && !productionEvent ? 'not_injected' : alarms.length && alarms.every((item) => item.status === 'closed') && productionEvent?.status === 'closed' ? 'closed' : alarms.some((item) => item.status === 'recovery_pending') || productionEvent?.status === 'recovery_pending' ? 'recovery_pending' : 'current_abnormal'
  const labels = { not_injected: '未注入', current_abnormal: '当前异常', recovery_pending: '待恢复确认', closed: '已关闭' }
  return { state, label: labels[state], injected: state !== 'not_injected', batchId: backup?.batchId || alarm?.batchId || productionEvent?.batchId || '', productionEventId: productionEvent?.id || '', alarmId: alarm?.id || '' }
}
