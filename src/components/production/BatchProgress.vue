<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ batch: { type: Object, required: true }, processes: { type: Array, required: true } })
const detailVisible = ref(false)
const completed = computed(() => props.processes.filter((item) => item.status === 'completed'))
const currentIndex = computed(() => props.processes.findIndex((item) => ['running', 'abnormal'].includes(item.status)))
const nextProcess = computed(() => props.processes[currentIndex.value + 1]?.name || '无')
const statusLabel = computed(() => ({ running: '生产中', completed: '已完成', paused: '已暂停' }[props.batch.processStatus] || '生产中'))
</script>

<template>
  <section class="batch-card" @click="detailVisible = true">
    <div class="identity"><span>当前生产批次</span><strong>{{ batch.batchId }}</strong><small>点击查看批次详情</small></div>
    <dl><div><dt>当前工序</dt><dd>{{ batch.currentProcess }}</dd></div><div><dt>钢种</dt><dd>{{ batch.steelGrade }}</dd></div><div><dt>规格</dt><dd>{{ batch.specification }}</dd></div><div><dt>开工时间</dt><dd>{{ batch.startTime }}</dd></div><div><dt>操作人员</dt><dd>{{ batch.operators }}</dd></div></dl>
    <div class="progress"><div><span>批次生产进度</span><b>{{ batch.progress }}%</b></div><el-progress :percentage="batch.progress" :show-text="false" :stroke-width="7" /></div>

    <el-dialog v-model="detailVisible" width="620px" title="生产批次详情" @click.stop>
      <div class="detail-head"><div><small>{{ batch.planId }}</small><h3>{{ batch.batchId }}</h3></div><el-tag type="success" effect="dark">{{ statusLabel }}</el-tag></div>
      <el-descriptions :column="2" border><el-descriptions-item label="钢种">{{ batch.steelGrade }}</el-descriptions-item><el-descriptions-item label="产品规格">{{ batch.specification }}</el-descriptions-item><el-descriptions-item label="当前工序">{{ batch.currentProcess }}</el-descriptions-item><el-descriptions-item label="下一工序">{{ nextProcess }}</el-descriptions-item><el-descriptions-item label="已完成工序">{{ completed.length }}/{{ processes.length }}</el-descriptions-item><el-descriptions-item label="生产状态">{{ statusLabel }}</el-descriptions-item><el-descriptions-item label="操作人员">{{ batch.operators }}</el-descriptions-item><el-descriptions-item label="开工时间">{{ batch.startTime }}</el-descriptions-item></el-descriptions>
      <div class="completed-list"><h4>已完成工序</h4><el-tag v-for="item in completed" :key="item.id" type="success" effect="plain">{{ item.name }}</el-tag><span v-if="!completed.length">暂无已完成工序</span></div>
      <template #footer><el-button type="primary" @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.batch-card{display:grid;grid-template-columns:220px 1fr 210px;align-items:center;gap:20px;padding:14px 18px;cursor:pointer;background:#092840;border:1px solid #1e4865;transition:.2s}.batch-card:hover{border-color:#2b8ebd;background:#0b304b}.identity{display:flex;flex-direction:column}.identity span{color:#7898af;font-size:10px}.identity strong{margin-top:4px;color:#50c5ff;font:600 17px Consolas}.identity small{margin-top:3px;color:#527a92;font-size:8px}.batch-card dl{display:grid;grid-template-columns:repeat(5,1fr);margin:0}.batch-card dl>div{padding:0 12px;border-left:1px solid #244d68}.batch-card dt{color:#6689a2;font-size:9px}.batch-card dd{margin:5px 0 0;color:#d4e6f2;font-size:11px;white-space:nowrap}.progress>div{display:flex;justify-content:space-between;margin-bottom:7px;color:#7999af;font-size:10px}.progress b{color:#48bdf4;font:600 14px Consolas}.detail-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:13px 16px;background:#eef5f8}.detail-head small{color:#3786b2;font:9px Consolas}.detail-head h3{margin:4px 0 0;color:#29485b;font-size:17px}.completed-list{margin-top:14px;padding:12px;background:#f4f8fa}.completed-list h4{margin:0 0 8px;color:#415c6e;font-size:12px}.completed-list .el-tag{margin-right:7px}@media(max-width:1100px){.batch-card{grid-template-columns:200px 1fr}.progress{grid-column:1/-1}.batch-card dl{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.batch-card{grid-template-columns:1fr}.batch-card dl{grid-template-columns:repeat(2,1fr)}}
</style>
