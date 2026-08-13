import { saveEquipmentRecovery } from './equipmentRecovery.js'

/** 预测维护工单数据层：使用 localStorage 持久化，不连接后端。 */
const STORAGE_KEY = 'thick_plate_maintenance_orders'
export const MAINTENANCE_CHANGED = 'maintenance-order-changed'
export const maintenanceStatuses = ['pending', 'scheduled', 'in_progress', 'completed']

function readOrders() {
  if (typeof window === 'undefined') return []
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

function saveOrders(orders) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  window.dispatchEvent(new CustomEvent(MAINTENANCE_CHANGED, { detail: orders }))
}

function formatTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function createOrderId(orders) {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `WO-${date}-${String(orders.length + 1).padStart(3, '0')}`
}

/** 风险事件是工单的唯一来源；同一事件只创建一张工单。 */
export function createMaintenanceOrder(event) {
  if (!event?.id || !event.equipmentId) return { created: false, reason: 'invalid_event', order: null }
  const orders = readOrders()
  const duplicated = orders.find((item) => item.eventId === event.id)
  if (duplicated) return { created: false, reason: 'duplicate', order: duplicated }
  const time = formatTime()
  const order = {
    id: createOrderId(orders), eventId: event.id, equipmentId: event.equipmentId, equipmentName: event.equipmentName,
    component: event.title || '设备关键部件', type: '预测性维护', priority: event.level || 'medium', status: 'pending',
    owner: '未指派', suggestedTime: event.level === 'high' ? '24小时内' : '72小时内', reason: event.description,
    riskParameter: { name: event.typeLabel, currentValue: event.currentValue, threshold: event.threshold, unit: event.unit || '' },
    predictedFailure: event.title, measures: [...(event.suggestion || [])],
    beforeHealth: Number(event.healthScore) || 0, beforeProbability: Number(event.failureProbability) || 0,
    recovery: null, createTime: time, updateTime: time,
  }
  orders.unshift(order)
  saveOrders(orders)
  return { created: true, reason: 'created', order }
}

export function getMaintenanceOrders() {
  return readOrders().map((item) => ({ ...item, measures: [...(item.measures || [])], riskParameter: { ...(item.riskParameter || {}) }, recovery: item.recovery ? { ...item.recovery } : null }))
}

/** 状态只能按 待确认→已安排→执行中 顺序流转；完成请调用 completeMaintenanceOrder。 */
export function updateMaintenanceStatus(orderId, nextStatus, owner) {
  const orders = readOrders()
  const order = orders.find((item) => item.id === orderId)
  if (!order) return { updated: false, reason: 'not_found', order: null }
  const currentIndex = maintenanceStatuses.indexOf(order.status)
  const nextIndex = maintenanceStatuses.indexOf(nextStatus)
  if (nextStatus === 'completed' || nextIndex !== currentIndex + 1) return { updated: false, reason: 'invalid_transition', order }
  order.status = nextStatus
  if (owner?.trim()) order.owner = owner.trim()
  order.updateTime = formatTime()
  saveOrders(orders)
  return { updated: true, reason: 'updated', order: { ...order } }
}

/** 完成维护并生成仿真恢复结果，不修改设备 Mock 数据。 */
export function completeMaintenanceOrder(orderId, owner) {
  const orders = readOrders()
  const order = orders.find((item) => item.id === orderId)
  if (!order) return { completed: false, reason: 'not_found', order: null }
  if (order.status !== 'in_progress') return { completed: false, reason: 'invalid_transition', order }
  const beforeHealth = Number(order.beforeHealth) || 65
  const beforeProbability = Number(order.beforeProbability) || 50
  order.status = 'completed'
  if (owner?.trim()) order.owner = owner.trim()
  const safeParameters = {
    'RF-01': { temperature: 1210, pressure: 0.42, vibration: 1.2, load: 80 },
    'RM-01': { temperature: 68, pressure: 28, vibration: 2.4, load: 78 },
    'FM-01': { temperature: 70, pressure: 30, vibration: 2.2, load: 78 },
    'ACC-01': { temperature: 34, pressure: 0.62, vibration: 1, load: 72 },
    'UT-01': { temperature: 42, pressure: 0.31, vibration: 0.8, load: 65 },
  }
  const parameterOverrides = { ...(safeParameters[order.equipmentId] || { vibration: 2.2, load: 78 }) }
  order.recovery = {
    beforeHealth, afterHealth: Math.min(95, Math.max(85, beforeHealth + 20)),
    beforeProbability, afterProbability: Math.max(8, Math.min(20, beforeProbability - 30)),
    riskLevel: '低风险', parameterOverrides, description: '维护完成后关键风险参数恢复至工业仿真安全区间。',
  }
  order.updateTime = formatTime()
  saveEquipmentRecovery({
    equipmentId: order.equipmentId, eventId: order.eventId, orderId: order.id,
    parameterOverrides, beforeHealth, afterHealth: order.recovery.afterHealth,
    beforeProbability, afterProbability: order.recovery.afterProbability,
    riskLevelBefore: order.priority === 'high' ? '高风险' : '中风险', riskLevelAfter: '低风险',
    description: order.recovery.description,
  })
  saveOrders(orders)
  return { completed: true, reason: 'completed', order: { ...order } }
}
