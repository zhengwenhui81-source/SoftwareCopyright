/** 工业仿真静态关系，仅描述工序与设备，不保存运行状态。 */
export const processEquipmentRelations = {
  steelmaking: { processName: '炼钢与连铸', equipmentId: '' },
  heating: { processName: '板坯加热', equipmentId: 'RF-01' },
  roughing: { processName: '粗轧', equipmentId: 'RM-01' },
  finishing: { processName: '精轧', equipmentId: 'FM-01' },
  cooling: { processName: '控冷', equipmentId: 'ACC-01' },
  inspection: { processName: '质量检测', equipmentId: 'UT-01' },
}

export function getEquipmentIdByProcess(processId, processName) {
  return processEquipmentRelations[processId]?.equipmentId
    || Object.values(processEquipmentRelations).find((item) => item.processName === processName)?.equipmentId
    || ''
}
