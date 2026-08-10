const rules = [
  { keywords: ['精轧', '轧制力', '压力'], risk: '高', causes: ['板坯温度不足导致材料变形抗力增大', '材料性能或成分出现批次波动', '轧辊、轴承或液压压下系统状态异常'], suggestions: ['降低当前轧制速度 8%–12%', '核验板坯入精轧温度并调整加热制度', '检查精轧机轴承振动及压下系统', '下一块钢板采用保守压下规程'] },
  { keywords: ['加热炉', '温度', '炉温'], risk: '中', causes: ['燃气流量或空燃比控制偏差', '热电偶漂移导致测量异常', '炉门密封不良造成局部热损失'], suggestions: ['校验热电偶与温控回路', '调整燃气流量及空燃比', '检查炉门密封与炉压曲线'] },
  { keywords: ['振动', '轴承', '设备'], risk: '高', causes: ['轴承润滑不足或磨损加剧', '连接件松动或基础刚度下降', '旋转部件动平衡异常'], suggestions: ['降低负载并持续监测振动趋势', '检查轴承温升与润滑油状态', '安排停机窗口进行动平衡检测'] },
  { keywords: ['厚度', '偏差', '质量'], risk: '中', causes: ['自动厚度控制参数漂移', '轧辊热膨胀补偿不充分', '来料温度与厚度波动'], suggestions: ['重新标定 AGC 参数', '修正轧辊热膨胀补偿值', '加强入口测厚与温度前馈控制'] },
]
const fallback = { risk: '中', causes: ['工艺参数偏离控制窗口', '设备实时状态短时波动', '原料条件与生产计划存在差异'], suggestions: ['核对工艺参数和设备状态', '降低当前工序负荷并加强监控', '由专业工程师确认后调整参数'] }

export async function analyzeIndustrialIssue(input, context = {}) {
  // 未来接入真实大模型 API：由后端代理发送 input、context 与知识库检索结果。
  await new Promise(resolve => setTimeout(resolve, 900 + Math.random() * 600))
  const rule = rules.find(item => item.keywords.some(keyword => input.includes(keyword))) || fallback
  const abnormalType = input.includes('振动') || input.includes('设备') ? '设备状态异常' : input.includes('厚度') || input.includes('质量') ? '产品质量异常' : '生产工艺异常'
  const knowledgeBasis = ['厚板生产工业本体关系', '当前批次模拟工艺参数', '设备健康与振动阈值规则', '同类异常历史案例规则']
  return { id: `DEC-${Date.now()}`, issue: input, abnormalType, risk: rule.risk, confidence: 91, causes: rule.causes, knowledgeBasis, suggestions: rule.suggestions, context: { batch: context.batch || 'PL-20260810-027', process: context.process || '精轧', equipment: context.equipment || 'FM-01 精轧机', model: '工业基座大模型 · 模拟推理' }, timestamp: new Date().toLocaleString('zh-CN', { hour12: false }) }
}

export async function chatWithIndustrialAI(message) {
  const analysis = await analyzeIndustrialIssue(message)
  return { role: 'assistant', content: `【分析对象】${analysis.context.equipment} / ${analysis.context.process}工序\n\n【异常状态】${analysis.abnormalType}：${message}\n\n【原因分析】${analysis.causes.join('；')}\n\n【知识依据】${analysis.knowledgeBasis.join('；')}\n\n【优化建议】${analysis.suggestions.join('；')}`, analysis }
}
