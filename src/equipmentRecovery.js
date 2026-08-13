/** 设备维护后的工业仿真恢复覆盖层，不修改原始设备 Mock。 */
const STORAGE_KEY = 'thick_plate_equipment_recovery'
export const EQUIPMENT_RECOVERY_CHANGED = 'equipment-recovery-changed'

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)) }
function nowText(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function readRecords() {
  if (typeof window === 'undefined') return []
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch { return [] }
}
function saveRecords(records) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent(EQUIPMENT_RECOVERY_CHANGED, { detail: clone(records) }))
}

export function getEquipmentRecoveries() { return clone(readRecords()) }
export function getEquipmentRecovery(equipmentId) {
  return clone(readRecords().find((item) => item.equipmentId === equipmentId) || null)
}

/** 同一工单只创建一次；同一设备保留最新有效恢复快照。 */
export function saveEquipmentRecovery(input = {}) {
  if (!input.equipmentId || !input.orderId) return { saved: false, reason: 'invalid_input', recovery: null }
  const records = readRecords()
  const existingOrder = records.find((item) => item.orderId === input.orderId)
  if (existingOrder) return { saved: false, reason: 'duplicate_order', recovery: clone(existingOrder) }
  const previous = records.find((item) => item.equipmentId === input.equipmentId)
  const time = nowText()
  const recovery = {
    equipmentId: input.equipmentId,
    eventId: input.eventId || '',
    orderId: input.orderId,
    alarmId: input.alarmId || '',
    parameterOverrides: clone(input.parameterOverrides || {}),
    beforeHealth: Number(input.beforeHealth) || 0,
    afterHealth: Number(input.afterHealth) || 0,
    beforeProbability: Number(input.beforeProbability) || 0,
    afterProbability: Number(input.afterProbability) || 0,
    riskLevelBefore: input.riskLevelBefore || '',
    riskLevelAfter: input.riskLevelAfter || '',
    description: input.description || '维护完成后设备关键参数进入工业仿真恢复区间。',
    createTime: previous?.createTime || time,
    updateTime: time,
  }
  const next = records.filter((item) => item.equipmentId !== input.equipmentId)
  next.unshift(recovery)
  saveRecords(next)
  return { saved: true, reason: 'saved', recovery: clone(recovery) }
}

/** 由统一健康算法完成复算后，回写实际恢复评价结果。 */
export function updateEquipmentRecoveryOutcome(orderId, outcome = {}) {
  const records = readRecords()
  const recovery = records.find((item) => item.orderId === orderId)
  if (!recovery) return { updated: false, reason: 'not_found', recovery: null }
  const changed = recovery.afterHealth !== Number(outcome.afterHealth) || recovery.afterProbability !== Number(outcome.afterProbability)
  recovery.afterHealth = Number(outcome.afterHealth) || 0
  recovery.afterProbability = Number(outcome.afterProbability) || 0
  recovery.riskLevelAfter = outcome.riskLevelAfter || recovery.riskLevelAfter
  recovery.alarmId = outcome.alarmId || recovery.alarmId
  recovery.updateTime = nowText()
  if (changed || outcome.alarmId) saveRecords(records)
  return { updated: true, reason: 'updated', recovery: clone(recovery) }
}

export function applyEquipmentRecovery(device = {}) {
  const recovery = getEquipmentRecovery(device.id)
  if (!recovery) return { ...device }
  return { ...device, ...recovery.parameterOverrides, status: recovery.riskLevelAfter === '低风险' ? 'running' : device.status, recovery }
}
