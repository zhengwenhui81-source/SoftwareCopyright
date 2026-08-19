import { getProductionBatch, getProductionPlans } from './productionPlan.js'

/** 厚板批次质量检测数据层；生产主数据通过 batchId 动态关联。 */
const STORAGE_KEY = 'thick_plate_quality_data'
export const QUALITY_DATA_CHANGED = 'quality-data-changed'
const defaultQualityData = [
  { id: 'Q-20260811-001', batchId: 'PL-20260810-027', inspection: { thicknessDeviation: 0.12, surfaceDefectRate: 0.8, flatness: 0.95, mechanical: { yieldStrength: 355, tensileStrength: 520 }, defects: { scale: 0.3, scratch: 0.2, pit: 0.2, inclusion: 0.1 } }, createTime: '2026-08-11' },
  { id: 'Q-20260810-006', batchId: 'PL-20260809-018', inspection: { thicknessDeviation: 0.26, surfaceDefectRate: 2.4, flatness: 0.82, mechanical: { yieldStrength: 562, tensileStrength: 705 }, defects: { scale: 0.9, scratch: 0.7, pit: 0.5, inclusion: 0.3 } }, createTime: '2026-08-10' },
]

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function isUnqualifiedDisposition(value) { return ['unqualified', '不合格'].includes(value) }
function nowText(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function enrichHistory(records) {
  let changed = false
  const enriched = records.map((record) => {
    if (Array.isArray(record.inspectionHistory) && record.inspectionHistory.length) return record
    const analysis = analyzeQualityStatus(hydrate(record))
    changed = true
    return { ...record, inspectionHistory: [{ type: 'initial', inspection: clone(record.inspection), score: analysis?.qualityScore ?? 0, level: analysis?.qualityLevel?.label || '未评价', time: record.createTime || nowText() }] }
  })
  return { enriched, changed }
}
function readData() {
  if (typeof window === 'undefined') return clone(defaultQualityData)
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(saved) && saved.length) {
      const { enriched, changed } = enrichHistory(saved)
      if (changed) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched))
      return enriched
    }
  } catch { /* 使用默认工业仿真质量数据 */ }
  const initial = enrichHistory(clone(defaultQualityData)).enriched
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

function saveData(records, detail) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent(QUALITY_DATA_CHANGED, { detail }))
}

function hydrate(record) {
  const batch = getProductionBatch(record.batchId)
  if (!batch) return {
    ...clone(record),
    orderNo: record.orderNo || '',
    quantity: record.quantity || 0,
    steelGrade: record.steelGrade || '',
    specification: record.specification || '',
  }
  const plan = getProductionPlans().find((item) => item.id === batch.planId)
  return {
    ...clone(record),
    orderNo: plan?.orderNo || record.orderNo || '',
    quantity: plan?.quantity || record.quantity || 0,
    steelGrade: batch.steelGrade || record.steelGrade || '',
    specification: batch.specification || record.specification || '',
  }
}

export function getQualityData() {
  return readData().map(hydrate)
}

export function getBatchQuality(batchId) {
  const record = readData().find((item) => item.batchId === batchId)
  return record ? hydrate(record) : null
}

