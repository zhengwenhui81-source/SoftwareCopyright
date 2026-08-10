export const dashboardMetrics = [
  { key: 'status', label: '当前生产状态', value: '稳定运行', unit: '', icon: 'VideoPlay', tone: 'green', trend: '产线节拍正常' },
  { key: 'output', label: '今日产量', value: 2864, unit: 't', icon: 'Histogram', tone: 'blue', trend: '较昨日 +6.8%' },
  { key: 'equipmentRate', label: '设备运行率', value: 96.4, unit: '%', icon: 'Odometer', tone: 'cyan', trend: '关键设备 18/19' },
  { key: 'qualityRate', label: '产品质量合格率', value: 98.7, unit: '%', icon: 'CircleCheck', tone: 'purple', trend: '本月目标 ≥ 98%' },
  { key: 'alarms', label: '当前报警数量', value: 3, unit: '项', icon: 'Warning', tone: 'orange', trend: '严重报警 0 项' },
]

export const temperatureData = {
  times: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
  slab: [1182, 1195, 1208, 1201, 1215, 1209, 1220, 1214],
  rolling: [1096, 1105, 1118, 1112, 1124, 1119, 1131, 1125],
}

export const outputData = {
  times: ['0-4时', '4-8时', '8-12时', '12-16时', '16-20时', '20-24时'],
  values: [426, 472, 518, 505, 493, 450],
  target: [460, 460, 500, 500, 480, 460],
}

export const equipmentHealthData = [
  { name: '加热炉', value: 96 }, { name: '粗轧机', value: 92 },
  { name: '精轧机', value: 88 }, { name: '控冷系统', value: 94 },
  { name: '检测设备', value: 97 },
]

export const energyData = {
  names: ['电力', '天然气', '循环水', '压缩空气'],
  current: [78, 86, 64, 59],
  baseline: [82, 80, 70, 65],
}

export function fluctuate(value, amplitude = 1, decimals = 0) {
  const next = Number(value) + (Math.random() - 0.5) * amplitude
  return Number(next.toFixed(decimals))
}
