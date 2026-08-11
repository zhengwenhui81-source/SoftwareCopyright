<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import MaintenanceDialog from '@/components/equipment/MaintenanceDialog.vue'
import MaintenanceTable from '@/components/equipment/MaintenanceTable.vue'
import { getEquipmentEvents, updateEquipmentEventStatus } from '@/equipmentEvent'
import { completeMaintenanceOrder, createMaintenanceOrder, getMaintenanceOrders, updateMaintenanceStatus } from '@/maintenance'

const orders = ref([])
const riskEvents = ref([])
const dialogVisible = ref(false)
const selectedOrderId = ref('')
const selectedOrder = computed(() => orders.value.find((item) => item.id === selectedOrderId.value) || null)
const pendingCount = computed(() => orders.value.filter((item) => item.status === 'pending').length)
const scheduledCount = computed(() => orders.value.filter((item) => item.status === 'scheduled').length)
const progressCount = computed(() => orders.value.filter((item) => item.status === 'in_progress').length)
const completedCount = computed(() => orders.value.filter((item) => item.status === 'completed').length)
const availableEvents = computed(() => riskEvents.value.filter((event) => event.status !== 'closed').map((event) => ({ ...event, generated: orders.value.some((order) => order.eventId === event.id) })))
const levelMap = { high: { label: '高风险', type: 'danger' }, medium: { label: '中风险', type: 'warning' }, low: { label: '低风险', type: 'success' } }

function refreshData() {
  orders.value = getMaintenanceOrders()
  riskEvents.value = getEquipmentEvents()
}

function generateOrder(event) {
  const result = createMaintenanceOrder(event)
  if (!result.created) {
    ElMessage.warning(result.reason === 'duplicate' ? '该风险事件已生成维护工单。' : '风险事件数据不完整。')
    return
  }
  updateEquipmentEventStatus(event.id, 'confirmed')
  refreshData()
  ElMessage.success('已生成预测维护工单。')
}

function showOrder(order) {
  selectedOrderId.value = order.id
  dialogVisible.value = true
}

function advanceOrder(order, owner) {
  if (order.status === 'in_progress') {
    const result = completeMaintenanceOrder(order.id, owner)
    if (!result.completed) return ElMessage.error('工单完成操作失败。')
    updateEquipmentEventStatus(order.eventId, 'closed')
    refreshData()
    ElMessage.success('维护已完成，健康恢复模拟结果已生成。')
    return
  }
  const nextStatus = order.status === 'pending' ? 'scheduled' : 'in_progress'
  const result = updateMaintenanceStatus(order.id, nextStatus, owner)
  if (!result.updated) return ElMessage.error('工单状态流转失败。')
  refreshData()
  ElMessage.success(nextStatus === 'scheduled' ? '维护任务已安排。' : '维护任务已开始执行。')
}

onMounted(refreshData)
</script>

<template>
  <div class="maintenance-page">
    <section class="page-header"><div><p>PREDICTIVE MAINTENANCE CENTER</p><h2>设备预测维护中心</h2></div><span><i></i>预测维护演示 · 基于工业仿真数据</span></section>
    <section class="overview">
      <div><span>待确认任务</span><strong class="orange">{{ pendingCount }}<small>项</small></strong><el-icon><Document /></el-icon></div>
      <div><span>已安排任务</span><strong class="cyan">{{ scheduledCount }}<small>项</small></strong><el-icon><Calendar /></el-icon></div>
      <div><span>执行中任务</span><strong class="red">{{ progressCount }}<small>项</small></strong><el-icon><Tools /></el-icon></div>
      <div><span>已完成任务</span><strong class="green">{{ completedCount }}<small>项</small></strong><el-icon><CircleCheck /></el-icon></div>
    </section>

    <section class="source-panel">
      <header><div><i></i><h3>风险事件来源</h3><span>RISK EVENT SOURCE</span></div><small>工单仅由设备风险事件生成</small></header>
      <el-table :data="availableEvents" empty-text="暂无可用风险事件，请先在故障预测页面生成风险事件">
        <el-table-column prop="id" label="事件编号" width="135" /><el-table-column prop="equipmentName" label="设备" min-width="160" /><el-table-column prop="title" label="预测故障" min-width="180" />
        <el-table-column label="风险等级" width="90"><template #default="{ row }"><el-tag :type="levelMap[row.level]?.type" size="small">{{ levelMap[row.level]?.label }}</el-tag></template></el-table-column>
        <el-table-column prop="createTime" label="事件时间" width="165" /><el-table-column label="维护建议" min-width="190"><template #default="{ row }">{{ row.suggestion?.join('；') || '执行设备专项检查' }}</template></el-table-column>
        <el-table-column label="操作" width="125" fixed="right"><template #default="{ row }"><el-button type="primary" size="small" :disabled="row.generated" @click="generateOrder(row)">{{ row.generated ? '已生成工单' : '生成维护工单' }}</el-button></template></el-table-column>
      </el-table>
    </section>

    <MaintenanceTable :orders="orders" @select="showOrder" />
    <MaintenanceDialog v-model="dialogVisible" :order="selectedOrder" @advance="advanceOrder" />
  </div>
</template>

<style scoped>
.maintenance-page{display:grid;gap:12px;color:#dcecf7}.page-header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 3px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.page-header>span{color:#6e91aa;font-size:11px}.page-header i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.overview{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.overview>div{position:relative;min-height:82px;padding:15px 18px;background:linear-gradient(135deg,#0d3554,#092640);border:1px solid #214d6b}.overview span{display:block;color:#7293aa;font-size:10px}.overview strong{display:block;margin-top:7px;color:#dcecf7;font:600 25px Consolas}.overview small{margin-left:4px;color:#6d8da4;font:10px "Microsoft YaHei"}.overview .el-icon{position:absolute;right:18px;top:25px;color:#245f82;font-size:30px}.green{color:#2bd398!important}.orange{color:#ffad45!important}.red{color:#ef6262!important}.cyan{color:#31c9df!important}.source-panel{background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.source-panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;padding:0 14px;border-bottom:1px solid rgba(55,107,142,.35)}.source-panel header>div{display:flex;align-items:center;gap:8px}.source-panel header i{width:3px;height:15px;background:#ffad45}.source-panel h3{margin:0;font-size:14px}.source-panel header span,.source-panel header small{color:#557a92;font:9px Consolas}.source-panel :deep(.el-table){--el-table-bg-color:transparent;--el-table-tr-bg-color:transparent;--el-table-header-bg-color:#0d3553;--el-table-row-hover-bg-color:#124464;--el-table-border-color:#20465f;--el-table-text-color:#b9d2e1;--el-table-header-text-color:#7599af;background:transparent}@media(max-width:800px){.overview{grid-template-columns:repeat(2,1fr)}.page-header{align-items:flex-start;flex-direction:column;gap:8px}}
</style>
