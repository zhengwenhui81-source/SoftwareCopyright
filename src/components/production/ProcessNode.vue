<script setup>
import { computed } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import { statusMeta } from '@/mock/production'

const props = defineProps({ process: { type: Object, required: true }, index: { type: Number, required: true }, last: Boolean })
defineEmits(['select'])
const displayStatus = computed(() => props.process.alarmDetail ? 'abnormal' : props.process.status)
</script>

<template>
  <div class="process-step" :class="[`is-${displayStatus}`, { 'is-last': last }]">
    <button class="process-node" type="button" @click="$emit('select', process)">
      <span class="sequence">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="node-icon"><el-icon><component :is="Icons[process.icon]" /></el-icon></span>
      <span class="node-content">
        <span class="node-title"><strong>{{ process.name }}</strong><el-tag :type="statusMeta[displayStatus].type" size="small" effect="dark">{{ statusMeta[displayStatus].label }}</el-tag></span>
        <span v-for="parameter in process.parameters" :key="parameter.name" class="parameter"><em>{{ parameter.name }}</em><b>{{ parameter.value }}{{ parameter.unit }}</b></span>
      </span>
      <span v-if="process.alarmDetail" class="alarm-parameter"><em>异常参数：{{ process.alarmDetail.parameter }}</em><b>{{ process.alarmDetail.value }} / 阈值 {{ process.alarmDetail.threshold }}</b></span>
      <span v-if="process.status === 'running'" class="progress"><i :style="{ width: `${process.progress}%` }"></i></span>
      <span class="detail-hint">点击查看详情 <el-icon><ArrowRight /></el-icon></span>
    </button>
    <div v-if="!last" class="flow-arrow"><span></span><el-icon><ArrowRightBold /></el-icon></div>
  </div>
</template>

<style scoped>
.process-step{position:relative;min-width:0}.process-node{position:relative;width:100%;height:224px;padding:20px 16px 14px;color:#d8e9f7;text-align:left;cursor:pointer;overflow:hidden;background:linear-gradient(145deg,#0d3453,#092840);border:1px solid #285473;transition:.25s}.process-node:hover{transform:translateY(-3px);border-color:#35a9e9;box-shadow:0 10px 24px rgba(0,12,24,.35),inset 0 0 25px rgba(42,157,219,.08)}.sequence{position:absolute;right:12px;top:8px;color:#315d79;font:700 28px Consolas}.node-icon{width:46px;height:46px;display:grid;place-items:center;margin-bottom:14px;font-size:25px;color:#48aee9;background:rgba(45,153,216,.12);border:1px solid #28688d;transform:rotate(45deg)}.node-icon .el-icon{transform:rotate(-45deg)}.node-content{display:flex;flex-direction:column;gap:7px}.node-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}.node-title strong{font-size:16px;color:#eef9ff}.parameter{display:flex;justify-content:space-between;color:#7f9db3;font-size:12px}.parameter em{font-style:normal}.parameter b{color:#bcd9ea;font:600 12px Consolas,"Microsoft YaHei"}.detail-hint{position:absolute;left:16px;right:16px;bottom:11px;display:flex;align-items:center;justify-content:flex-end;color:#467897;font-size:10px}.progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:#173b53}.progress i{display:block;height:100%;background:#2dcdf1;box-shadow:0 0 8px #2dcdf1}.flow-arrow{position:absolute;z-index:2;left:calc(100% + 1px);top:104px;width:18px;display:flex;align-items:center;color:#3b9fcf}.flow-arrow span{width:10px;height:1px;background:#3b9fcf}.is-completed .process-node{border-top:2px solid #29c88d}.is-completed .node-icon{color:#2fd89a;border-color:#237d68;background:rgba(42,206,149,.1)}.is-running .process-node{border:1px solid #26bbe8;box-shadow:inset 0 0 28px rgba(30,170,224,.12),0 0 12px rgba(25,164,218,.12)}.is-running .node-icon{animation:glow 1.8s infinite}.is-abnormal .process-node{border:1px solid #e85454;box-shadow:inset 0 0 25px rgba(232,84,84,.12)}.is-abnormal .node-icon{color:#ff6767;border-color:#b74646;background:rgba(232,84,84,.12)}.is-waiting{opacity:.68}@keyframes glow{50%{box-shadow:0 0 17px rgba(39,191,233,.4)}}@media(max-width:1100px){.flow-arrow{display:none}}
.alarm-parameter{display:flex;flex-direction:column;gap:3px;padding:6px 8px;margin-top:7px;color:#ff9a9a;background:rgba(211,52,52,.12);border-left:2px solid #ef5a5a;font-size:9px}.alarm-parameter em{font-style:normal}.alarm-parameter b{color:#ffd2d2;font:9px Consolas,"Microsoft YaHei";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