/** 将批次质量分析记录注册为可复检的正式检测记录；同一批次只创建一次。 */
export function ensureQualityRecord(input = {}) {
  const batchId = input.batchId || input.batchNo
  if (!batchId) return { created: false, reason: 'missing_batch_id', record: null }

  const records = readData()
  const existing = records.find((item) => item.batchId === batchId)
  if (existing) {
    const qualityDisposition = input.qualityDisposition || input.qualityStatus || input.status || ''
    const shouldMarkReinspection = input.requiresReinspection === true && existing.requiresReinspection !== true
    const shouldSyncUnqualifiedDisposition = isUnqualifiedDisposition(qualityDisposition) && !isUnqualifiedDisposition(existing.qualityDisposition)
    if (shouldMarkReinspection || shouldSyncUnqualifiedDisposition) {
      if (shouldMarkReinspection) existing.requiresReinspection = true
      if (shouldSyncUnqualifiedDisposition) existing.qualityDisposition = qualityDisposition
      existing.sourceBatchAnalysis = clone(input.sourceBatchAnalysis || existing.sourceBatchAnalysis || {})
      saveData(records, { batchId, action: shouldSyncUnqualifiedDisposition ? 'sync_quality_disposition' : 'mark_reinspection_required' })
      return { created: false, reason: 'updated_existing', record: hydrate(existing) }
    }
    return { created: false, reason: 'already_exists', record: hydrate(existing) }
  }

  const numeric = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const thicknessDeviation = numeric(input.thicknessDeviation ?? input.thickness)
  const surfaceDefectRate = numeric(input.surfaceDefectRate ?? input.defectRate)
  const flatnessRaw = numeric(input.flatness ?? input.shape)
  const yieldStrength = numeric(input.yieldStrength ?? input.yield)
  const tensileStrength = numeric(input.tensileStrength ?? input.tensile)
  const flatness = flatnessRaw != null && flatnessRaw > 1 ? flatnessRaw / 100 : flatnessRaw

  if ([thicknessDeviation, surfaceDefectRate, flatness, yieldStrength, tensileStrength].some((value) => value == null)) {
    return { created: false, reason: 'incomplete_inspection', record: null }
  }

  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const record = {
    id: `Q-${datePrefix}-${String(records.length + 1).padStart(3, '0')}`,
    batchId,
    orderNo: input.orderNo || '',
    steelGrade: input.steelGrade || '',
    specification: input.specification || input.spec || '',
    quantity: numeric(input.quantity) || 0,
    requiresReinspection: input.requiresReinspection === true,
    qualityDisposition: input.qualityDisposition || input.qualityStatus || input.status || '',
    inspection: {
      thicknessDeviation,
      surfaceDefectRate,
      flatness,
      mechanical: { yieldStrength, tensileStrength },
      defects: clone(input.defects || {}),
    },
    sourceBatchAnalysis: clone(input.sourceBatchAnalysis || {}),
    createTime: input.createTime || input.time || nowText(),
  }
  const analysis = analyzeQualityStatus(hydrate(record))
  record.inspectionHistory = [{
    type: 'initial',
    inspection: clone(record.inspection),
    score: analysis?.qualityScore ?? null,
    level: input.statusLabel || input.status || analysis?.qualityLevel?.label || '未评价',
    source: 'batch_quality_analysis',
    report: clone(input.sourceBatchAnalysis || {}),
    time: record.createTime,
  }]
  records.unshift(record)
  saveData(records, { batchId, action: 'register_batch_quality_record' })
  return { created: true, reason: 'created', record: hydrate(record) }
}

/** 追加确定性复检结果并更新当前检测值；同一 taskId 只追加一次。 */
export function appendQualityInspectionResult(input = {}) {
  const records = readData()
  const record = records.find((item) => item.batchId === input.batchId)
  if (!record || !input.taskId || !input.inspection) return { appended: false, reason: 'invalid_input', record: null, analysis: null }
  const duplicated = record.inspectionHistory?.find((item) => item.taskId === input.taskId)
  if (duplicated) return { appended: false, reason: 'duplicate_task', record: hydrate(record), analysis: analyzeQualityStatus(hydrate(record)) }
  record.inspection = clone(input.inspection)
  const hydrated = hydrate(record)
  const analysis = analyzeQualityStatus(hydrated)
  record.inspectionHistory = [...(record.inspectionHistory || []), { type: 'reinspection', taskId: input.taskId, inspection: clone(input.inspection), score: analysis.qualityScore, level: analysis.qualityLevel.label, time: input.time || nowText() }]
  saveData(records, { batchId: input.batchId, taskId: input.taskId, analysis: clone(analysis) })
  return { appended: true, reason: 'appended', record: hydrate(record), analysis }
}

