export const alarmLevels = { critical: { label: '严重', type: 'danger' }, warning: { label: '警告', type: 'warning' }, info: { label: '提示', type: 'primary' } }
export const alarmStatuses = { pending: { label: '待处理', type: 'danger' }, processing: { label: '处理中', type: 'warning' }, resolved: { label: '已处理', type: 'success' }, closed: { label: '已关闭', type: 'info' } }
export const alarmRecords = [
  { id: 'ALM-20260810-018', device: 'FM-01 精轧机', level: 'warning', time: '2026-08-10 11:46:28', reason: '传动侧轴承振动值持续升高', value: '4.6 mm/s', threshold: '4.5 mm/s', status: 'pending', owner: '未指派', suggestion: '检查轴承润滑状态、地脚螺栓及轧辊动平衡。' },
  { id: 'ALM-20260810-017', device: 'RF-01 加热炉', level: 'info', time: '2026-08-10 11:18:42', reason: '二区炉温接近工艺上限', value: '1226 ℃', threshold: '1230 ℃', status: 'processing', owner: '李工', suggestion: '适当降低二区燃气流量，观察板坯出炉温度。' },
  { id: 'ALM-20260810-016', device: 'ACC-01 控冷系统', level: 'warning', time: '2026-08-10 10:52:17', reason: '第6组喷嘴水压波动', value: '0.58 MPa', threshold: '≥0.60 MPa', status: 'processing', owner: '周工', suggestion: '检查过滤器压差与喷嘴堵塞情况。' },
  { id: 'ALM-20260810-015', device: 'UT-01 在线检测仪', level: 'critical', time: '2026-08-10 09:36:05', reason: '探头组通讯中断', value: '连接超时', threshold: '3 s', status: 'resolved', owner: '刘工', suggestion: '重启采集模块并检查工业以太网连接。' },
  { id: 'ALM-20260810-014', device: 'RM-01 粗轧机', level: 'warning', time: '2026-08-10 08:48:31', reason: '主电机电流瞬时过载', value: '112%', threshold: '110%', status: 'resolved', owner: '王工', suggestion: '核对压下量与板坯温度，避免单道次负荷过大。' },
  { id: 'ALM-20260809-013', device: 'RF-01 加热炉', level: 'info', time: '2026-08-09 23:26:19', reason: '烟气含氧量偏高', value: '5.2%', threshold: '≤5.0%', status: 'closed', owner: '李工', suggestion: '校准空燃比并排查炉门密封。' },
]
export const alarmTrend = { times: ['06时', '07时', '08时', '09时', '10时', '11时', '12时'], critical: [0, 0, 0, 1, 0, 0, 0], warning: [1, 0, 1, 0, 1, 2, 1], info: [2, 1, 0, 1, 0, 1, 1] }
