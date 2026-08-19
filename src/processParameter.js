import { processParameterRules } from './processParameterRules.js'

/** 厚板生产工艺参数模拟数据层，仅负责采集记录、趋势查询和状态判断。 */
const STORAGE_KEY = 'thick_plate_process_parameters'
export const PROCESS_PARAMETER_CHANGED = 'process-parameter-changed'

export { processParameterRules }

const baseValues = {
  板坯加热: { furnaceTemperature: 1216, heatingTime: 168 },
  粗轧: { rollingForce: 28450, rollingSpeed: 2.86 },
  精轧: { rollingPressure: 31280, thickness: 30.12 },
  控冷: { coolingRate: 14.5, finishCoolingTemperature: 648 },
  质量检测: { thicknessDeviation: 0.12, surfaceQuality: 1 },
}

const amplitudes = {
  furnaceTemperature: 16, heatingTime: 6, rollingForce: 900, rollingSpeed: 0.18, rollingPressure: 1100,
  thickness: 0.14, coolingRate: 1.2, finishCoolingTemperature: 18, thicknessDeviation: 0.1, surfaceQuality: 0,
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function formatTimestamp(index) {
  const minute = 5 + index * 5
  const hour = 21 + Math.floor(minute / 60)
  return `2026-08-11 ${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`
}

function createDefaultRecords() {
  return Object.entries(baseValues).flatMap(([process, values], processIndex) => Array.from({ length: 12 }, (_, index) => {
    const parameters = Object.fromEntries(Object.entries(values).map(([key, base]) => {
      const amplitude = amplitudes[key] || 0
      const wave = Math.sin(index * 0.8 + processIndex) * amplitude * 0.55 + Math.cos(index * 0.35) * amplitude * 0.2
      const decimals = Math.abs(base) < 10 ? 2 : Math.abs(base) < 100 ? 2 : 0
      let value = Number((base + wave).toFixed(decimals))
      if (process === '精轧' && key === 'rollingPressure' && index === 11) value = 31280
      return [key, value]
    }))
    return { batchId: 'PL-20260810-027', process, parameters, timestamp: formatTimestamp(index) }
  }))
}

function readRecords() {
  if (typeof window === 'undefined') return createDefaultRecords()
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(saved) && saved.length) return saved
  } catch { /* 使用默认工业仿真记录 */ }
  const initial = createDefaultRecords()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

function saveRecords(records) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

const runtimeSampleThresholds = {
  furnaceTemperature: 2, heatingTime: 1, rollingForce: 100, rollingSpeed: .05,
  rollingPressure: 100, thickness: .03, coolingRate: .2, finishCoolingTemperature: 2,
  thicknessDeviation: .03, surfaceQuality: 1,
}

/** 追加生产运行仿真采样；同工序最多每10秒持久化一次，默认需达到最小变化量。 */
export function appendRuntimeParameterSample(input = {}) {
  const { batchId, process } = input
  const rules = processParameterRules[process]
  if (!batchId || !process || !rules || !input.parameters) return { appended: false, reason: 'invalid_input', record: null }
  const records = readRecords()
  const previous = [...records].reverse().find((item) => item.batchId === batchId && item.process === process)
  const timestamp = input.timestamp || new Date().toLocaleString('sv-SE').replace('T', ' ')
  const monitored = Object.fromEntries(Object.keys(rules).filter((key) => Number.isFinite(Number(input.parameters[key]))).map((key) => [key, Number(input.parameters[key])]))
  if (!Object.keys(monitored).length) return { appended: false, reason: 'no_monitored_parameter', record: previous ? clone(previous) : null }
  if (!previous) {
    const record = { batchId, process, processId: input.processId || '', parameters: monitored, timestamp, source: 'simulation', adjustmentId: '' }
    records.push(record); saveRecords(records)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROCESS_PARAMETER_CHANGED, { detail: { batchId, process, processId: input.processId || '', parameters: clone(record.parameters), source: 'simulation', record: clone(record) } }))
    return { appended: true, reason: 'initial_sample', record: clone(record) }
  }
  const previousTime = Date.parse(String(previous.timestamp).replace(' ', 'T'))
  const currentTime = Date.parse(String(timestamp).replace(' ', 'T'))
  if (previous.source === 'simulation' && Number.isFinite(previousTime) && Number.isFinite(currentTime) && currentTime - previousTime < 10000) return { appended: false, reason: 'throttled', record: clone(previous) }
  const changed = Object.entries(monitored).some(([key, value]) => Math.abs(value - Number(previous.parameters[key])) >= (runtimeSampleThresholds[key] ?? .01))
  if (!changed && !input.recordUnchanged) return { appended: false, reason: 'change_below_threshold', record: clone(previous) }
  const record = { batchId, process, processId: input.processId || '', parameters: { ...previous.parameters, ...monitored }, timestamp, source: 'simulation', adjustmentId: '' }
  records.push(record); saveRecords(records)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROCESS_PARAMETER_CHANGED, { detail: { batchId, process, processId: input.processId || '', parameters: clone(record.parameters), source: 'simulation', record: clone(record) } }))
  return { appended: true, reason: 'appended', record: clone(record) }
}

