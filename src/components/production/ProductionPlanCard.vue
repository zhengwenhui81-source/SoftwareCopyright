<script setup>
import { computed } from 'vue'
const props = defineProps({ plan: { type: Object, required: true } })
const progress = computed(() => Math.round((props.plan.completed / props.plan.quantity) * 100))
</script>

<template>
  <section class="plan-card">
    <header><div><i></i><h3>生产计划概览</h3><span>PRODUCTION PLAN</span></div><el-tag type="primary" effect="dark">{{ plan.status }}</el-tag></header>
    <div class="plan-content">
      <div class="order"><small>当前订单</small><strong>{{ plan.orderNo }}</strong><span>{{ plan.id }}</span></div>
      <dl><div><dt>钢种</dt><dd>{{ plan.steelGrade }}</dd></div><div><dt>产品规格</dt><dd>{{ plan.specification }}</dd></div><div><dt>计划数量</dt><dd>{{ plan.quantity }} 块</dd></div><div><dt>已完成数量</dt><dd>{{ plan.completed }} 块</dd></div><div><dt>交付日期</dt><dd>{{ plan.deliveryDate }}</dd></div><div><dt>客户</dt><dd>{{ plan.customer }}</dd></div></dl>
      <div class="progress"><div><span>订单执行进度</span><b>{{ progress }}%</b></div><el-progress :percentage="progress" :show-text="false" :stroke-width="7" /></div>
    </div>
  </section>
</template>

<style scoped>
.plan-card{background:linear-gradient(90deg,#0e3756,#0b2b46);border:1px solid #235372}.plan-card>header{display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 16px;border-bottom:1px solid rgba(55,107,142,.35)}.plan-card header>div{display:flex;align-items:center;gap:8px}.plan-card header i{width:3px;height:15px;background:#2cb9ed}.plan-card h3{margin:0;font-size:13px}.plan-card header span{color:#49748e;font:9px Consolas}.plan-content{display:grid;grid-template-columns:210px 1fr 190px;align-items:center;gap:20px;padding:13px 18px}.order{display:flex;flex-direction:column}.order small{color:#7898af;font-size:10px}.order strong{margin-top:4px;color:#50c5ff;font:600 17px Consolas}.order span{margin-top:3px;color:#527a92;font:9px Consolas}.plan-content dl{display:grid;grid-template-columns:repeat(6,1fr);margin:0}.plan-content dl>div{padding:0 12px;border-left:1px solid #244d68}.plan-content dt{color:#6689a2;font-size:9px}.plan-content dd{margin:5px 0 0;color:#d4e6f2;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.progress>div{display:flex;justify-content:space-between;margin-bottom:7px;color:#7999af;font-size:10px}.progress b{color:#48bdf4;font:600 14px Consolas}@media(max-width:1200px){.plan-content{grid-template-columns:190px 1fr}.progress{grid-column:1/-1}.plan-content dl{grid-template-columns:repeat(3,1fr);gap:10px}}@media(max-width:700px){.plan-content{grid-template-columns:1fr}.plan-content dl{grid-template-columns:repeat(2,1fr)}}
</style>
