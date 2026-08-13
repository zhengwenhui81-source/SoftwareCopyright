import { getAlarmEvents } from './alarmEvent.js'
import { getEquipmentEvents } from './equipmentEvent.js'
import { evaluateEquipmentHealth } from './equipmentHealth.js'
import { getEquipmentRecoveries } from './equipmentRecovery.js'
import { getMaintenanceOrders } from './maintenance.js'
import { equipmentList } from './mock/equipment.js'
import { analyzeParameterStatus, getProcessParameters } from './processParameter.js'
import { getProductionAdjustments } from './productionAdjustment.js'
import { getProductionEvents } from './productionEvent.js'
import { analyzeQualityStatus, getBatchQuality } from './qualityData.js'
import { getQualityEvents } from './qualityEvent.js'
import { getQualityInspectionTasks } from './qualityInspection.js'
import { getEquipmentIdByProcess } from './industrialRelation.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
function nowText(date=new Date()){const pad=v=>String(v).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`}
function decisionId(date=new Date()){return `DR-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${String(date.getTime()).slice(-6)}`}

export function buildDecisionContext(batchId='') {
  const allProductionEvents=getProductionEvents(); const allQualityEvents=getQualityEvents()
  const selectedBatch=batchId||allProductionEvents.find(item=>item.status!=='closed')?.batchId||allQualityEvents.find(item=>item.status!=='closed')?.batchId||''
  const productionEvents=allProductionEvents.filter(item=>(!selectedBatch||item.batchId===selectedBatch)&&item.status!=='closed')
  const abnormalParameters=productionEvents.flatMap(event=>{const record=getProcessParameters(event.batchId,event.process);const status=analyzeParameterStatus(record).find(item=>item.key===event.parameterKey||item.name===event.parameter);return status&&status.status!=='正常'?[{...status,batchId:event.batchId,process:event.process,processId:event.processId,eventId:event.id,equipmentId:getEquipmentIdByProcess(event.processId,event.process)}]:[]})
  const adjustments=getProductionAdjustments().filter(item=>!selectedBatch||item.batchId===selectedBatch)
  const equipmentEvents=getEquipmentEvents().filter(item=>item.status!=='closed')
  const healthStates=equipmentList.map(evaluateEquipmentHealth)
  const riskEvents=equipmentEvents.filter(event=>{const health=healthStates.find(item=>item.equipmentId===event.equipmentId);return health&&(health.score<70||health.failureProbability>50)})
  const qualityEvents=allQualityEvents.filter(item=>(!selectedBatch||item.batchId===selectedBatch)&&item.status!=='closed')
  const latestQuality=selectedBatch?getBatchQuality(selectedBatch):null
  const qualityAnalysis=latestQuality?analyzeQualityStatus(latestQuality):null
  const activeQualityEvents=qualityEvents.filter(()=>qualityAnalysis&&['关注','异常'].includes(qualityAnalysis.qualityLevel.label))
  const alarms=getAlarmEvents(); const relevantAlarms=alarms.filter(item=>(!selectedBatch||!item.batchId||item.batchId===selectedBatch)&&!['closed','cancelled'].includes(item.status))
  return clone({batchId:selectedBatch,production:{activeEvents:productionEvents,abnormalParameters,recentAdjustments:adjustments},equipment:{riskEvents,healthStates,maintenanceOrders:getMaintenanceOrders(),recoveryStates:getEquipmentRecoveries()},quality:{activeEvents:activeQualityEvents,latestQuality,analysis:qualityAnalysis,inspectionTasks:getQualityInspectionTasks().filter(item=>!selectedBatch||item.batchId===selectedBatch)},alarms:{active:relevantAlarms,recoveryPending:relevantAlarms.filter(item=>item.status==='recovery_pending')}})
}

export function getDecisionEvidence(context) {
  const evidence=[]
  context.production.abnormalParameters.forEach(item=>evidence.push({type:'production',refId:item.eventId,text:`${item.process}${item.name}${item.value} ${item.unit}，仿真范围${item.range}`}))
  context.production.recentAdjustments.filter(item=>item.status==='completed').slice(0,2).forEach(item=>evidence.push({type:'production',refId:item.id,text:`已执行：${item.parameterName}由${item.beforeValue}调整至${item.actualValue} ${item.unit}`}))
  context.equipment.riskEvents.forEach(event=>{const health=context.equipment.healthStates.find(item=>item.equipmentId===event.equipmentId);evidence.push({type:'equipment',refId:event.id,text:`${event.equipmentName}健康评分${health?.score ?? event.healthScore}，故障概率${health?.failureProbability ?? event.failureProbability}%`})})
  context.equipment.recoveryStates.slice(0,2).forEach(item=>evidence.push({type:'equipment',refId:item.orderId,text:`已执行：${item.equipmentId}维护后健康评分${item.afterHealth}，故障概率${item.afterProbability}%`}))
  context.quality.activeEvents.forEach(event=>evidence.push({type:'quality',refId:event.id,text:`批次${event.batchId}质量评分${context.quality.analysis?.qualityScore ?? event.qualityScoreBefore}，等级${context.quality.analysis?.qualityLevel.label || event.qualityLevel}`}))
  context.quality.inspectionTasks.filter(item=>item.status==='completed').slice(0,2).forEach(item=>evidence.push({type:'quality',refId:item.id,text:`已执行：质量复检完成，结果${item.afterResult?.qualityScore}分 · ${item.afterResult?.qualityLevel}`}))
  context.alarms.recoveryPending.forEach(item=>evidence.push({type:'alarm',refId:item.id,text:`业务风险已进入恢复验证，等待人工确认：${item.title}`}))
  return evidence
}

export function getDecisionRecommendations(context) {
  const recommendations=[]; let priority=1
  context.equipment.riskEvents.forEach(event=>recommendations.push({priority:priority++,actionType:'maintenance',targetId:event.equipmentId,text:`优先处理${event.equipmentName}设备风险`,reason:`健康风险事件${event.id}仍有效`,refId:event.id,status:'建议执行'}))
  context.production.abnormalParameters.forEach(item=>recommendations.push({priority:priority++,actionType:'parameter_adjustment',targetId:item.key,text:`将${item.process}${item.name}调整至仿真正常范围`,reason:`当前值${item.value} ${item.unit}，标准${item.range}`,refId:item.eventId,status:'建议执行',batchId:item.batchId,process:item.process}))
  context.quality.activeEvents.forEach(event=>recommendations.push({priority:priority++,actionType:'quality_reinspection',targetId:event.id,text:`对批次${event.batchId}执行质量复检`,reason:`质量等级${context.quality.analysis?.qualityLevel.label || event.qualityLevel}`,refId:event.id,status:'建议执行',batchId:event.batchId}))
  context.alarms.recoveryPending.forEach(item=>recommendations.push({priority:priority++,actionType:'alarm_handling',targetId:item.id,text:'完成报警恢复人工确认',reason:`报警${item.id}处于恢复验证状态`,refId:item.id,status:'待人工确认'}))
  return recommendations
}

export function generateDecision(context=buildDecisionContext()) {
  const evidence=getDecisionEvidence(context); const recommendations=getDecisionRecommendations(context)
  const sourceCount=['production','equipment','quality'].filter(type=>evidence.some(item=>item.type===type&&!item.text.startsWith('已执行'))).length
  const criticalAlarm=context.alarms.active.some(item=>item.level==='critical'); const highDevice=context.equipment.riskEvents.some(item=>item.level==='high'||item.failureProbability>=60)
  const riskLevel=sourceCount>=3||criticalAlarm?'critical':sourceCount>=2||highDevice?'high':sourceCount===1?'medium':context.alarms.recoveryPending.length?'low':'low'
  const confidence=sourceCount>=3?.9:sourceCount===2?.82:sourceCount===1?.72:.68
  const resolved=!context.production.abnormalParameters.length&&!context.equipment.riskEvents.length&&!context.quality.activeEvents.length
  return {id:decisionId(),batchId:context.batchId,title:resolved?'当前关联风险已解除':'多源工业异常处置建议',riskLevel,confidence,summary:resolved?(context.alarms.recoveryPending.length?'业务风险已恢复，仍有报警等待人工恢复确认。':'当前生产、设备和质量关联风险均已解除。'):`检测到${sourceCount}类有效业务风险，建议按优先级进入对应业务模块处置。`,evidence,recommendations,createTime:nowText(),dataMode:'智能决策演示 · 基于工业仿真数据与规则推理'}
}
