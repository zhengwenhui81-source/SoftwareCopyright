const STORAGE_KEY = 'plate-monitor-linked-alarms'
const EVENT_NAME = 'plate-monitor:alarm-created'

const thresholdRules = [
  { processId: 'heating', parameter: '加热温度', min: 1180, max: 1230, level: 'critical', reason: '板坯加热温度超出工艺阈值', suggestion: '检查炉温控制回路、燃气流量和板坯在炉时间。' },
  { processId: 'roughing', parameter: '轧制力', min: 26000, max: 30000, level: 'warning', reason: '粗轧轧制力超出工艺阈值', suggestion: '核验板坯温度、道次压下量及粗轧机传动状态。' },
  { processId: 'finishing', parameter: '轧制压力', min: 28000, max: 31000, level: 'warning', reason: '精轧轧制压力超过模拟预警阈值', suggestion: '降低轧制速度，检查板坯温度和液压压下系统。' },
  { processId: 'cooling', parameter: '冷却速度', min: 12, max: 18, level: 'warning', reason: '控冷速度超出工艺阈值', suggestion: '检查层流冷却水压、喷嘴状态及冷却模型参数。' },
  { processId: 'cooling', parameter: '终冷温度', min: 620, max: 680, level: 'warning', reason: '控冷终冷温度超出工艺阈值', suggestion: '调整冷却水量和辊道速度，核验测温装置。' },
]

function readStoredAlarms() {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

function saveStoredAlarms(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 50)))
}

function formatTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function createAlarmId(date = new Date()) {
  const part = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()].map((value) => String(value).padStart(2, '0')).join('')
  return `SIM-${part}-${Math.floor(Math.random() * 90 + 10)}`
}

function publishAlarm(alarm) {
  const records = readStoredAlarms()
  records.unshift(alarm)
  saveStoredAlarms(records)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: alarm }))
  return alarm
}

function isOutsideThreshold(value, rule) {
  return typeof value === 'number' && ((rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max))
}

function thresholdText(rule) {
  if (rule.min !== undefined && rule.max !== undefined) return `${rule.min}–${rule.max}`
  if (rule.max !== undefined) return `≤${rule.max}`
  return `≥${rule.min}`
}

export function evaluateProcessAlarms(processes, batchNo) {
  const stored = readStoredAlarms()
  const created = []

  thresholdRules.forEach((rule) => {
    const process = processes.find((item) => item.id === rule.processId)
    const parameter = process?.parameters.find((item) => item.name === rule.parameter)
    if (!process || !parameter || !isOutsideThreshold(parameter.value, rule)) return

    const eventKey = `${batchNo}:${rule.processId}:${rule.parameter}`
    const duplicated = stored.some((alarm) => alarm.eventKey === eventKey && !['resolved', 'closed'].includes(alarm.status))
    if (duplicated) return

    const alarm = {
      id: createAlarmId(),
      eventKey,
      source: 'production-auto',
      sourceLabel: '生产监控 · 自动阈值检测',
      batchNo,
      processId: process.id,
      device: process.equipment,
      triggerProcess: process.name,
      triggerParameter: parameter.name,
      level: rule.level,
      time: formatTime(),
      reason: rule.reason,
      value: `${parameter.value} ${parameter.unit}`.trim(),
      threshold: `${thresholdText(rule)} ${parameter.unit}`.trim(),
      status: 'pending',
      owner: '未指派',
      suggestion: rule.suggestion,
    }
    stored.unshift(alarm)
    created.push(alarm)
  })

  if (created.length) {
    saveStoredAlarms(stored)
    created.forEach((alarm) => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: alarm })))
  }
  return created
}

export function createManualProcessAlarm(process, batchNo) {
  const parameter = process.parameters.find((item) => typeof item.value === 'number') || process.parameters[0]
  return publishAlarm({
    id: createAlarmId(),
    eventKey: `${batchNo}:${process.id}:manual:${Date.now()}`,
    source: 'production-manual',
    sourceLabel: '生产监控 · 人工异常上报',
    batchNo,
    processId: process.id,
    device: process.equipment,
    triggerProcess: process.name,
    triggerParameter: parameter?.name || '人工判定',
    level: 'warning',
    time: formatTime(),
    reason: `${process.name}工序人工上报异常`,
    value: parameter ? `${parameter.value} ${parameter.unit}`.trim() : '人工确认异常',
    threshold: parameter?.range || '人工判定',
    status: 'pending',
    owner: '未指派',
    suggestion: `请检查${process.name}工艺参数及关联设备状态。`,
  })
}

export function getLinkedAlarms() {
  return readStoredAlarms()
}

export function subscribeLinkedAlarms(listener) {
  const handler = (event) => listener(event.detail)
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}

export function updateLinkedAlarm(alarm) {
  if (!alarm?.source?.startsWith('production-')) return
  const records = readStoredAlarms()
  const index = records.findIndex((item) => item.id === alarm.id)
  if (index === -1) return
  records[index] = { ...records[index], ...alarm }
  saveStoredAlarms(records)
}
