import { applyEquipmentRecovery } from './equipmentRecovery.js'

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
  const effectiveDevice = applyEquipmentRecovery(device)
  const profile = getProfile(effectiveDevice.id)
  const penalty = Object.entries(profile).reduce((sum, [key, rule]) => sum + calculatePenalty(Number(effectiveDevice[key]), rule), 0)
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
  const effectiveDevice = applyEquipmentRecovery(device)
  const profile = getProfile(effectiveDevice.id)

  return Object.entries(profile).flatMap(([key, rule]) => {
    const value = Number(effectiveDevice[key])
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

const diagnosisCatalog = {
  vibration: {
    abnormal: '设备振动指标升高',
    component: '传动侧轴承及联轴器',
    checks: ['检查轴承润滑状态', '复核设备振动频谱', '检查传动系统连接与紧固状态'],
  },
  temperature: {
    abnormal: '设备温度指标升高',
    component: '冷却回路及高温工作部件',
    checks: ['检查冷却介质流量', '复核温度测点状态', '检查高温部件散热情况'],
  },
  pressure: {
    abnormal: '系统压力偏离安全区间',
    component: '液压泵组、阀组及密封件',
    checks: ['检查液压回路压力', '检查阀组工作状态', '排查管路及密封件泄漏'],
  },
  load: {
    abnormal: '设备负载持续偏高',
    component: '主传动电机及负载执行机构',
    checks: ['核对生产负载设定', '检查主电机电流', '检查执行机构运行阻力'],
  },
  runtime: {
    abnormal: '设备累计运行时间接近维护周期',
    component: '周期维护部件及易损件',
    checks: ['核对预防性维护周期', '检查关键易损件状态', '安排停机点检窗口'],
  },
}

/** 根据健康评价结果生成可解释的模拟诊断结论。 */
export function generateHealthDiagnosis(device, evaluation) {
  const risks = evaluation?.riskFactors || analyzeRiskFactors(device)
  const primaryRisk = [...risks].sort((a, b) => {
    const severity = { high: 2, medium: 1 }
    return (severity[b.severity] || 0) - (severity[a.severity] || 0)
  })[0]

  if (!primaryRisk) {
    return {
      mainAbnormality: '当前关键指标未超过模拟预警阈值',
      possibleRiskComponent: '未发现明确高风险部件',
      recommendedChecks: ['保持例行巡检', '持续观察温度、压力与振动趋势', '按计划执行预防性维护'],
    }
  }

  const conclusion = diagnosisCatalog[primaryRisk.key] || diagnosisCatalog.runtime
  return {
    mainAbnormality: conclusion.abnormal,
    possibleRiskComponent: `${device?.type || '设备'} · ${conclusion.component}`,
    recommendedChecks: [...conclusion.checks],
  }
}

/** 一次返回设备健康评价所需的完整结果。 */
export function evaluateEquipmentHealth(device) {
  const effectiveDevice = applyEquipmentRecovery(device)
  const score = calculateHealthScore(effectiveDevice)
  const level = getHealthLevel(score)
  const riskFactors = analyzeRiskFactors(effectiveDevice)
  const failureProbability = simulateFailureProbability(effectiveDevice, score, riskFactors)
  const evaluation = { score, level, riskFactors, failureProbability }

  return {
    equipmentId: effectiveDevice?.id || '',
    equipmentName: effectiveDevice?.name || '',
    score,
    level,
    riskFactors,
    failureProbability,
    diagnosis: generateHealthDiagnosis(effectiveDevice, evaluation),
    effectiveDevice,
    recovery: effectiveDevice.recovery || null,
    predictionWindow: '未来24小时',
    dataMode: '工业仿真数据',
  }
}

/** 批量评价设备列表，不修改传入数组。 */
export function evaluateEquipmentList(devices = []) {
  return devices.map((device) => evaluateEquipmentHealth(device))
}
