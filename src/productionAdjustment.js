import { appendParameterSample, getProcessParameters, processParameterRules } from './processParameter.js'
import { getProductionEvents, submitProductionEventRecovery } from './productionEvent.js'
import { getAlarmEvents, submitProductionAdjustmentAlarmRecovery, submitProductionAlarmAdjustmentRecovery } from './alarmEvent.js'

/** 生产工艺参数调整执行层：只管理仿真调整记录与采样追加。 */
const STORAGE_KEY = 'thick_plate_production_adjustments'
export const PRODUCTION_ADJUSTMENT_CHANGED = 'production-adjustment-changed'

const processIds = { 板坯加热: 'heating', 粗轧: 'roughing', 精轧: 'finishing', 控冷: 'cooling', 质量检测: 'inspection' }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)) }
function nowText(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function readAdjustments() {
  if (typeof window === 'undefined') return []
  try { const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(data) ? data : [] } catch { return [] }
}
function saveAdjustments(records) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records)) }
function createId(records, date = new Date()) {
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `PA-${day}-${String(records.length + 1).padStart(3, '0')}`
}

export function createProductionAdjustment(input = {}) {
  const rule = processParameterRules[input.process]?.[input.parameterKey]
  const current = getProcessParameters(input.batchId, input.process)
  if (!rule || !current || !Number.isFinite(Number(input.targetValue))) return { created: false, reason: 'invalid_input', adjustment: null }
  const records = readAdjustments()
  const time = nowText()
  const adjustment = {
    id: input.id || createId(records), batchId: input.batchId, process: input.process,
    processId: input.processId || processIds[input.process] || '', parameterKey: input.parameterKey,
    parameterName: input.parameterName || rule.name, beforeValue: Number(current.parameters[input.parameterKey]),
    targetValue: Number(input.targetValue), actualValue: null, unit: rule.unit,
    lowerLimit: rule.min, upperLimit: rule.max, operator: input.operator || '未填写',
    reason: input.reason || `${rule.name}异常，执行模拟工艺参数调整`, result: '', status: 'pending',
    dataMode: '工艺调整演示 · 基于工业仿真数据', createTime: time, completeTime: '',
  }
  records.unshift(adjustment)
  saveAdjustments(records)
  return { created: true, reason: 'created', adjustment: clone(adjustment) }
}

export function executeProductionAdjustment(adjustmentOrId) {
  const records = readAdjustments()
  const id = typeof adjustmentOrId === 'string' ? adjustmentOrId : adjustmentOrId?.id
  const adjustment = records.find((item) => item.id === id)
  if (!adjustment) return { executed: false, reason: 'not_found', adjustment: null }
  if (adjustment.status === 'completed') return { executed: true, reason: 'already_completed', adjustment: clone(adjustment) }
  if (adjustment.targetValue < adjustment.lowerLimit || adjustment.targetValue > adjustment.upperLimit) return { executed: false, reason: 'target_out_of_range', adjustment: clone(adjustment) }
  const current = getProcessParameters(adjustment.batchId, adjustment.process)
  if (!current) return { executed: false, reason: 'parameter_not_found', adjustment: clone(adjustment) }
  adjustment.beforeValue = Number(current.parameters[adjustment.parameterKey])
  const sample = appendParameterSample({ batchId: adjustment.batchId, process: adjustment.process, parameterKey: adjustment.parameterKey, value: adjustment.targetValue, timestamp: nowText(), adjustmentId: adjustment.id })
  if (!sample.appended && sample.reason !== 'duplicate_adjustment') return { executed: false, reason: sample.reason, adjustment: clone(adjustment) }
  adjustment.actualValue = Number(sample.record.parameters[adjustment.parameterKey])
  adjustment.status = 'completed'
  adjustment.result = '参数恢复至标准范围'
  adjustment.completeTime = sample.record.timestamp
  saveAdjustments(records)
  const actualRecord = getProcessParameters(adjustment.batchId, adjustment.process)
  const rule = processParameterRules[adjustment.process]?.[adjustment.parameterKey]
  const actualValue = Number(actualRecord?.parameters?.[adjustment.parameterKey])
  const parameterStatus = actualValue > rule.max ? '偏高' : actualValue < rule.min ? '偏低' : '正常'
  const sourceEvent = getProductionEvents().find((item) => item.batchId === adjustment.batchId && item.process === adjustment.process && item.parameterKey === adjustment.parameterKey && item.status === 'processing')
  let productionEventResult = { updated: false, reason: 'event_not_found', event: null }
  let alarmResult = { updated: false, reason: 'alarm_not_found', event: null }
  if (sourceEvent) {
    const relatedAlarm = getAlarmEvents().find((item) => item.sourceType === 'production_event' && item.sourceEventId === sourceEvent.id)
    productionEventResult = submitProductionEventRecovery({
      eventId: sourceEvent.id, adjustmentId: adjustment.id, beforeValue: adjustment.beforeValue,
      afterValue: adjustment.actualValue, operator: adjustment.operator, reason: adjustment.reason,
      result: parameterStatus === '正常' ? `${adjustment.parameterName}已恢复至标准范围` : `${adjustment.parameterName}仍未恢复至标准范围`,
      parameterStatus: parameterStatus === '正常' ? 'normal' : 'abnormal', verificationPassed: parameterStatus === '正常',
      executeTime: adjustment.completeTime, relatedAlarmId: relatedAlarm?.id || '',
    })
    if (productionEventResult.updated) alarmResult = submitProductionAdjustmentAlarmRecovery(productionEventResult.event, adjustment, { status: parameterStatus })
  }
  const productionAlarmResult = submitProductionAlarmAdjustmentRecovery(adjustment, { status: parameterStatus })
  window.dispatchEvent(new CustomEvent(PRODUCTION_ADJUSTMENT_CHANGED, { detail: clone(adjustment) }))
  return { executed: true, reason: sample.reason === 'duplicate_adjustment' ? 'already_sampled' : 'completed', adjustment: clone(adjustment), parameterStatus, productionEventResult, alarmResult, productionAlarmResult }
}

export function getProductionAdjustments() { return clone(readAdjustments()) }
export function getAdjustmentById(id) { return clone(readAdjustments().find((item) => item.id === id) || null) }
export function getAdjustmentsByBatch(batchId) { return clone(readAdjustments().filter((item) => item.batchId === batchId)) }
