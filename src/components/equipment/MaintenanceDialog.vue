<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({ modelValue: Boolean, order: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue', 'advance'])
const owner = ref('')
watch(() => props.order, (value) => { owner.value = value?.owner === '未指派' ? '' : value?.owner || '' }, { immediate: true })
const statusMap = { pending: '待确认', scheduled: '已安排', in_progress: '执行中', completed: '已完成' }
const actionMap = { pending: '确认并安排', scheduled: '开始执行', in_progress: '完成维护' }
const risk = computed(() => props.order?.riskParameter || {})
</script>

<template>
  <el-dialog :model-value="modelValue" width="720px" title="预测维护工单详情" @update:model-value="emit('update:modelValue', $event)">
    <template v-if="order">
      <div class="dialog-head"><div><small>{{ order.id }} · 来源 {{ order.eventId }}</small><h3>{{ order.equipmentName }}</h3><p>{{ order.component }}</p></div><el-tag size="large" :type="order.status === 'completed' ? 'success' : 'warning'">{{ statusMap[order.status] }}</el-tag></div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="维护类型">{{ order.type }}</el-descriptions-item><el-descriptions-item label="建议时限">{{ order.suggestedTime }}</el-descriptions-item>
        <el-descriptions-item label="异常原因" :span="2">{{ order.reason }}</el-descriptions-item>
        <el-descriptions-item label="风险参数">{{ risk.name }}</el-descriptions-item><el-descriptions-item label="当前值 / 阈值">{{ risk.currentValue }} {{ risk.unit }} / {{ risk.threshold }} {{ risk.unit }}</el-descriptions-item>
        <el-descriptions-item label="预测故障" :span="2">{{ order.predictedFailure }}</el-descriptions-item>
        <el-descriptions-item label="负责人" :span="2"><el-input v-model="owner" :disabled="order.status === 'completed'" placeholder="请输入维护负责人；未填写则保持未指派" /></el-descriptions-item>
      </el-descriptions>
      <div class="measures"><h4>建议措施</h4><ul><li v-for="item in order.measures" :key="item">{{ item }}</li></ul></div>
      <div v-if="order.recovery" class="recovery"><h4>维护完成 · 健康恢复模拟</h4><div><span>健康评分 <b>{{ order.recovery.beforeHealth }}</b><i>→</i><strong>{{ order.recovery.afterHealth }}</strong></span><span>故障概率 <b>{{ order.recovery.beforeProbability }}%</b><i>→</i><strong>{{ order.recovery.afterProbability }}%</strong></span><span>风险等级 <strong>{{ order.recovery.riskLevel }}</strong></span></div><p>{{ order.recovery.description }}</p></div>
      <p class="demo-note">预测维护演示 · 基于工业仿真数据；恢复结果不修改真实设备数据。</p>
    </template>
    <template #footer><el-button @click="emit('update:modelValue', false)">关闭</el-button><el-button v-if="order && order.status !== 'completed'" type="primary" @click="emit('advance', order, owner)">{{ actionMap[order.status] }}</el-button></template>
  </el-dialog>
</template>

<style scoped>
.dialog-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;padding:14px 18px;background:#eef5f8}.dialog-head small{color:#2785b4;font:10px Consolas}.dialog-head h3{margin:4px 0;color:#29485b;font-size:17px}.dialog-head p{margin:0;color:#788e9c;font-size:10px}.measures{margin-top:12px;padding:11px 14px;background:#f4f8fa;border-left:3px solid #318bb6}.measures h4,.recovery h4{margin:0 0 7px;color:#34566a;font-size:12px}.measures ul{margin:0;padding-left:18px;color:#607b8b;font-size:11px;line-height:1.8}.recovery{margin-top:12px;padding:12px 14px;background:#edf9f5;border:1px solid #b9e3d4}.recovery>div{display:flex;gap:30px}.recovery span{color:#668175;font-size:10px}.recovery b{margin-left:5px;color:#8b9b94;font:600 15px Consolas}.recovery i{margin:0 7px;color:#37a681}.recovery strong{color:#20a77b;font:600 18px Consolas}.recovery p{margin:7px 0 0;color:#6b897c;font-size:10px}.demo-note{margin:10px 0 0;color:#8a9ba5;text-align:right;font-size:9px}
</style>
