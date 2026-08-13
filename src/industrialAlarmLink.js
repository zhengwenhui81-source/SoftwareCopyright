import { processParameterRuleList } from './processParameterRules.js'

const STORAGE_KEY = 'plate-monitor-linked-alarms'
const EVENT_NAME = 'plate-monitor:alarm-created'
export const LINKED_ALARM_CHANGED = 'plate-monitor:alarm-changed'

const thresholdRules = processParameterRuleList.filter((rule) => rule.alarmLevel)

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
    const parameter = process?.parameters.find((item) => item.key === rule.parameterKey || rule.aliases.includes(item.name))
    if (!process || !parameter || !isOutsideThreshold(parameter.value, rule)) return

    const baseEventKey = `${batchNo}:${rule.processId}:${rule.parameterKey}`
    const legacyKeys = rule.aliases.map((name) => `${batchNo}:${rule.processId}:${name}`)
    const duplicated = stored.some((alarm) => [baseEventKey, ...legacyKeys].includes(alarm.baseEventKey || alarm.eventKey) && !['resolved', 'closed'].includes(alarm.status))
    if (duplicated) return

    const alarm = {
      id: createAlarmId(),
      eventKey: `${baseEventKey}:${Date.now()}:${created.length + 1}`,
      baseEventKey,
      source: 'production-auto',
      sourceLabel: '生产监控 · 自动阈值检测',
      batchNo,
      processId: process.id,
      device: process.equipment,
      triggerProcess: process.name,
      parameterKey: rule.parameterKey,
      triggerParameter: rule.parameterName,
      level: rule.alarmLevel,
      time: formatTime(),
      reason: `${rule.processName}${rule.parameterName}超出模拟工艺阈值`,
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

/** 只读查询指定工序仍会影响生产卡片的旧报警，便于多报警场景核验。 */
export function getActiveLinkedAlarmsForProcess(processId, batchNo = '') {
  return readStoredAlarms().filter((alarm) => {
    const processMatched = alarm.processId === processId || alarm.eventKey?.split(':')[1] === processId
    return processMatched && (!batchNo || alarm.batchNo === batchNo) && alarm.status !== 'closed'
  })
}

export function subscribeLinkedAlarms(listener) {
  const handler = (event) => listener(event.detail)
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}

export function updateLinkedAlarm(alarm) {
  if (!alarm?.id || !alarm?.source?.startsWith('production-')) return { updated: false, reason: 'invalid_alarm', alarm: null }
  const records = readStoredAlarms()
  const index = records.findIndex((item) => item.id === alarm.id)
  if (index === -1) return { updated: false, reason: 'not_found', alarm: null }
  records[index] = { ...records[index], ...alarm }
  saveStoredAlarms(records)
  const updated = records[index]
  window.dispatchEvent(new CustomEvent(LINKED_ALARM_CHANGED, { detail: updated }))
  return { updated: true, reason: 'updated', alarm: updated }
}
