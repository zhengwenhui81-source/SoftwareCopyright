/** 厚板生产计划与批次模拟数据层，使用 localStorage 持久化。 */
const STORAGE_KEY = 'thick_plate_production_plan'

const defaultData = {
  plans: [
    { id: 'PLAN-20260811-001', orderNo: 'HT20260811001', steelGrade: 'Q355B', specification: '30×2500×12000mm', quantity: 36, completed: 21, customer: '华东重型装备制造企业', deliveryDate: '2026-08-15', status: '生产中' },
    { id: 'PLAN-20260811-002', orderNo: 'HT20260811002', steelGrade: 'Q550D', specification: '24×2200×10000mm', quantity: 28, completed: 0, customer: '海工装备制造企业', deliveryDate: '2026-08-18', status: '待生产' },
  ],
  batches: [
    { batchId: 'PL-20260810-027', planId: 'PLAN-20260811-001', steelGrade: 'Q355B', specification: '30×2500×12000mm', currentProcess: '精轧', progress: 46, startTime: '08:16:32', operators: '张工 / 赵工', processStatus: 'running' },
    { batchId: 'PL-20260809-018', planId: 'PLAN-20260811-002', steelGrade: 'Q550D', specification: '24×2200×10000mm', currentProcess: '入库', progress: 100, startTime: '06:42:15', operators: '李工 / 王工', processStatus: 'completed' },
  ],
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function readData() {
  if (typeof window === 'undefined') return clone(defaultData)
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.plans?.length && saved?.batches?.length) {
      const plans = [...saved.plans, ...defaultData.plans.filter((item) => !saved.plans.some((savedItem) => savedItem.id === item.id))]
      const batches = [...saved.batches, ...defaultData.batches.filter((item) => !saved.batches.some((savedItem) => savedItem.batchId === item.batchId))]
      const merged = { ...saved, plans, batches }
      if (plans.length !== saved.plans.length || batches.length !== saved.batches.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      return merged
    }
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

export function getProductionBatches() {
  return clone(readData().batches)
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

function nowText(date = new Date()) { const pad = (value) => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` }

/** 获取批次基础生产运行快照；旧数据首次读取时按 currentProcess/progress 迁移。 */
export function getProductionRuntime(batchId, processDefinitions = []) {
  const data = readData(); const batch = data.batches.find((item) => item.batchId === batchId)
  if (!batch) return null
  if (batch.runtime?.baseStatuses && batch.runtime?.processProgress) return clone(batch.runtime)
  const currentIndex = Math.max(0, processDefinitions.findIndex((item) => item.name === batch.currentProcess))
  const estimatedCurrentProgress = Math.max(0, Math.min(99, Math.round((Number(batch.progress) || 0) * processDefinitions.length - currentIndex * 100)))
  const completed = batch.processStatus === 'completed' || Number(batch.progress) >= 100
  const baseStatuses = {}, processProgress = {}
  processDefinitions.forEach((item, index) => {
    baseStatuses[item.id] = completed || index < currentIndex ? 'completed' : index === currentIndex ? 'running' : 'waiting'
    processProgress[item.id] = completed || index < currentIndex ? 100 : index === currentIndex ? (estimatedCurrentProgress || item.progress || 8) : 0
  })
  batch.runtime = { currentProcessId: completed ? '' : processDefinitions[currentIndex]?.id || '', currentProcessIndex: completed ? -1 : currentIndex, processProgress, baseStatuses, simulationPaused: batch.processStatus === 'paused', updateTime: nowText() }
  saveData(data); return clone(batch.runtime)
}

/** 只保存流程位置、基础状态、进度和暂停，不保存视觉报警运行态。 */
export function updateProductionRuntime(batchId, runtime = {}) {
  const data = readData(); const batch = data.batches.find((item) => item.batchId === batchId)
  if (!batch) return null
  batch.runtime = { currentProcessId: runtime.currentProcessId || '', currentProcessIndex: Number.isInteger(runtime.currentProcessIndex) ? runtime.currentProcessIndex : -1, processProgress: clone(runtime.processProgress || {}), baseStatuses: clone(runtime.baseStatuses || {}), simulationPaused: Boolean(runtime.simulationPaused), updateTime: nowText() }
  saveData(data); return clone(batch.runtime)
}
