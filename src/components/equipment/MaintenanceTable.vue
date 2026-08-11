<script setup>
defineProps({ orders: { type: Array, required: true } })
defineEmits(['select'])
const priorityMap = { high: { label: '高', type: 'danger' }, medium: { label: '中', type: 'warning' }, low: { label: '低', type: 'success' } }
const statusMap = { pending: { label: '待确认', type: 'warning' }, scheduled: { label: '已安排', type: 'primary' }, in_progress: { label: '执行中', type: 'danger' }, completed: { label: '已完成', type: 'success' } }
</script>

<template>
  <section class="order-panel">
    <header><div><i></i><h3>预测维护工单列表</h3><span>MAINTENANCE ORDERS</span></div><small>预测维护演示 · 基于工业仿真数据</small></header>
    <el-table :data="orders" empty-text="暂无维护工单" @row-click="row => $emit('select', row)">
      <el-table-column prop="id" label="工单编号" width="155" />
      <el-table-column label="设备" min-width="170"><template #default="{ row }"><div class="device"><small>{{ row.equipmentId }}</small><b>{{ row.equipmentName }}</b></div></template></el-table-column>
      <el-table-column prop="eventId" label="风险来源" width="135" />
      <el-table-column prop="type" label="维护类型" width="105" />
      <el-table-column label="优先级" width="80"><template #default="{ row }"><el-tag :type="priorityMap[row.priority]?.type" size="small">{{ priorityMap[row.priority]?.label || '中' }}</el-tag></template></el-table-column>
      <el-table-column label="当前状态" width="95"><template #default="{ row }"><el-tag :type="statusMap[row.status]?.type" size="small" effect="plain">{{ statusMap[row.status]?.label }}</el-tag></template></el-table-column>
      <el-table-column prop="owner" label="负责人" width="100" />
      <el-table-column prop="createTime" label="创建时间" width="165" />
      <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button text type="primary" size="small" @click.stop="$emit('select', row)">工单详情</el-button></template></el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.order-panel{background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.order-panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;padding:0 14px;border-bottom:1px solid rgba(55,107,142,.35)}.order-panel header>div{display:flex;align-items:center;gap:8px}.order-panel header i{width:3px;height:15px;background:#2bb7ec;box-shadow:0 0 8px #2bb7ec}.order-panel h3{margin:0;color:#dceefa;font-size:14px}.order-panel header span,.order-panel header small{color:#557a92;font:9px Consolas}.order-panel :deep(.el-table){--el-table-bg-color:transparent;--el-table-tr-bg-color:transparent;--el-table-header-bg-color:#0d3553;--el-table-row-hover-bg-color:#124464;--el-table-border-color:#20465f;--el-table-text-color:#b9d2e1;--el-table-header-text-color:#7599af;background:transparent;cursor:pointer}.device{display:flex;flex-direction:column}.device small{color:#408eb8;font:9px Consolas}.device b{margin-top:3px;font-size:11px}
</style>
