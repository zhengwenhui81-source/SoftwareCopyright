/** 厚板生产工艺参数模拟数据层，仅负责采集记录、趋势查询和状态判断。 */
const STORAGE_KEY = 'thick_plate_process_parameters'

export const processParameterRules = {
  板坯加热: {
    furnaceTemperature: { name: '炉温', unit: '℃', min: 1180, max: 1230, type: 'temperature' },
    heatingTime: { name: '加热时间', unit: 'min', min: 150, max: 180, type: 'time' },
  },
  粗轧: {
    rollingForce: { name: '轧制力', unit: 'kN', min: 26000, max: 30000, type: 'pressure' },
    rollingSpeed: { name: '轧制速度', unit: 'm/s', min: 2.5, max: 3.2, type: 'speed' },
  },
  精轧: {
    rollingPressure: { name: '轧制压力', unit: 'kN', min: 28000, max: 31000, type: 'pressure' },
    thickness: { name: '板厚', unit: 'mm', min: 29.7, max: 30.3, type: 'thickness' },
  },
  控冷: {
    coolingRate: { name: '冷却速度', unit: '℃/s', min: 12, max: 18, type: 'speed' },
    finishCoolingTemperature: { name: '终冷温度', unit: '℃', min: 620, max: 680, type: 'temperature' },
  },
  质量检测: {
    thicknessDeviation: { name: '厚度偏差', unit: 'mm', min: -0.3, max: 0.3, type: 'thickness' },
    surfaceQuality: { name: '表面质量等级', unit: '级', min: 1, max: 2, type: 'quality' },
  },
}

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
      key, ...rule, value, range: `${rule.min} - ${rule.max} ${rule.unit}`, status,
      level: status === '正常' ? 'normal' : status === '偏高' ? 'high' : 'low',
      description: status === '正常' ? `${rule.name}处于厚板工艺标准范围内。` : `${rule.name}${status === '偏高' ? '超过上限' : '低于下限'}，建议复核工艺设定与采样状态。`,
    }
  })
}