/** 基于最新完整记录追加一次参数采样，不覆盖历史；adjustmentId 用于幂等去重。 */
export function appendParameterSample(input = {}) {
  const { batchId, process, parameterKey, adjustmentId } = input
  const rule = processParameterRules[process]?.[parameterKey]
  const value = Number(input.value)
  if (!batchId || !process || !parameterKey || !rule || !Number.isFinite(value)) return { appended: false, reason: 'invalid_input', record: null }
  const records = readRecords()
  const duplicated = adjustmentId && records.find((item) => item.adjustmentId === adjustmentId)
  if (duplicated) return { appended: false, reason: 'duplicate_adjustment', record: clone(duplicated) }
  const previous = [...records].reverse().find((item) => item.batchId === batchId && item.process === process)
  if (!previous) return { appended: false, reason: 'record_not_found', record: null }
  const timestamp = input.timestamp || new Date().toLocaleString('sv-SE').replace('T', ' ')
  const record = {
    batchId, process,
    parameters: { ...previous.parameters, [parameterKey]: value },
    timestamp,
    adjustmentId: adjustmentId || '',
    source: 'adjustment',
  }
  records.push(record)
  saveRecords(records)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROCESS_PARAMETER_CHANGED, { detail: { batchId, process, parameterKey, value, adjustmentId: adjustmentId || '', source: 'adjustment', record: clone(record) } }))
  return { appended: true, reason: 'appended', record: clone(record) }
}

/** 获取指定批次和工序的最新参数采样。 */
export function getProcessParameters(batchId, process) {
  const records = readRecords().filter((item) => (!batchId || item.batchId === batchId) && (!process || item.process === process))
  return records.length ? clone(records[records.length - 1]) : null
}

/** 获取指定参数的历史趋势，并附带正常上下限。 */
export function getParameterTrend(batchId, process, parameterKey) {
  const rule = processParameterRules[process]?.[parameterKey]
  if (!rule) return { parameterKey, name: parameterKey, unit: '', min: 0, max: 0, points: [] }
  const points = readRecords().filter((item) => item.batchId === batchId && item.process === process).map((item) => ({ timestamp: item.timestamp, value: item.parameters[parameterKey] }))
  return { parameterKey, ...rule, points }
}

/** 根据工序标准范围输出参数名称、当前值、状态等级和异常说明。 */
export function analyzeParameterStatus(record) {
  if (!record) return []
  const rules = processParameterRules[record.process] || {}
  return Object.entries(rules).map(([key, rule]) => {
    const value = Number(record.parameters[key])
    const status = value > rule.max ? '偏高' : value < rule.min ? '偏低' : '正常'
    return {
      key, ...rule, name: rule.parameterName, value, range: `${rule.min} - ${rule.max} ${rule.unit}`, status,
      level: status === '正常' ? 'normal' : status === '偏高' ? 'high' : 'low',
      description: status === '正常' ? `${rule.parameterName}处于厚板工艺标准范围内。` : `${rule.parameterName}${status === '偏高' ? '超过上限' : '低于下限'}，建议复核工艺设定与采样状态。`,
    }
  })
}
