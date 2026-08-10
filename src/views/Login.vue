<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { login } from '@/auth'

const router = useRouter()
const route = useRoute()
const formRef = ref()
const loading = ref(false)
const form = reactive({ username: 'admin', password: '123456', role: 'admin' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择用户角色', trigger: 'change' }],
}

async function submit() {
  await formRef.value.validate()
  loading.value = true
  setTimeout(() => {
    login(form.username, form.role)
    ElMessage.success('登录成功')
    router.replace(String(route.query.redirect || '/dashboard'))
    loading.value = false
  }, 350)
}
</script>

<template>
  <div class="login-page">
    <div class="industrial-grid"></div>
    <section class="intro">
      <div class="system-tag">INDUSTRIAL FOUNDATION MODEL</div>
      <h1>厚板生产全流程<br /><em>运行监控系统</em></h1>
      <p>融合工业基座大模型能力，构建生产、设备、质量、报警与决策一体化智能管控平台。</p>
      <div class="features">
        <span>全流程感知</span><i></i><span>智能化分析</span><i></i><span>实时性决策</span>
      </div>
    </section>

    <el-card class="login-card" shadow="always">
      <template #header>
        <div class="login-title"><span>用户登录</span><small>欢迎进入厚板智控平台</small></div>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="submit">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" size="large" placeholder="请输入用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" size="large" type="password" show-password placeholder="请输入密码" prefix-icon="Lock" />
        </el-form-item>
        <el-form-item label="登录角色" prop="role">
          <el-select v-model="form.role" size="large" style="width: 100%">
            <el-option label="管理员" value="admin" />
            <el-option label="工程师" value="engineer" />
            <el-option label="操作员" value="operator" />
          </el-select>
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="submit">登 录</el-button>
      </el-form>
      <p class="hint">演示环境：输入任意用户名和密码即可登录</p>
    </el-card>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-around; gap: 60px; padding: 40px 8vw; background: radial-gradient(circle at 18% 20%,#17466d 0,transparent 32%),linear-gradient(135deg,#07182b,#0d2c49 58%,#10223a); }
.industrial-grid { position: absolute; inset: 0; opacity: .1; background-image: linear-gradient(#69b6ef 1px,transparent 1px),linear-gradient(90deg,#69b6ef 1px,transparent 1px); background-size: 48px 48px; transform: perspective(500px) rotateX(55deg) scale(1.8); transform-origin: bottom; }
.intro { position: relative; color: white; max-width: 620px; z-index: 1; }
.system-tag { display: inline-block; padding: 7px 12px; color: #70ccff; border: 1px solid #347da7; border-radius: 3px; font-size: 11px; letter-spacing: 2px; }
.intro h1 { font-size: clamp(40px,4vw,64px); line-height: 1.25; letter-spacing: 3px; margin: 24px 0; }
.intro h1 em { color: #53b9ff; font-style: normal; }
.intro p { max-width: 530px; color: #a9c0d6; font-size: 16px; line-height: 1.9; }
.features { display: flex; align-items: center; gap: 14px; color: #d2e3f1; font-size: 13px; margin-top: 30px; }
.features i { width: 4px; height: 4px; background: #48b9ef; border-radius: 50%; }
.login-card { position: relative; z-index: 1; width: 390px; border: 0; border-radius: 10px; }
.login-card :deep(.el-card__header) { padding: 28px 30px 18px; border: 0; }
.login-card :deep(.el-card__body) { padding: 5px 30px 28px; }
.login-title { display: flex; flex-direction: column; gap: 7px; }
.login-title span { font-size: 24px; font-weight: 700; color: #172a42; }
.login-title small { color: #8996a7; }
.login-btn { width: 100%; margin-top: 8px; letter-spacing: 8px; }
.hint { text-align: center; color: #a2acb8; font-size: 12px; margin: 18px 0 0; }
@media (max-width: 850px) { .intro { display: none; } .login-page { padding: 20px; } .login-card { width: min(390px,100%); } }
</style>
