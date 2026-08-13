/** 厚板生产异常事件数据层：负责事件记录、去重和状态流转。 */
const STORAGE_KEY = 'thick_plate_production_events'
export const PRODUCTION_EVENT_CHANGED = 'production-event-changed'

function readEvents() {
  if (typeof window === 'undefined') return []
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

function saveEvents(events) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  window.dispatchEvent(new CustomEvent(PRODUCTION_EVENT_CHANGED, { detail: events }))
}

function formatTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function createId(events) {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `PE-${date}-${String(events.length + 1).padStart(3, '0')}`
}

/** 仅接受偏高或偏低的参数分析结果；同批次、工序、参数的未关闭事件不会重复创建。 */
export function createProductionEvent(input = {}) {
  if (!['偏高', '偏低'].includes(input.parameterStatus)) return { created: false, reason: 'normal_parameter', event: null }
  const events = readEvents()
  const duplicated = events.find((item) => item.batchId === input.batchId && item.process === input.process && item.parameterKey === input.parameterKey && item.status !== 'closed')
  if (duplicated) return { created: false, reason: 'duplicate', event: duplicated }
  const time = formatTime()
  const event = {
    id: createId(events), batchId: input.batchId || '', steelGrade: input.steelGrade || '', process: input.process || '',
    parameterKey: input.parameterKey || '', parameter: input.parameter || '工艺参数', currentValue: input.currentValue,
    unit: input.unit || '', threshold: input.threshold || '', level: input.level || 'warning',
    title: input.title || `${input.process}${input.parameter}${input.parameterStatus}`,
    description: input.description || `当前${input.parameter}${input.parameterStatus === '偏高' ? '超过工艺标准上限' : '低于工艺标准下限'}。`,
    status: 'pending', suggestion: Array.isArray(input.suggestion) ? [...input.suggestion] : ['复核工艺参数设定', '确认生产设备运行状态'],
    adjustmentRecord: null, recovery: null, relatedAlarmId: '',
    createTime: time, updateTime: time,
  }
  events.unshift(event)
  saveEvents(events)
  return { created: true, reason: 'created', event }
}

export function getProductionEvents() {
  return readEvents().map((item) => ({ ...item, suggestion: [...(item.suggestion || [])], adjustmentRecord: item.adjustmentRecord ? { ...item.adjustmentRecord } : null, recovery: item.recovery ? { ...item.recovery } : null, relatedAlarmId: item.relatedAlarmId || '' }))
}

/** 事件只能从待确认更新为处理中。 */
export function updateProductionEventStatus(eventId, status) {
  const events = readEvents()
  const event = events.find((item) => item.id === eventId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.status !== 'pending' || status !== 'processing') return { updated: false, reason: 'invalid_transition', event }
  event.status = 'processing'
  event.updateTime = formatTime()
  saveEvents(events)
  return { updated: true, reason: 'updated', event: { ...event } }
}

/** 只有恢复验证中的事件允许关闭。 */
export function closeProductionEvent(eventId) {
  const events = readEvents()
  const event = events.find((item) => item.id === eventId)
  if (!event) return { closed: false, reason: 'not_found', event: null }
  if (event.status !== 'recovery_pending') return { closed: false, reason: 'invalid_transition', event }
  event.status = 'closed'
  event.updateTime = formatTime()
  saveEvents(events)
  return { closed: true, reason: 'closed', event: { ...event } }
}

/** 参数执行完成后提交恢复结果；同一 adjustmentId 重复提交保持幂等。 */
export function submitProductionEventRecovery(input = {}) {
  const events = readEvents()
  const event = events.find((item) => item.id === input.eventId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.adjustmentRecord?.adjustmentId === input.adjustmentId) return { updated: true, reason: 'already_submitted', event: { ...event } }
  if (event.status !== 'processing') return { updated: false, reason: 'invalid_transition', event: { ...event } }
  const time = formatTime()
  event.adjustmentRecord = {
    adjustmentId: input.adjustmentId || '', beforeValue: input.beforeValue, afterValue: input.afterValue,
    operator: input.operator || '未填写', reason: input.reason || '', executeTime: input.executeTime || time,
  }
  event.recovery = {
    parameterStatus: input.parameterStatus || (input.verificationPassed ? 'normal' : 'abnormal'),
    verificationPassed: Boolean(input.verificationPassed), message: input.result || '', verifyTime: time,
  }
  event.relatedAlarmId = input.relatedAlarmId || event.relatedAlarmId || ''
  event.status = 'recovery_pending'
  event.updateTime = time
  saveEvents(events)
  return { updated: true, reason: 'recovery_submitted', event: { ...event } }
}

export function setProductionEventRelatedAlarm(eventId, alarmId) {
  const events = readEvents()
  const event = events.find((item) => item.id === eventId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.relatedAlarmId === alarmId) return { updated: true, reason: 'already_linked', event: { ...event } }
  event.relatedAlarmId = alarmId || ''
  event.updateTime = formatTime()
  saveEvents(events)
  return { updated: true, reason: 'linked', event: { ...event } }
}
