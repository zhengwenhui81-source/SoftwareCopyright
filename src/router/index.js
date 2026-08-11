import { createRouter, createWebHashHistory } from 'vue-router'
import { getUser, hasRole } from '@/auth'

const allRoles = ['admin', 'engineer', 'operator']

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '系统登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '运行总览', icon: 'DataBoard', order: 1, roles: allRoles } },
      { path: 'production', name: 'Production', component: () => import('@/views/Production.vue'), meta: { title: '生产监控', icon: 'TrendCharts', order: 2, roles: ['admin', 'operator'] } },
      { path: 'equipment', name: 'Equipment', component: () => import('@/views/Equipment.vue'), meta: { title: '设备总览', icon: 'Monitor', order: 3, menuGroup: 'equipment', roles: ['admin', 'engineer'] } },
      { path: 'equipment-health', name: 'EquipmentHealth', component: () => import('@/views/EquipmentHealth.vue'), meta: { title: '健康诊断', icon: 'FirstAidKit', order: 3.1, menuGroup: 'equipment', roles: ['admin', 'engineer'] } },
      { path: 'equipment-prediction', name: 'EquipmentPrediction', component: () => import('@/views/EquipmentPrediction.vue'), meta: { title: '故障预测', icon: 'Warning', order: 3.2, menuGroup: 'equipment', roles: ['admin', 'engineer'] } },
      { path: 'maintenance', name: 'Maintenance', component: () => import('@/views/Maintenance.vue'), meta: { title: '维护管理', icon: 'Tools', order: 3.3, menuGroup: 'equipment', roles: ['admin', 'engineer'] } },
      { path: 'quality', name: 'Quality', component: () => import('@/views/Quality.vue'), meta: { title: '质量管理', icon: 'CircleCheck', order: 4, roles: ['admin', 'engineer'] } },
      { path: 'alarm', name: 'Alarm', component: () => import('@/views/Alarm.vue'), meta: { title: '报警中心', icon: 'Bell', order: 5, roles: ['admin'] } },
      { path: 'decision', name: 'Decision', component: () => import('@/views/Decision.vue'), meta: { title: '智能决策', icon: 'Opportunity', order: 6, roles: ['admin', 'engineer'] } },
      { path: 'knowledge-graph', name: 'KnowledgeGraph', component: () => import('@/views/KnowledgeGraph.vue'), meta: { title: '工业本体知识图谱', icon: 'Share', order: 7, roles: ['admin'] } },
      { path: 'ai-chat', name: 'AIChat', component: () => import('@/views/AIChat.vue'), meta: { title: '工业大模型助手', icon: 'ChatDotRound', order: 8, roles: ['admin'] } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const user = getUser()
  document.title = `${to.meta.title || '运行监控'} - 厚板生产监控系统`

  if (!to.meta.public && !user) return { name: 'Login', query: { redirect: to.fullPath } }
  if (to.name === 'Login' && user) return { name: 'Dashboard' }
  if (to.meta.roles && !hasRole(to.meta.roles)) return { name: 'Dashboard' }
  return true
})

export default router
