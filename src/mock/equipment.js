export const equipmentList = [
  { id: 'RF-01', type: '加热炉系统', name: '1号步进式加热炉', status: 'running', temperature: 1216, pressure: 0.42, vibration: 1.2, runtime: 4268, health: 96, load: 88, maintenance: '2026-08-26', icon: 'Sunny' },
  { id: 'RM-01', type: '粗轧机组', name: '四辊可逆粗轧机', status: 'running', temperature: 68, pressure: 28.45, vibration: 2.8, runtime: 3892, health: 92, load: 84, maintenance: '2026-08-18', icon: 'SetUp' },
  { id: 'FM-01', type: '精轧机组', name: '四辊精轧机', status: 'warning', temperature: 76, pressure: 31.28, vibration: 4.6, runtime: 4126, health: 78, load: 93, maintenance: '2026-08-12', icon: 'Operation' },
  { id: 'ACC-01', type: '控冷系统', name: '层流冷却控制系统', status: 'running', temperature: 34, pressure: 0.68, vibration: 1.0, runtime: 2986, health: 94, load: 76, maintenance: '2026-09-02', icon: 'Drizzling' },
  { id: 'UT-01', type: '在线检测设备', name: '超声波在线检测仪', status: 'running', temperature: 42, pressure: 0.31, vibration: 0.8, runtime: 1856, health: 97, load: 69, maintenance: '2026-09-08', icon: 'View' },
]

export const statusMap = {
  running: { label: '运行中', type: 'success', color: '#2bd398' },
  warning: { label: '预警', type: 'warning', color: '#ffad45' },
  stopped: { label: '已停机', type: 'info', color: '#70899b' },
  fault: { label: '故障', type: 'danger', color: '#ef6262' },
}

export const trendTimes = ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50', '11:00', '11:10', '11:20', '11:30', '11:40', '11:50']

export function createTrendData(device) {
  const make = (base, amplitude, decimals = 1) => trendTimes.map(() => Number((base + (Math.random() - .5) * amplitude).toFixed(decimals)))
  return { temperature: make(device.temperature, Math.max(device.temperature * .025, 2)), pressure: make(device.pressure, Math.max(device.pressure * .08, .08), 2), vibration: make(device.vibration, .7) }
}

export function vary(value, amplitude, decimals = 1) {
  return Number((value + (Math.random() - .5) * amplitude).toFixed(decimals))
}
