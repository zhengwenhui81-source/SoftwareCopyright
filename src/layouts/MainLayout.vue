<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { getUser, hasRole, logout } from '@/auth'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)
const user = computed(() => getUser())

const menuItems = computed(() =>
  {
    const routes = router
    .getRoutes()
    .filter((item) => item.meta?.icon && hasRole(item.meta.roles))
    const equipmentChildren = routes
      .filter((item) => item.meta.menuGroup === 'equipment')
      .sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0))
    const standaloneItems = routes.filter((item) => !item.meta.menuGroup)
    return [
      ...standaloneItems,
      ...(equipmentChildren.length ? [{ path: 'equipment-group', isGroup: true, meta: { title: '设备管理', icon: 'Setting', order: 3 }, children: equipmentChildren }] : []),
    ].sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0))
  },
)

function handleLogout() {
  logout()
  router.replace('/login')
}
</script>

<template>
  <el-container class="app-shell">
    <el-aside :width="collapsed ? '64px' : '224px'" class="sidebar">
      <div class="brand">
        <div class="brand-mark">P</div>
        <div v-if="!collapsed" class="brand-text">
          <strong>厚板智控</strong>
          <span>PLATE AI</span>
        </div>
      </div>
      <el-menu :default-active="route.path" router :collapse="collapsed" class="side-menu">
        <template v-for="item in menuItems" :key="item.path">
          <el-sub-menu v-if="item.isGroup && item.children.length > 0" :index="item.path">
            <template #title><el-icon><component :is="ElementPlusIconsVue[item.meta.icon]" /></el-icon><span>{{ item.meta.title }}</span></template>
            <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
              <el-icon><component :is="ElementPlusIconsVue[child.meta.icon]" /></el-icon>
              <template #title>{{ child.meta.title }}</template>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="ElementPlusIconsVue[item.meta.icon]" /></el-icon>
            <template #title>{{ item.meta.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div class="topbar-left">
          <el-button text circle class="collapse-btn" @click="collapsed = !collapsed">
            <el-icon size="20"><component :is="collapsed ? ElementPlusIconsVue.Expand : ElementPlusIconsVue.Fold" /></el-icon>
          </el-button>
          <div>
            <h1>基于工业基座大模型的厚板生产全流程运行监控系统</h1>
            <p>{{ route.meta.title }} <span class="demo-badge">DEMO · 工业仿真数据</span></p>
          </div>
        </div>
        <el-dropdown trigger="click">
          <div class="user-box">
            <el-avatar :size="34">{{ user?.username?.slice(0, 1).toUpperCase() }}</el-avatar>
            <div class="user-info">
              <strong>{{ user?.username }}</strong>
              <span>{{ user?.roleName }}</span>
            </div>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="content"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-shell { min-height: 100vh; }
.sidebar { background: #10243e; transition: width .25s; overflow: hidden; }
.brand { height: 72px; display: flex; align-items: center; gap: 11px; padding: 0 14px; color: white; border-bottom: 1px solid rgba(255,255,255,.08); }
.brand-mark { width: 36px; height: 36px; flex: 0 0 36px; display: grid; place-items: center; border-radius: 9px; background: linear-gradient(135deg,#2b8cff,#41c7b7); font-weight: 800; font-size: 20px; }
.brand-text { display: flex; flex-direction: column; white-space: nowrap; }
.brand-text strong { font-size: 17px; letter-spacing: 2px; }
.brand-text span { font-size: 9px; color: #7fa1c7; letter-spacing: 3px; }
.side-menu { border-right: 0; background: transparent; padding-top: 12px; }
.side-menu :deep(.el-menu-item) { color: #a9bad0; margin: 5px 8px; border-radius: 6px; height: 48px; }
.side-menu :deep(.el-menu-item:hover) { background: #183a60; color: white; }
.side-menu :deep(.el-menu-item.is-active) { background: #1768c4; color: white; }
.side-menu :deep(.el-sub-menu__title) { color: #a9bad0; margin: 5px 8px; border-radius: 6px; height: 48px; }
.side-menu :deep(.el-sub-menu__title:hover) { background: #183a60; color: white; }
.side-menu :deep(.el-sub-menu .el-menu) { background: #0c1e34; }
.side-menu :deep(.el-sub-menu .el-menu-item) { min-width: auto; padding-left: 48px!important; height: 42px; }
.topbar { height: 72px; background: white; border-bottom: 1px solid #e5eaf0; display: flex; align-items: center; justify-content: space-between; padding: 0 24px 0 14px; }
.topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.topbar h1 { margin: 0; color: #1b2b42; font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar p { margin: 4px 0 0; color: #8492a6; font-size: 12px; }
.demo-badge { display: inline-block; margin-left: 8px; padding: 1px 6px; color: #1684bd; background: #e9f6fc; border: 1px solid #b9e2f5; border-radius: 2px; font-size: 9px; letter-spacing: 1px; }
.user-box { display: flex; align-items: center; gap: 9px; cursor: pointer; outline: none; }
.user-info { display: flex; flex-direction: column; min-width: 65px; }
.user-info strong { font-size: 13px; color: #27364b; }
.user-info span { font-size: 11px; color: #8a97a8; }
.content { background: #071d30; padding: 18px; }
@media (max-width: 900px) { .topbar h1 { max-width: 45vw; } .user-info { display: none; } }
</style>