/** 基于厚度、表面缺陷、板形及力学性能计算模拟综合评分。 */
export function analyzeQualityStatus(data) {
  if (!data?.inspection) return null
  const { thicknessDeviation, surfaceDefectRate, flatness, mechanical } = data.inspection
  const declaredUnqualified = isUnqualifiedDisposition(data.qualityDisposition)
  const gradeYield = data.steelGrade?.startsWith('Q550') ? 550 : 355
  const tensileRange = data.steelGrade?.startsWith('Q550') ? [670, 830] : [470, 630]
  const abnormalItems = []
  if (Math.abs(thicknessDeviation) > 0.3) abnormalItems.push('厚度偏差超出 ±0.30 mm')
  if (surfaceDefectRate > 2) abnormalItems.push('表面缺陷率超过 2.0%')
  if (flatness < 0.85) abnormalItems.push('板形指标低于 0.85')
  if (mechanical.yieldStrength < gradeYield) abnormalItems.push(`屈服强度低于 ${gradeYield} MPa`)
  if (mechanical.tensileStrength < tensileRange[0] || mechanical.tensileStrength > tensileRange[1]) abnormalItems.push(`抗拉强度不在 ${tensileRange[0]}–${tensileRange[1]} MPa`)
  if (declaredUnqualified) abnormalItems.push('批次分析综合判定为不合格')

  let score = 100 - Math.abs(thicknessDeviation) * 10 - surfaceDefectRate * 2 - Math.max(0, 1 - flatness) * 20
  score -= abnormalItems.length * 8
  const qualityScore = Math.max(0, Math.min(100, Math.round(score)))
  const level = declaredUnqualified ? { key: 'abnormal', label: '异常', color: '#ef6262' }
    : qualityScore >= 90 ? { key: 'excellent', label: '优秀', color: '#2bd398' }
    : qualityScore >= 80 ? { key: 'qualified', label: '合格', color: '#35a9e9' }
      : qualityScore >= 65 ? { key: 'attention', label: '关注', color: '#ffad45' }
        : { key: 'abnormal', label: '异常', color: '#ef6262' }
  return {
    qualityScore, qualityLevel: level, abnormalItems,
    analysisText: abnormalItems.length ? `发现 ${abnormalItems.length} 项指标超出模拟质量标准，建议安排复核。` : '当前批次检测指标满足模拟质量标准，综合质量状态稳定。',
    dataMode: '质量评价演示 · 基于工业仿真数据',
  }
}

export function getDefectAnalysis(batchId) {
  if (batchId) {
    const data = getBatchQuality(batchId)
    if (!data) return []
    const inspection = data.inspection
    const rates = [
      { key: 'thickness', name: '厚度偏差', rate: Math.abs(inspection.thicknessDeviation) / 0.3 * 1.5, causes: ['精轧压力波动', '轧辊间隙变化'] },
      { key: 'crack', name: '表面裂纹', rate: inspection.defects?.scratch || inspection.surfaceDefectRate * 0.25, causes: ['板坯加热温度不均', '轧制表面应力集中'] },
      { key: 'scale', name: '氧化铁皮', rate: inspection.defects?.scale || inspection.surfaceDefectRate * 0.35, causes: ['加热炉氧化气氛波动', '高压除鳞效果不足'] },
      { key: 'flatness', name: '板形异常', rate: Math.max(0, (0.9 - inspection.flatness) * 20), causes: ['精轧辊缝控制波动', '控冷温度分布不均'] },
    ]
    return rates.map((item) => {
      const percentage = Number(item.rate.toFixed(2))
      const count = percentage > 0 ? Math.max(1, Math.round((data.quantity || 1) * percentage / 100)) : 0
      const riskLevel = percentage >= 2 ? 'high' : percentage >= 1 ? 'medium' : 'low'
      return { ...item, count, percentage, riskLevel }
    })
  }
  const records = readData()
  const totals = records.reduce((result, item) => {
    Object.entries(item.inspection.defects || {}).forEach(([key, value]) => { result[key] = Number(((result[key] || 0) + value).toFixed(2)) })
    return result
  }, {})
  const labels = { scale: '氧化铁皮', scratch: '划伤', pit: '压坑', inclusion: '夹杂' }
  return Object.entries(totals).map(([key, value]) => ({ key, name: labels[key] || key, value: Number((value / records.length).toFixed(2)) }))
}
