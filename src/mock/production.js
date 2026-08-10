export const productionSummary = {
  batchNo: 'PL-20260810-027',
  steelGrade: 'Q355B',
  specification: '30 × 2500 × 12000 mm',
  planQuantity: 36,
  completedQuantity: 21,
  startTime: '08:16:32',
}

export const initialProductionProcesses = [
  {
    id: 'casting', name: '炼钢与连铸', shortName: '连铸', icon: 'Grid', status: 'completed', progress: 100,
    equipment: 'CCM-02 连铸机', duration: '42 分钟', operator: '张工',
    parameters: [{ name: '钢水温度', value: 1538, unit: '℃', range: '1520–1550' }, { name: '拉坯速度', value: 1.18, unit: 'm/min', range: '1.0–1.3' }],
    description: '钢水经二次精炼后连续浇铸形成厚板板坯。',
  },
  {
    id: 'heating', name: '板坯加热', shortName: '加热', icon: 'Sunny', status: 'completed', progress: 100,
    equipment: 'RF-01 步进式加热炉', duration: '168 分钟', operator: '李工',
    parameters: [{ name: '加热温度', value: 1216, unit: '℃', range: '1180–1230' }, { name: '炉内状态', value: '均热完成', unit: '', range: '正常' }],
    description: '板坯在步进式加热炉内完成预热、加热与均热。',
  },
  {
    id: 'roughing', name: '粗轧', shortName: '粗轧', icon: 'SetUp', status: 'completed', progress: 100,
    equipment: 'RM-01 四辊可逆轧机', duration: '9 分钟', operator: '王工',
    parameters: [{ name: '轧制力', value: 28450, unit: 'kN', range: '26000–30000' }, { name: '轧制速度', value: 2.86, unit: 'm/s', range: '2.5–3.2' }],
    description: '通过多道次可逆轧制完成展宽与初步厚度控制。',
  },
  {
    id: 'finishing', name: '精轧', shortName: '精轧', icon: 'Operation', status: 'running', progress: 68,
    equipment: 'FM-01 四辊精轧机', duration: '进行中 6 分钟', operator: '赵工',
    parameters: [{ name: '厚度控制', value: 30.12, unit: 'mm', range: '29.7–30.3' }, { name: '轧制压力', value: 31280, unit: 'kN', range: '28000–33000' }],
    description: '采用自动厚度控制系统执行终轧，获得目标厚度和板形。',
  },
  {
    id: 'cooling', name: '控冷', shortName: '控冷', icon: 'Drizzling', status: 'waiting', progress: 0,
    equipment: 'ACC-01 层流冷却系统', duration: '待开始', operator: '周工',
    parameters: [{ name: '冷却速度', value: 14.5, unit: '℃/s', range: '12–18' }, { name: '水流量', value: 4260, unit: 'm³/h', range: '3800–4600' }],
    description: '通过层流冷却精确控制钢板冷却速度与终冷温度。',
  },
  {
    id: 'straightening', name: '矫直', shortName: '矫直', icon: 'DCaret', status: 'waiting', progress: 0,
    equipment: 'HL-01 热矫直机', duration: '待开始', operator: '陈工',
    parameters: [{ name: '矫直压力', value: 8650, unit: 'kN', range: '7500–9500' }, { name: '辊缝设定', value: 29.92, unit: 'mm', range: '29.6–30.2' }],
    description: '消除轧制和冷却过程中产生的钢板弯曲与瓢曲。',
  },
  {
    id: 'inspection', name: '质量检测', shortName: '检测', icon: 'View', status: 'waiting', progress: 0,
    equipment: 'UT-01 在线检测中心', duration: '待开始', operator: '刘工',
    parameters: [{ name: '厚度偏差', value: 0.12, unit: 'mm', range: '±0.3' }, { name: '表面质量', value: 'Ⅰ级', unit: '', range: 'Ⅰ–Ⅱ级' }],
    description: '执行尺寸、板形、表面及超声波内部缺陷综合检测。',
  },
  {
    id: 'storage', name: '入库', shortName: '入库', icon: 'Box', status: 'waiting', progress: 0,
    equipment: 'WH-03 智能成品库', duration: '待开始', operator: '系统调度',
    parameters: [{ name: '目标库位', value: 'C03-18', unit: '', range: '自动分配' }, { name: '板材重量', value: 7.07, unit: 't', range: '6.9–7.2' }],
    description: '合格钢板完成喷印、信息绑定后由行车自动调度入库。',
  },
]

export const statusMeta = {
  completed: { label: '已完成', type: 'success' },
  running: { label: '运行中', type: 'primary' },
  waiting: { label: '待运行', type: 'info' },
  abnormal: { label: '异常', type: 'danger' },
}

export function fluctuateProcessValue(value, amplitude = 1, decimals = 0) {
  if (typeof value !== 'number') return value
  return Number((value + (Math.random() - 0.5) * amplitude).toFixed(decimals))
}
