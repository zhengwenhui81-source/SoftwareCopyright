export const qualityMetrics = [
  { key: 'thickness', label: '平均板厚偏差', value: 0.12, unit: 'mm', target: '控制标准 ±0.30 mm', status: 'good', icon: 'ScaleToOriginal' },
  { key: 'shape', label: '板形质量指数', value: 96.8, unit: '分', target: '目标值 ≥ 95 分', status: 'good', icon: 'DataLine' },
  { key: 'defect', label: '表面缺陷率', value: 0.38, unit: '%', target: '控制目标 ≤ 0.50%', status: 'good', icon: 'Warning' },
  { key: 'performance', label: '性能指标达标率', value: 99.1, unit: '%', target: '力学性能综合达标', status: 'good', icon: 'Medal' },
  { key: 'qualified', label: '产品合格率', value: 98.7, unit: '%', target: '当日目标 ≥ 98.0%', status: 'excellent', icon: 'CircleCheck' },
]

export const qualityTrend = {
  dates: ['08-04', '08-05', '08-06', '08-07', '08-08', '08-09', '08-10'],
  qualified: [98.1, 98.4, 98.2, 98.8, 98.6, 99.0, 98.7],
  thickness: [0.18, 0.16, 0.17, 0.13, 0.15, 0.11, 0.12],
}

export const defectDistribution = [
  { name: '无缺陷', value: 94.8 }, { name: '轻微划伤', value: 1.8 },
  { name: '氧化铁皮', value: 1.5 }, { name: '边部裂纹', value: 0.7 },
  { name: '板形偏差', value: 1.2 },
]

export const qualityBatches = [
  { batchNo: 'PL-20260810-027', steelGrade: 'Q355B', specification: '30×2500×12000', quantity: 36, qualified: 36, thickness: 0.12, shape: 97.2, defectRate: 0.22, tensile: 526, yield: 382, status: 'qualified', inspector: '刘工', time: '11:42:18' },
  { batchNo: 'PL-20260810-026', steelGrade: 'Q345R', specification: '24×2200×10000', quantity: 42, qualified: 41, thickness: 0.18, shape: 95.8, defectRate: 0.48, tensile: 518, yield: 368, status: 'review', inspector: '陈工', time: '10:28:35' },
  { batchNo: 'PL-20260810-025', steelGrade: 'Q355B', specification: '20×2000×9000', quantity: 48, qualified: 48, thickness: 0.09, shape: 98.1, defectRate: 0.16, tensile: 534, yield: 391, status: 'qualified', inspector: '刘工', time: '09:16:42' },
  { batchNo: 'PL-20260810-024', steelGrade: 'Q420D', specification: '36×2800×12000', quantity: 28, qualified: 26, thickness: 0.28, shape: 93.6, defectRate: 0.82, tensile: 548, yield: 426, status: 'unqualified', inspector: '周工', time: '08:52:06' },
  { batchNo: 'PL-20260809-023', steelGrade: 'Q345R', specification: '28×2400×11000', quantity: 32, qualified: 32, thickness: 0.14, shape: 96.9, defectRate: 0.31, tensile: 512, yield: 365, status: 'qualified', inspector: '陈工', time: '23:38:19' },
  { batchNo: 'PL-20260809-022', steelGrade: 'Q355B', specification: '32×2600×12000', quantity: 30, qualified: 29, thickness: 0.21, shape: 95.1, defectRate: 0.56, tensile: 529, yield: 387, status: 'review', inspector: '刘工', time: '21:25:44' },
]

export const qualityStatus = {
  qualified: { label: '合格', type: 'success' }, review: { label: '待复检', type: 'warning' }, unqualified: { label: '不合格', type: 'danger' },
}

export const inspectionItems = [
  { item: '尺寸精度', method: '激光测厚/测宽', standard: 'GB/T 709-2019', result: '符合', status: 'qualified' },
  { item: '表面质量', method: '机器视觉检测', standard: 'GB/T 14977-2008', result: 'Ⅱ级', status: 'qualified' },
  { item: '内部质量', method: '超声波探伤', standard: 'GB/T 2970-2016', result: 'Ⅰ级', status: 'qualified' },
  { item: '拉伸性能', method: '万能材料试验', standard: 'GB/T 228.1-2021', result: '达标', status: 'qualified' },
  { item: '板形质量', method: '在线平直度检测', standard: '企业内控标准', result: '符合', status: 'qualified' },
]
