/** 厚板工艺参数统一仿真规则；供参数分析、页面展示与报警判断共同使用。 */
export const processParameterRuleList = [
  { processId: 'heating', processName: '板坯加热', parameterKey: 'furnaceTemperature', parameterName: '炉温', aliases: ['炉温', '加热温度'], unit: '℃', min: 1180, max: 1230, type: 'temperature', alarmLevel: 'critical', suggestion: '检查炉温控制回路、燃气流量和板坯在炉时间。' },
  { processId: 'heating', processName: '板坯加热', parameterKey: 'heatingTime', parameterName: '加热时间', aliases: ['加热时间'], unit: 'min', min: 150, max: 180, type: 'time' },
  { processId: 'roughing', processName: '粗轧', parameterKey: 'rollingForce', parameterName: '轧制力', aliases: ['轧制力'], unit: 'kN', min: 26000, max: 30000, type: 'pressure', alarmLevel: 'warning', suggestion: '核验板坯温度、道次压下量及粗轧机传动状态。' },
  { processId: 'roughing', processName: '粗轧', parameterKey: 'rollingSpeed', parameterName: '轧制速度', aliases: ['轧制速度'], unit: 'm/s', min: 2.5, max: 3.2, type: 'speed' },
  { processId: 'finishing', processName: '精轧', parameterKey: 'rollingPressure', parameterName: '轧制压力', aliases: ['轧制压力'], unit: 'kN', min: 28000, max: 31000, type: 'pressure', alarmLevel: 'warning', suggestion: '降低轧制速度，检查板坯温度和液压压下系统。' },
  { processId: 'finishing', processName: '精轧', parameterKey: 'thickness', parameterName: '板厚', aliases: ['板厚', '厚度控制'], unit: 'mm', min: 29.7, max: 30.3, type: 'thickness' },
  { processId: 'cooling', processName: '控冷', parameterKey: 'coolingRate', parameterName: '冷却速度', aliases: ['冷却速度'], unit: '℃/s', min: 12, max: 18, type: 'speed', alarmLevel: 'warning', suggestion: '检查层流冷却水压、喷嘴状态及冷却模型参数。' },
  { processId: 'cooling', processName: '控冷', parameterKey: 'finishCoolingTemperature', parameterName: '终冷温度', aliases: ['终冷温度'], unit: '℃', min: 620, max: 680, type: 'temperature', alarmLevel: 'warning', suggestion: '调整冷却水量和辊道速度，核验测温装置。' },
  { processId: 'inspection', processName: '质量检测', parameterKey: 'thicknessDeviation', parameterName: '厚度偏差', aliases: ['厚度偏差'], unit: 'mm', min: -0.3, max: 0.3, type: 'thickness' },
  { processId: 'inspection', processName: '质量检测', parameterKey: 'surfaceQuality', parameterName: '表面质量等级', aliases: ['表面质量等级', '表面质量'], unit: '级', min: 1, max: 2, type: 'quality' },
]

export const processParameterRules = processParameterRuleList.reduce((groups, rule) => {
  if (!groups[rule.processName]) groups[rule.processName] = {}
  groups[rule.processName][rule.parameterKey] = { ...rule, name: rule.parameterName }
  return groups
}, {})

export function findProcessParameterRule({ processId, processName, parameterKey, parameterName } = {}) {
  return processParameterRuleList.find((rule) => {
    const processMatched = (!processId || rule.processId === processId) && (!processName || rule.processName === processName)
    const parameterMatched = (!parameterKey || rule.parameterKey === parameterKey) && (!parameterName || rule.aliases.includes(parameterName))
    return processMatched && parameterMatched
  }) || null
}

export function formatProcessParameterRange(rule, separator = '–') {
  return rule ? `${rule.min}${separator}${rule.max} ${rule.unit}` : ''
}
