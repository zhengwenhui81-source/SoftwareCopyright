<script setup>
import { ref } from 'vue'
defineProps({ events: { type: Array, required: true } })
defineEmits(['confirm', 'close'])
const detailVisible = ref(false)
const selectedEvent = ref(null)
const statusMap = { pending: { label: '待确认', type: 'warning' }, processing: { label: '处理中', type: 'primary' }, recovery_pending: { label: '恢复验证', type: 'success' }, closed: { label: '已关闭', type: 'info' } }
function showDetail(event) { selectedEvent.value = event; detailVisible.value = true }
</script>

<template>
  <section class="event-panel">
    <header><div><i></i><h3>生产异常事件</h3><span>PRODUCTION EXCEPTION EVENTS</span></div><small>工业仿真事件记录 · 不替代报警中心</small></header>
    <el-table :data="events" empty-text="当前批次暂无生产异常事件">
      <el-table-column prop="id" label="事件编号" width="145" /><el-table-column prop="batchId" label="批次" width="150" /><el-table-column prop="process" label="异常工序" width="90" />
      <el-table-column prop="parameter" label="异常参数" width="115" /><el-table-column label="当前值" width="110"><template #default="{ row }"><b class="value">{{ row.currentValue }} {{ row.unit }}</b></template></el-table-column>
      <el-table-column prop="threshold" label="标准范围" min-width="155" /><el-table-column label="风险等级" width="90"><template #default><el-tag type="warning" size="small">警告</el-tag></template></el-table-column>
      <el-table-column label="处理状态" width="90"><template #default="{ row }"><el-tag :type="statusMap[row.status]?.type" size="small" effect="plain">{{ statusMap[row.status]?.label }}</el-tag></template></el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="165" />
      <el-table-column label="操作" width="205" fixed="right"><template #default="{ row }"><el-button text type="primary" size="small" @click="showDetail(row)">查看详情</el-button><el-button v-if="row.status === 'pending'" text type="warning" size="small" @click="$emit('confirm', row.id)">确认事件</el-button><span v-if="row.status === 'recovery_pending'" class="closed">等待报警恢复确认</span><span v-if="row.status === 'closed'" class="closed">处理完成</span></template></el-table-column>
    </el-table>

    <el-dialog v-model="detailVisible" width="620px" title="生产异常事件详情">
      <template v-if="selectedEvent"><div class="detail-head"><div><small>{{ selectedEvent.id }} · {{ selectedEvent.batchId }}</small><h3>{{ selectedEvent.title }}</h3></div><el-tag :type="statusMap[selectedEvent.status]?.type">{{ statusMap[selectedEvent.status]?.label }}</el-tag></div><el-descriptions :column="2" border><el-descriptions-item label="钢种">{{ selectedEvent.steelGrade }}</el-descriptions-item><el-descriptions-item label="异常工序">{{ selectedEvent.process }}</el-descriptions-item><el-descriptions-item label="异常参数">{{ selectedEvent.parameter }}</el-descriptions-item><el-descriptions-item label="当前值">{{ selectedEvent.currentValue }} {{ selectedEvent.unit }}</el-descriptions-item><el-descriptions-item label="标准范围" :span="2">{{ selectedEvent.threshold }}</el-descriptions-item><el-descriptions-item label="异常说明" :span="2">{{ selectedEvent.description }}</el-descriptions-item></el-descriptions><template v-if="selectedEvent.adjustmentRecord"><h4>参数调整记录</h4><el-descriptions :column="2" border><el-descriptions-item label="调整编号">{{ selectedEvent.adjustmentRecord.adjustmentId }}</el-descriptions-item><el-descriptions-item label="执行人员">{{ selectedEvent.adjustmentRecord.operator }}</el-descriptions-item><el-descriptions-item label="调整前">{{ selectedEvent.adjustmentRecord.beforeValue }} {{ selectedEvent.unit }}</el-descriptions-item><el-descriptions-item label="调整后">{{ selectedEvent.adjustmentRecord.afterValue }} {{ selectedEvent.unit }}</el-descriptions-item><el-descriptions-item label="调整原因" :span="2">{{ selectedEvent.adjustmentRecord.reason }}</el-descriptions-item><el-descriptions-item label="参数恢复结果" :span="2">{{ selectedEvent.recovery?.message || '等待验证' }}</el-descriptions-item></el-descriptions></template><div class="suggestion"><h4>处理建议</h4><ul><li v-for="item in selectedEvent.suggestion" :key="item">{{ item }}</li></ul></div></template>
      <template #footer><el-button type="primary" @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.event-panel{margin-top:12px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.event-panel>header{display:flex;align-items:center;justify-content:space-between;height:46px;padding:0 15px;border-bottom:1px solid rgba(55,107,142,.35)}.event-panel header>div{display:flex;align-items:center;gap:8px}.event-panel header i{width:3px;height:16px;background:#ef6262;box-shadow:0 0 8px #ef6262}.event-panel h3{margin:0;font-size:14px}.event-panel header span,.event-panel header small{color:#55798f;font:9px Consolas}.event-panel :deep(.el-table){--el-table-bg-color:transparent;--el-table-tr-bg-color:transparent;--el-table-header-bg-color:#0d3553;--el-table-row-hover-bg-color:#124464;--el-table-border-color:#20465f;--el-table-text-color:#b9d2e1;--el-table-header-text-color:#7599af;background:transparent}.value{color:#ffad45;font:600 11px Consolas}.closed{color:#607f91;font-size:10px}.detail-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:13px 16px;background:#eef5f8}.detail-head small{color:#3786b2;font:9px Consolas}.detail-head h3{margin:4px 0 0;color:#29485b;font-size:16px}.suggestion{margin-top:13px;padding:11px 14px;background:#f4f8fa;border-left:3px solid #e8a03c}.suggestion h4{margin:0 0 7px;color:#435e70;font-size:12px}.suggestion ul{margin:0;padding-left:18px;color:#617b8b;font-size:11px;line-height:1.8}
</style>
