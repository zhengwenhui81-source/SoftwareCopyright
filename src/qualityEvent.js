/** 批次级质量异常事件层；普通关注事件保留在质量域，严重事件可由统一报警层选择性汇聚。 */
const STORAGE_KEY = 'thick_plate_quality_events'
export const QUALITY_EVENT_CHANGED = 'quality-event-changed'

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)) }
function nowText(date = new Date()) { const pad = (v) => String(v).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` }
function readEvents() { try { const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(data) ? data : [] } catch { return [] } }
function saveEvents(events) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); window.dispatchEvent(new CustomEvent(QUALITY_EVENT_CHANGED, { detail: clone(events) })) }
function nextId(events) { const now = new Date(); const day = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`; return `QE-${day}-${String(events.length+1).padStart(3,'0')}` }

function buildAbnormalItems(data, analysis) {
  const inspection = data.inspection
  const items = []
  if (Math.abs(inspection.thicknessDeviation) > .3) items.push({ key: 'thicknessDeviation', name: '厚度偏差', value: inspection.thicknessDeviation, unit: 'mm' })
  if (inspection.surfaceDefectRate > 2) items.push({ key: 'surfaceDefectRate', name: '表面缺陷率', value: inspection.surfaceDefectRate, unit: '%' })
  if (inspection.flatness < .85) items.push({ key: 'flatness', name: '板形指标', value: inspection.flatness, unit: '' })
  if (analysis.abnormalItems.some((item) => item.includes('屈服强度'))) items.push({ key: 'yieldStrength', name: '屈服强度', value: inspection.mechanical.yieldStrength, unit: 'MPa' })
  if (analysis.abnormalItems.some((item) => item.includes('抗拉强度'))) items.push({ key: 'tensileStrength', name: '抗拉强度', value: inspection.mechanical.tensileStrength, unit: 'MPa' })
  return items
}

export function createQualityEvent(data, analysis) {
  if (!data || !['关注', '异常'].includes(analysis?.qualityLevel?.label)) return { created: false, reason: 'quality_not_abnormal', event: null }
  const events = readEvents()
  const duplicate = events.find((item) => item.batchId === data.batchId && item.status !== 'closed')
  if (duplicate) return { created: false, reason: 'duplicate', event: clone(duplicate) }
  const abnormalItems = buildAbnormalItems(data, analysis)
  const time = nowText()
  const event = { id: nextId(events), batchId: data.batchId, qualityRecordId: data.id, steelGrade: data.steelGrade, issueType: 'batch_quality_risk', issueName: '批次质量异常', level: analysis.qualityLevel.label === '异常' ? 'critical' : 'warning', qualityLevel: analysis.qualityLevel.label, description: `批次综合质量评分为 ${analysis.qualityScore}，存在质量评价仿真异常指标。`, abnormalItems, qualityScoreBefore: analysis.qualityScore, status: 'pending', suggestions: abnormalItems.flatMap((item) => item.key === 'thicknessDeviation' ? ['执行厚度复检', '复核精轧工艺参数'] : item.key === 'surfaceDefectRate' ? ['执行表面质量复检'] : item.key === 'flatness' ? ['复核板形检测结果'] : ['复核力学性能检测结果']), relatedInspectionTaskId: null, relatedAlarmId: null, recovery: null, recoveryHistory: [], closeRecord: null, createTime: time, updateTime: time }
  events.unshift(event); saveEvents(events); return { created: true, reason: 'created', event: clone(event) }
}
export function getQualityEvents() { return clone(readEvents()) }
export function linkQualityInspectionTask(eventId, taskId) { const events=readEvents(); const event=events.find(i=>i.id===eventId); if(!event)return{updated:false,reason:'not_found'}; if(event.relatedInspectionTaskId===taskId)return{updated:true,reason:'already_linked',event:clone(event)}; if(event.relatedInspectionTaskId&&event.status!=='inspecting')return{updated:false,reason:'already_linked',event:clone(event)}; event.relatedInspectionTaskId=taskId; event.updateTime=nowText(); saveEvents(events); return{updated:true,reason:'linked',event:clone(event)} }
export function startQualityEventInspection(eventId) { const events=readEvents(); const event=events.find(i=>i.id===eventId); if(!event)return{updated:false,reason:'not_found'}; if(event.status!=='pending')return{updated:false,reason:'invalid_transition',event:clone(event)}; event.status='inspecting'; event.updateTime=nowText(); saveEvents(events); return{updated:true,reason:'started',event:clone(event)} }
export function submitQualityRecovery(eventId, input={}) { const events=readEvents(); const event=events.find(i=>i.id===eventId); if(!event)return{updated:false,reason:'not_found'}; if(event.recovery?.taskId===input.taskId)return{updated:true,reason:'already_submitted',event:clone(event)}; if(event.status!=='inspecting')return{updated:false,reason:'invalid_transition',event:clone(event)}; event.status='verification_pending'; event.recovery={taskId:input.taskId,scoreBefore:input.scoreBefore??event.qualityScoreBefore,scoreAfter:input.scoreAfter,levelBefore:input.levelBefore,levelAfter:input.levelAfter,verificationPassed:Boolean(input.verificationPassed),message:input.message,verifyTime:nowText()}; event.updateTime=nowText(); saveEvents(events); return{updated:true,reason:'submitted',event:clone(event)} }

export function continueQualityHandling(eventId, operator = '质量检验员', comment = '复检未通过，继续处置') {
  const events = readEvents(); const event = events.find((item) => item.id === eventId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.status !== 'verification_pending' || event.recovery?.verificationPassed !== false) return { updated: false, reason: 'invalid_transition', event: clone(event) }
  const time = nowText()
  event.recoveryHistory = [...(event.recoveryHistory || []), { ...clone(event.recovery), decision: 'continue', operator, comment, decisionTime: time }]
  event.status = 'inspecting'; event.relatedInspectionTaskId = null; event.recovery = null; event.updateTime = time
  saveEvents(events); return { updated: true, reason: 'continued', event: clone(event) }
}

export function confirmQualityRecovery({ eventId, operator, comment } = {}) {
  const events = readEvents(); const event = events.find((item) => item.id === eventId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.status === 'closed') return { updated: true, reason: 'already_closed', event: clone(event) }
  if (event.status !== 'verification_pending') return { updated: false, reason: 'invalid_transition', event: clone(event) }
  if (event.recovery?.verificationPassed !== true) return { updated: false, reason: 'recovery_not_passed', event: clone(event) }
  const time = nowText()
  event.status = 'closed'; event.closeTime = time; event.closeRecord = { operator: operator || '质量负责人', comment: comment || '人工确认质量复检恢复', time }; event.updateTime = time
  saveEvents(events); return { updated: true, reason: 'closed', event: clone(event) }
}

export const closeQualityEvent = confirmQualityRecovery

export function setQualityEventRelatedAlarm(eventId, alarmId) {
  const events = readEvents(); const event = events.find((item) => item.id === eventId)
  if (!event) return { updated: false, reason: 'not_found', event: null }
  if (event.relatedAlarmId === alarmId) return { updated: true, reason: 'already_linked', event: clone(event) }
  if (event.relatedAlarmId) return { updated: false, reason: 'already_linked', event: clone(event) }
  event.relatedAlarmId = alarmId; event.updateTime = nowText(); saveEvents(events)
  return { updated: true, reason: 'linked', event: clone(event) }
}
