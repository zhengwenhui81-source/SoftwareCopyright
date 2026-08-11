<script setup>
defineProps({ events: { type: Array, required: true } })
defineEmits(['status-change'])
const levelMap = { high: { label: '高风险', type: 'danger' }, medium: { label: '中风险', type: 'warning' }, low: { label: '低风险', type: 'success' } }
const statusMap = { pending: { label: '待处理', type: 'warning' }, confirmed: { label: '已确认', type: 'primary' }, closed: { label: '已关闭', type: 'info' } }
</script>

<template>
  <section class="event-panel">
    <header><div><i></i><h3>设备风险事件记录</h3><span>EQUIPMENT RISK EVENTS</span></div><small>故障预测演示 · 基于工业仿真数据</small></header>
    <el-table :data="events" empty-text="暂无设备风险事件">
      <el-table-column prop="id" label="事件编号" width="135" />
      <el-table-column label="设备" min-width="160"><template #default="{ row }"><div class="device"><small>{{ row.equipmentId }}</small><b>{{ row.equipmentName }}</b></div></template></el-table-column>
      <el-table-column prop="source" label="来源" width="90" />
      <el-table-column label="风险等级" width="90"><template #default="{ row }"><el-tag :type="levelMap[row.level]?.type" size="small">{{ levelMap[row.level]?.label || '中风险' }}</el-tag></template></el-table-column>
      <el-table-column prop="typeLabel" label="异常类型" min-width="130" />
      <el-table-column prop="createTime" label="创建时间" width="160" />
      <el-table-column label="当前状态" width="90"><template #default="{ row }"><el-tag :type="statusMap[row.status]?.type" size="small" effect="plain">{{ statusMap[row.status]?.label || '待处理' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><el-button v-if="row.status === 'pending'" text type="primary" size="small" @click="$emit('status-change', row.id, 'confirmed')">确认事件</el-button><el-button v-if="row.status !== 'closed'" text type="danger" size="small" @click="$emit('status-change', row.id, 'closed')">关闭事件</el-button><span v-else class="closed">事件已关闭</span></template></el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.event-panel{background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.event-panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;padding:0 14px;border-bottom:1px solid rgba(55,107,142,.35)}.event-panel header>div{display:flex;align-items:center;gap:8px}.event-panel header i{width:3px;height:15px;background:#ffad45;box-shadow:0 0 8px #ffad45}.event-panel header h3{margin:0;color:#dceefa;font-size:14px}.event-panel header span,.event-panel header small{color:#557a92;font:9px Consolas}.event-panel :deep(.el-table){--el-table-bg-color:transparent;--el-table-tr-bg-color:transparent;--el-table-header-bg-color:#0d3553;--el-table-row-hover-bg-color:#124464;--el-table-border-color:#20465f;--el-table-text-color:#b9d2e1;--el-table-header-text-color:#7599af;background:transparent}.device{display:flex;flex-direction:column}.device small{color:#408eb8;font:9px Consolas}.device b{margin-top:3px;font-size:11px}.closed{color:#617f91;font-size:10px}
</style>
