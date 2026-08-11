/** 厚板生产计划与批次模拟数据层，使用 localStorage 持久化。 */
const STORAGE_KEY = 'thick_plate_production_plan'

const defaultData = {
  plans: [
    { id: 'PLAN-20260811-001', orderNo: 'HT20260811001', steelGrade: 'Q355B', specification: '30×2500×12000mm', quantity: 36, completed: 21, customer: '华东重型装备制造企业', deliveryDate: '2026-08-15', status: '生产中' },
    { id: 'PLAN-20260811-002', orderNo: 'HT20260811002', steelGrade: 'Q550D', specification: '24×2200×10000mm', quantity: 28, completed: 0, customer: '海工装备制造企业', deliveryDate: '2026-08-18', status: '待生产' },
  ],
  batches: [
    { batchId: 'PL-20260810-027', planId: 'PLAN-20260811-001', steelGrade: 'Q355B', specification: '30×2500×12000mm', currentProcess: '精轧', progress: 46, startTime: '08:16:32', operators: '张工 / 赵工', processStatus: 'running' },
  ],
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function readData() {
  if (typeof window === 'undefined') return clone(defaultData)
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.plans?.length && saved?.batches?.length) return saved
  } catch { /* 使用默认工业仿真数据 */ }
  const initial = clone(defaultData)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

function saveData(data) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getProductionPlans() {
  return clone(readData().plans)
}

export function getProductionBatch(batchId) {
  const batches = readData().batches
  const batch = batchId ? batches.find((item) => item.batchId === batchId) : batches.find((item) => item.processStatus === 'running') || batches[0]
  return batch ? clone(batch) : null
}

/** 同步批次综合进度、当前工序和状态，不修改工序 Mock。 */
export function updateBatchProgress(batchId, progress, currentProcess, processStatus = 'running') {
  const data = readData()
  const batch = data.batches.find((item) => item.batchId === batchId)
  if (!batch) return null
  batch.progress = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)))
  if (currentProcess) batch.currentProcess = currentProcess
  batch.processStatus = batch.progress >= 100 ? 'completed' : processStatus
  saveData(data)
  return clone(batch)
}
