const node = (id, name, category, x, y, properties) => ({ id, name, category, x, y, symbolSize: category === 0 ? 72 : category === 1 ? 54 : 42, properties })
export const graphCategories = [{ name:'产品层' },{ name:'工艺层' },{ name:'设备层' },{ name:'参数层' },{ name:'质量层' },{ name:'异常层' }]
export const graphNodes = [
  node('product','厚板产品',0,500,300,{类型:'钢铁产品',钢种:'Q355B / Q345R / Q420D',状态:'在产'}),
  node('casting','连铸',1,180,90,{工序代码:'CC',上游:'炼钢',输出:'板坯'}), node('heating','加热',1,330,100,{目标温度:'1180–1230℃',控制方式:'三级炉温'}), node('roughing','粗轧',1,500,90,{道次:'5–7',功能:'展宽与减薄'}), node('finishing','精轧',1,670,100,{目标厚度:'20–60mm',控制系统:'AGC'}), node('cooling','控冷',1,820,90,{冷速:'12–18℃/s',终冷温度:'650℃'}), node('inspection','检测',1,920,260,{标准:'GB/T 709',方式:'在线综合检测'}),
  node('furnace','加热炉',2,250,230,{设备编号:'RF-01',健康度:'96',状态:'运行'}), node('mill','轧机',2,510,210,{设备编号:'RM/FM-01',健康度:'85',状态:'运行'}), node('cooler','冷却设备',2,760,230,{设备编号:'ACC-01',健康度:'94',状态:'运行'}), node('detector','检测设备',2,830,370,{设备编号:'UT-01',健康度:'97',状态:'运行'}),
  node('temperature','温度',3,250,390,{单位:'℃',采样周期:'1s',来源:'热电偶'}), node('pressure','压力',3,430,400,{单位:'MPa/kN',采样周期:'100ms',来源:'压力传感器'}), node('speed','速度',3,590,420,{单位:'m/s',控制方式:'闭环'}), node('thickness','厚度',3,720,420,{单位:'mm',精度:'±0.1mm'}),
  node('strength','强度',4,380,550,{指标:'屈服/抗拉',标准:'GB/T 228.1'}), node('surface','表面缺陷',4,580,560,{类型:'划伤/氧化铁皮/裂纹',检测:'机器视觉'}), node('dimension','尺寸精度',4,760,540,{厚度公差:'±0.3mm',宽度公差:'±5mm'}),
  node('equipmentError','设备异常',5,120,470,{等级:'严重/警告/提示',处置:'维护工单'}), node('processError','工艺异常',5,900,500,{类型:'温度/压力/速度偏离',处置:'参数调整'}), node('qualityError','质量异常',5,620,650,{类型:'性能/表面/尺寸',处置:'复检或降级'}),
]
export const graphLinks = [
  ['casting','heating','影响'],['heating','roughing','影响'],['roughing','finishing','影响'],['finishing','cooling','影响'],['cooling','inspection','影响'],['inspection','product','检测'],
  ['furnace','heating','包含'],['mill','roughing','包含'],['mill','finishing','包含'],['cooler','cooling','包含'],['detector','inspection','检测'],
  ['temperature','furnace','关联'],['temperature','heating','影响'],['pressure','mill','关联'],['speed','finishing','影响'],['thickness','inspection','检测'],
  ['heating','strength','影响'],['finishing','dimension','影响'],['cooling','strength','影响'],['inspection','surface','检测'],['inspection','dimension','检测'],
  ['furnace','equipmentError','产生异常'],['mill','equipmentError','产生异常'],['finishing','processError','产生异常'],['cooling','processError','产生异常'],['surface','qualityError','属于'],['dimension','qualityError','属于'],
].map(([source, target, relation]) => {
  const label = relation || '关联'
  return { source, target, name: label, label, value: label }
})
