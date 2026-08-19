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

function createBatchId(previousBatchId, batches) {
  const matched = String(previousBatchId || '').match(/^(.*-)(\d+)$/)
  const datePrefix = `PL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-`
  const prefix = matched?.[1] || datePrefix
  const suffix = matched?.[2] || '000'
  const width = Math.max(suffix.length, 3)
  const max = batches
    .filter((item) => String(item.batchId || '').startsWith(prefix))
    .map((item) => Number(String(item.batchId).slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((value, current) => Math.max(value, current), Number(suffix))
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}

function createPlanId(plans) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const prefix = `PLAN-${date}-`
  const max = plans
    .filter((item) => String(item.id || '').startsWith(prefix))
    .map((item) => Number(String(item.id).slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((value, current) => Math.max(value, current), 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function createOrderNo(plans) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const prefix = `HT${date}`
  const max = plans
    .filter((item) => String(item.orderNo || '').startsWith(prefix))
    .map((item) => Number(String(item.orderNo).slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((value, current) => Math.max(value, current), 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** 创建新的生产订单及其首个运行批次，历史订单与批次保持不变。 */
export function createProductionOrder(input = {}) {
  const steelGrade = String(input.steelGrade || '').trim()
  const specification = String(input.specification || '').trim()
  const customer = String(input.customer || '').trim()
  const deliveryDate = String(input.deliveryDate || '').trim()
  const quantity = Math.floor(Number(input.quantity))
  if (!steelGrade || !specification || !customer || !deliveryDate || !Number.isFinite(quantity) || quantity <= 0) {
    return { created: false, reason: 'invalid_input', plan: null, batch: null }
  }
  const data = readData()
  const plan = {
    id: createPlanId(data.plans), orderNo: createOrderNo(data.plans), steelGrade, specification,
    quantity, completed: 0, customer, deliveryDate, status: '生产中',
  }
  const batch = {
    batchId: createBatchId('', data.batches), planId: plan.id, steelGrade, specification,
    batchQuantity: quantity, currentProcess: '炼钢与连铸', progress: 0,
    startTime: nowText(), operators: input.operators || '张工 / 赵工', processStatus: 'running',
  }
  data.plans.push(plan)
  data.batches.push(batch)
  saveData(data)
  return { created: true, reason: 'created', plan: clone(plan), batch: clone(batch) }
}

/** 当前批次完成但订单仍有剩余数量时，创建下一生产批次。 */
export function createNextProductionBatch(batchId) {
  const data = readData()
  const previous = data.batches.find((item) => item.batchId === batchId)
  const plan = data.plans.find((item) => item.id === previous?.planId)
  if (!previous || !plan) return { created: false, reason: 'not_found', batch: null }
  if (previous.processStatus !== 'completed' && Number(previous.progress) < 100) return { created: false, reason: 'previous_not_completed', batch: clone(previous) }
  const remaining = Math.max(0, Number(plan.quantity || 0) - Number(plan.completed || 0))
  if (!remaining) return { created: false, reason: 'plan_completed', batch: clone(previous) }
  const running = data.batches.find((item) => item.planId === plan.id && ['running', 'paused'].includes(item.processStatus))
  if (running) return { created: false, reason: 'running_batch_exists', batch: clone(running) }
  const next = {
    batchId: createBatchId(previous.batchId, data.batches), planId: plan.id, steelGrade: plan.steelGrade,
    specification: plan.specification, batchQuantity: remaining, currentProcess: '炼钢与连铸', progress: 0,
    startTime: nowText(), operators: previous.operators || '张工 / 赵工', processStatus: 'running',
  }
  data.batches.push(next)
  saveData(data)
  return { created: true, reason: 'created', batch: clone(next), remaining }
}

/** 仅在一个批次首次完成时累计订单数量，刷新或重复调用不会重复累计。 */
export function completeProductionBatch(batchId) {
  const data = readData()
  const batch = data.batches.find((item) => item.batchId === batchId)
  const plan = data.plans.find((item) => item.id === batch?.planId)
  if (!batch || !plan) return { completed: false, reason: 'not_found', batch: null, plan: null }
  if (batch.processStatus !== 'completed' && Number(batch.progress) < 100) return { completed: false, reason: 'batch_not_completed', batch: clone(batch), plan: clone(plan) }
  if (batch.completionRecorded) return { completed: true, reason: 'already_recorded', batch: clone(batch), plan: clone(plan) }
  const quantity = Math.max(0, Number(batch.batchQuantity || 0))
  plan.completed = Math.min(Number(plan.quantity || 0), Number(plan.completed || 0) + quantity)
  plan.status = Number(plan.completed) >= Number(plan.quantity) ? '已完成' : '生产中'
  batch.completionRecorded = true
  batch.completedTime = batch.completedTime || nowText()
  saveData(data)
  return { completed: true, reason: 'recorded', batch: clone(batch), plan: clone(plan) }
}
