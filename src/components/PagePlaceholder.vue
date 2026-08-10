<script setup>
defineProps({ title: { type: String, required: true }, description: { type: String, default: '业务功能将在后续开发阶段逐步完善' }, icon: { type: String, default: 'Monitor' } })
</script>

<template>
  <div class="page-wrap">
    <div class="page-heading"><h2>{{ title }}</h2><p>{{ description }}</p></div>
    <el-card class="placeholder" shadow="never">
      <el-empty :description="`${title}模块待开发`">
        <template #image><el-icon :size="76" color="#aab8c7"><component :is="icon" /></el-icon></template>
        <el-tag type="info" effect="plain">第一阶段 · 基础框架</el-tag>
      </el-empty>
    </el-card>
  </div>
</template>

<style scoped>
.page-heading { margin-bottom: 18px; }
.page-heading h2 { margin: 0 0 7px; font-size: 21px; color: #25364d; }
.page-heading p { margin: 0; font-size: 13px; color: #8997a8; }
.placeholder { min-height: calc(100vh - 175px); display: grid; place-items: center; border: 1px solid #e5eaf0; }
</style>
