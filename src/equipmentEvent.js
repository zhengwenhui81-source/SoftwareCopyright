/** 设备风险事件层：使用 localStorage 保存模拟事件，不连接后端。 */
const STORAGE_KEY = 'thick_plate_equipment_risk_events'
export const EQUIPMENT_EVENT_CHANGED = 'equipment-event-changed'
export const equipmentEventThresholds = { healthScore: 70, failureProbability: 50 }
const validStatuses = ['pending', 'confirmed', 'closed']

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
  window.dispatchEvent(new CustomEvent(EQUIPMENT_EVENT_CHANGED, { detail: events }))
}

function formatTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function nextEventId(events, equipmentId) {
  return `EV-${equipmentId.replace(/[^A-Z0-9]/gi, '')}-${String(events.length + 1).padStart(3, '0')}`
}

/** 仅阈值触发或用户主动触发时创建；同设备同异常只保留一条未关闭事件。 */
export function createEquipmentEvent(input = {}) {
  const thresholdTriggered = Number(input.healthScore) < equipmentEventThresholds.healthScore
    || Number(input.failureProbability) > equipmentEventThresholds.failureProbability
  if (!thresholdTriggered && !input.manual) return { created: false, reason: 'threshold_not_met', event: null }
  const events = readEvents()
  const duplicated = events.find((item) => item.equipmentId === input.equipmentId && item.type === input.type && item.status !== 'closed')
  if (duplicated) return { created: false, reason: 'duplicate', event: duplicated }
  const event = {
    id: nextEventId(events, input.equipmentId || 'EQ'), equipmentId: input.equipmentId || '', equipmentName: input.equipmentName || '',
    source: input.source || '故障预测', type: input.type || 'equipment_risk', typeLabel: input.typeLabel || '设备状态异常',
    level: input.level || 'medium', status: 'pending', title: input.title || '设备风险指标异常',
    description: input.description || '设备健康指标达到模拟风险事件生成条件。', currentValue: input.currentValue ?? 0,
    threshold: input.threshold ?? equipmentEventThresholds.failureProbability, unit: input.unit || '',
    healthScore: Number(input.healthScore) || 0, failureProbability: Number(input.failureProbability) || 0,
    suggestion: Array.isArray(input.suggestion) ? [...input.suggestion] : [], createTime: formatTime(), updateTime: formatTime(),
  }
  events.unshift(event)
  saveEvents(events)
  return { created: true, reason: 'created', event }
}

export function getEquipmentEvents() {
  return readEvents().map((item) => ({ ...item, suggestion: [...(item.suggestion || [])] }))
}

export function updateEquipmentEventStatus(eventId, status) {
  if (!validStatuses.includes(status)) return { updated: false, event: null }
  const events = readEvents()
  const target = events.find((item) => item.id === eventId)
  if (!target) return { updated: false, event: null }
  target.status = status
  target.updateTime = formatTime()
  saveEvents(events)
  return { updated: true, event: { ...target } }
}
