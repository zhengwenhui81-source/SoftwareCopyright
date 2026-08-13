import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { initializeBusinessAlarmSync } from './alarmEvent'
import './styles/index.css'

initializeBusinessAlarmSync()
createApp(App).use(router).use(ElementPlus).mount('#app')
