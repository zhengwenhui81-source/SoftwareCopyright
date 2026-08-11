/**
 * 设备健康评价模块
 *
 * 基于前端 Mock 设备参数进行可解释的健康评分与故障概率模拟。
 * 本模块不连接后端、不修改设备数据，只返回计算结果。
 */

const DEFAULT_PROFILE = {
  temperature: { warning: 80, critical: 100, weight: 20, unit: '℃', label: '设备温度' },
  pressure: { warning: 30, critical: 35, weight: 20, unit: 'MPa', label: '系统压力' },
  vibration: { warning: 4.5, critical: 6, weight: 30, unit: 'mm/s', label: '振动速度' },
  load: { warning: 90, critical: 98, weight: 15, unit: '%', label: '设备负载' },
  runtime: { warning: 4000, critical: 5000, weight: 15, unit: 'h', label: '累计运行时间' },
}

/** 不同设备使用不同的模拟预警阈值。 */
export const equipmentHealthProfiles = {
  'RF-01': {
    temperature: { warning: 1230, critical: 1250 },
    pressure: { warning: 0.5, critical: 0.6 },
    vibration: { warning: 3.5, critical: 5 },
    runtime: { warning: 4500, critical: 5500 },
  },
  'RM-01': {
    temperature: { warning: 80, critical: 95 },
    pressure: { warning: 30, critical: 33 },
    vibration: { warning: 4.5, critical: 6 },
    runtime: { warning: 4200, critical: 5000 },
  },
  'FM-01': {
    temperature: { warning: 75, critical: 90 },
    pressure: { warning: 32, critical: 35 },
    vibration: { warning: 4.5, critical: 6 },
    load: { warning: 90, critical: 98 },
    runtime: { warning: 4000, critical: 4800 },
  },
  'ACC-01': {
    temperature: { warning: 45, critical: 60 },
    pressure: { warning: 0.75, critical: 0.9 },
    vibration: { warning: 3.5, critical: 5 },
    runtime: { warning: 3800, critical: 4600 },
  },
  'UT-01': {
    temperature: { warning: 50, critical: 65 },
    pressure: { warning: 0.5, critical: 0.7 },
    vibration: { warning: 3, critical: 4.5 },
    runtime: { warning: 2800, critical: 3500 },
  },
}

export const healthLevels = [
  { min: 90, key: 'healthy', label: '健康', color: '#2bd398', risk: '低' },
  { min: 80, key: 'attention', label: '关注', color: '#35a9e9', risk: '较低' },
  { min: 65, key: 'warning', label: '预警', color: '#ffad45', risk: '中' },
  { min: 0, key: 'high-risk', label: '高风险', color: '#ef6262', risk: '高' },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function getProfile(deviceId) {
  const overrides = equipmentHealthProfiles[deviceId] || {}
  return Object.fromEntries(Object.entries(DEFAULT_PROFILE).map(([key, item]) => [key, { ...item, ...(overrides[key] || {}) }]))
}

function calculatePenalty(value, rule) {
  if (!Number.isFinite(value) || value <= rule.warning) return 0
  if (value >= rule.critical) return rule.weight
  const ratio = (value - rule.warning) / (rule.critical - rule.warning)
  return rule.weight * (0.35 + ratio * 0.65)
}

/** 根据温度、压力、振动、负载和运行时间计算 0–100 健康分。 */
export function calculateHealthScore(device) {
  if (!device || typeof device !== 'object') return 0
  const profile = getProfile(device.id)
  const penalty = Object.entries(profile).reduce((sum, [key, rule]) => sum + calculatePenalty(Number(device[key]), rule), 0)
  return Math.round(clamp(100 - penalty, 0, 100))
}

/** 将健康评分转换为健康等级。 */
export function getHealthLevel(score) {
  const normalizedScore = clamp(Number(score) || 0, 0, 100)
  return { ...healthLevels.find((item) => normalizedScore >= item.min) }
}

/** 返回所有超过预警阈值的可解释风险因素。 */
export function analyzeRiskFactors(device) {
  if (!device || typeof device !== 'object') return []
  const profile = getProfile(device.id)

  return Object.entries(profile).flatMap(([key, rule]) => {
    const value = Number(device[key])
    if (!Number.isFinite(value) || value <= rule.warning) return []
    const severity = value >= rule.critical ? 'high' : 'medium'
    return [{
      key,
      label: rule.label,
      value,
      unit: rule.unit,
      warningThreshold: rule.warning,
      criticalThreshold: rule.critical,
      severity,
      description: `${rule.label}${severity === 'high' ? '超过高风险阈值' : '超过预警阈值'}`,
    }]
  })
}

function stableDeviceOffset(deviceId = '') {
  const hash = [...deviceId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return hash % 6
}

/**
 * 模拟未来 24 小时故障概率。
 * 结果由健康分、风险因素和设备编号稳定偏移共同计算，刷新页面不会随机跳变。
 */
export function simulateFailureProbability(device, score = calculateHealthScore(device), riskFactors = analyzeRiskFactors(device)) {
  const highRisks = riskFactors.filter((item) => item.severity === 'high').length
  const mediumRisks = riskFactors.filter((item) => item.severity === 'medium').length
  const baseProbability = (100 - score) * 0.72
  const riskProbability = highRisks * 14 + mediumRisks * 6
  return Math.round(clamp(3 + baseProbability + riskProbability + stableDeviceOffset(device?.id), 3, 95))
}

/** 一次返回设备健康评价所需的完整结果。 */
export function evaluateEquipmentHealth(device) {
  const score = calculateHealthScore(device)
  const level = getHealthLevel(score)
  const riskFactors = analyzeRiskFactors(device)
  const failureProbability = simulateFailureProbability(device, score, riskFactors)

  return {
    equipmentId: device?.id || '',
    equipmentName: device?.name || '',
    score,
    level,
    riskFactors,
    failureProbability,
    predictionWindow: '未来24小时',
    dataMode: '工业仿真数据',
  }
}

/** 批量评价设备列表，不修改传入数组。 */
export function evaluateEquipmentList(devices = []) {
  return devices.map((device) => evaluateEquipmentHealth(device))
}
