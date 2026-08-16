<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChatLineRound, Cpu, Plus, Promotion, Refresh, Right, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { answerIndustrialQuestion, buildIndustrialAssistantContext, getSuggestedIndustrialQuestions } from '@/industrialAssistant'
import { conversations, initialMessages } from '@/mock/chat'

const CHAT_STORAGE_KEY = 'thick_plate_industrial_assistant_messages'
const router = useRouter()
const input = ref('')
const loading = ref(false)
const chatBody = ref()
const activeConversation = ref(1)
const contextSnapshot = ref(buildIndustrialAssistantContext())
const quickQuestions = getSuggestedIndustrialQuestions()

function readMessages() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) || '[]')
    if (Array.isArray(saved) && saved.length) return saved.map((item) => ({ evidence: [], navigation: [], ...item }))
  } catch { /* 使用初始会话 */ }
  return initialMessages.map((item) => ({ evidence: [], navigation: [], ...item }))
}
const messages = ref(readMessages())
const currentBatchId = computed(() => contextSnapshot.value.production.batch?.batchId || '暂无当前批次')
watch(messages, (value) => window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(value)), { deep: true })

function currentTime() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function scrollBottom() { nextTick(() => { if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight }) }
function appendAssistantReply(question) {
  const reply = answerIndustrialQuestion(question)
  contextSnapshot.value = buildIndustrialAssistantContext()
  messages.value.push({ ...reply, id: Date.now() + 1, time: currentTime() })
}
async function sendMessage(text = input.value) {
  const content = String(text || '').trim()
  if (!content || loading.value) return
  messages.value.push({ id: Date.now(), role: 'user', time: currentTime(), content, evidence: [], navigation: [] })
  input.value = ''
  loading.value = true
  scrollBottom()
  try { await Promise.resolve(); appendAssistantReply(content) } finally { loading.value = false; scrollBottom() }
}
function refreshBusinessState() {
  const latestQuestion = [...messages.value].reverse().find((item) => item.role === 'user')?.content
  contextSnapshot.value = buildIndustrialAssistantContext()
  if (latestQuestion) appendAssistantReply(latestQuestion)
  ElMessage.success(latestQuestion ? '已基于最新工业仿真状态重新分析' : '已刷新工业仿真业务状态')
  scrollBottom()
}
function newChat() {
  messages.value = initialMessages.map((item) => ({ ...item, id: Date.now(), evidence: [], navigation: [] }))
  activeConversation.value = 0
  ElMessage.success('已创建新会话')
}
function navigateTo(item) { if (item?.path) router.push(item.path) }
</script>
<template>
  <div class="chat-page">
    <section class="page-header"><div><p>INDUSTRIAL FOUNDATION MODEL ASSISTANT</p><h2>工业大模型助手</h2></div><div class="model"><i></i><b>工业大模型助手演示</b><span>基于工业仿真数据与规则推理</span></div></section>
    <section class="chat-shell">
      <aside><el-button type="primary" class="new-chat" @click="newChat"><el-icon><Plus /></el-icon>新建工业会话</el-button><h4>最近会话</h4><button v-for="item in conversations" :key="item.id" :class="{ active: activeConversation === item.id }" @click="activeConversation = item.id"><el-icon><ChatLineRound /></el-icon><span><b>{{ item.title }}</b><small>{{ item.time }}</small></span></button><div class="data-source"><h4>工业仿真数据</h4><span><i></i>生产业务事实</span><span><i></i>设备健康与维护</span><span><i></i>质量检测与复检</span><span><i></i>统一报警与规则决策</span></div></aside>
      <main>
        <header><div class="bot-avatar"><el-icon><Cpu /></el-icon></div><div><h3>厚板工业智能助手</h3><span><i></i>只读分析 · 规则推理 · 证据可追溯</span></div><el-tag type="primary" effect="plain">模拟批次 {{ currentBatchId }}</el-tag><el-button size="small" :icon="Refresh" @click="refreshBusinessState">刷新业务状态</el-button></header>
        <div ref="chatBody" class="chat-body">
          <div v-for="message in messages" :key="message.id" class="message" :class="message.role">
            <div class="avatar"><el-icon><User v-if="message.role === 'user'" /><Cpu v-else /></el-icon></div>
            <div class="bubble"><div class="message-head"><b>{{ message.role === 'user' ? '当前用户' : '工业大模型助手' }}</b><span>{{ message.time }}</span></div><p>{{ message.content }}</p>
              <el-collapse v-if="message.evidence?.length" class="evidence-collapse"><el-collapse-item title="分析依据"><div v-for="item in message.evidence" :key="`${item.type}-${item.id}-${item.label}`" class="evidence-item"><span>{{ item.type }}</span><b>{{ item.id }}</b><em>{{ item.label }}：{{ item.value }}</em></div></el-collapse-item></el-collapse>
              <footer v-if="message.navigation?.length"><button v-for="item in message.navigation" :key="item.path" @click="navigateTo(item)"><el-icon><Right /></el-icon>{{ item.label }}</button></footer>
            </div>
          </div>
          <div v-if="loading" class="message assistant"><div class="avatar"><el-icon><Cpu /></el-icon></div><div class="bubble typing"><i></i><i></i><i></i><span>正在读取最新工业仿真业务状态</span></div></div>
        </div>
        <div class="composer"><div class="quick"><span>推荐问题</span><button v-for="item in quickQuestions" :key="item" @click="sendMessage(item)">{{ item }}</button></div><div class="input-box"><el-input v-model="input" type="textarea" :rows="2" resize="none" maxlength="500" placeholder="请输入生产、设备、质量或报警问题，Enter 发送" @keydown.enter.exact.prevent="sendMessage()" /><el-button type="primary" :loading="loading" @click="sendMessage()"><el-icon><Promotion /></el-icon>发送</el-button></div><p>工业大模型助手演示 · 基于工业仿真数据与规则推理 · 未接入外部模型 API</p></div>
      </main>
    </section>
  </div>
</template>
<style scoped>
.chat-page{height:calc(100vh - 108px);min-height:660px;color:#dcecf7}.page-header{height:54px;display:flex;justify-content:space-between;align-items:flex-start}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.model{display:flex;align-items:center;gap:8px;color:#668aa2;font-size:9px}.model i{width:7px;height:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.model b{color:#47b9e8;font:11px Consolas}.chat-shell{height:calc(100% - 54px);display:grid;grid-template-columns:240px 1fr;background:#081f34;border:1px solid #204c6c}.chat-shell>aside{display:flex;flex-direction:column;padding:13px;background:#09263e;border-right:1px solid #204c6c}.new-chat{width:100%}.chat-shell aside h4{margin:18px 5px 8px;color:#54778e;font-size:9px;font-weight:400}.chat-shell aside>button:not(.new-chat){display:flex;align-items:center;gap:9px;width:100%;padding:10px;color:#7090a6;text-align:left;cursor:pointer;background:transparent;border:1px solid transparent}.chat-shell aside>button.active,.chat-shell aside>button:hover{color:#b8d2e1;background:#0e3855;border-color:#215471}.chat-shell aside>button span{display:flex;flex-direction:column;min-width:0;flex:1}.chat-shell aside>button b{font-size:10px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-shell aside>button small{margin-top:3px;color:#4c7088;font-size:8px}.data-source{margin-top:auto;padding:10px;background:#071f33;border:1px solid #173f59}.data-source h4{margin:0 0 8px!important}.data-source span{display:block;margin:6px 0;color:#678aa1;font-size:9px}.data-source i{display:inline-block;width:5px;height:5px;margin-right:7px;border-radius:50%;background:#2bc995}.chat-shell main{display:grid;grid-template-rows:62px 1fr auto;min-width:0;overflow:hidden}.chat-shell main>header{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#0b2b45;border-bottom:1px solid #204c6c}.bot-avatar,.avatar{display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#258fd0,#31c6be)}.bot-avatar{width:39px;height:39px;font-size:21px}.chat-shell main>header>div:nth-child(2){flex:1}.chat-shell main>header h3{margin:0;color:#d9eaf5;font-size:13px}.chat-shell main>header span{color:#5b8097;font-size:9px}.chat-shell main>header span i{display:inline-block;width:5px;height:5px;margin-right:5px;border-radius:50%;background:#2bd398}.chat-body{overflow:auto;padding:20px}.message{display:flex;gap:10px;max-width:860px;margin:0 auto 18px}.message.user{flex-direction:row-reverse}.avatar{width:31px;height:31px;flex:0 0 31px;font-size:16px}.user .avatar{background:#49677a}.bubble{max-width:calc(100% - 45px);padding:12px 14px;color:#a9c2d1;background:#0e3552;border:1px solid #245472;border-radius:0 8px 8px 8px}.user .bubble{background:#164b6b;border-color:#287098;border-radius:8px 0 8px 8px}.message-head{display:flex;gap:12px}.message-head b{color:#cce1ed;font-size:10px}.message-head span{color:#52758c;font:8px Consolas}.bubble p{margin:8px 0 0;font-size:11px;line-height:1.75;white-space:pre-wrap}.bubble .risk{display:flex;align-items:center;gap:8px;padding:9px;margin-top:11px;background:#092740}.bubble .risk span{color:#7898ad;font-size:9px}.bubble .risk em{margin-left:auto;color:#6090aa;font:9px Consolas;font-style:normal}.bubble section h4{margin:12px 0 5px;color:#4fb7e1;font-size:10px}.bubble ol,.bubble ul{display:grid;gap:4px;margin:0;padding-left:20px;color:#93afbf;font-size:10px;line-height:1.55}.bubble ul{padding:0;list-style:none}.bubble ul li{display:flex;gap:6px}.bubble ul .el-icon{margin-top:3px;color:#2bd398}.bubble footer{display:flex;gap:8px;margin-top:12px;padding-top:9px;border-top:1px solid #214a65}.bubble footer button{display:flex;align-items:center;gap:4px;padding:4px 7px;color:#69a8c8;cursor:pointer;background:transparent;border:1px solid #2a5b78;font-size:9px}.typing{display:flex;align-items:center;gap:5px}.typing i{width:5px;height:5px;border-radius:50%;background:#43b8e9;animation:typing 1.2s infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}.typing span{margin-left:6px;color:#658ba3;font-size:9px}.composer{padding:9px 16px 8px;background:#09263e;border-top:1px solid #204c6c}.quick{display:flex;align-items:center;gap:6px;margin-bottom:7px}.quick span{color:#577b92;font-size:8px}.quick button{padding:3px 7px;color:#6592ac;cursor:pointer;background:#0c3450;border:1px solid #20516f;font-size:8px}.input-box{display:flex;align-items:center;gap:8px}.input-box .el-input{flex:1}.input-box :deep(.el-textarea__inner){color:#d7e8f2;background:#071e31;box-shadow:0 0 0 1px #29516b inset}.composer>p{margin:5px 0 0;color:#456a82;text-align:center;font-size:8px}@keyframes typing{50%{opacity:.25;transform:translateY(-3px)}}@media(max-width:850px){.chat-shell{grid-template-columns:1fr}.chat-shell>aside{display:none}.quick{overflow:auto}.quick button{white-space:nowrap}}
.evidence-collapse{margin-top:10px;border-color:#214a65;--el-collapse-header-bg-color:transparent;--el-collapse-content-bg-color:transparent;--el-collapse-border-color:#214a65;--el-collapse-header-text-color:#4fb7e1;--el-collapse-content-text-color:#91acbd}.evidence-item{display:grid;grid-template-columns:110px 145px 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed rgba(65,111,140,.35);font-size:9px}.evidence-item span{color:#5f91ad}.evidence-item b{color:#7eb8d5;font:9px Consolas}.evidence-item em{font-style:normal}.quick{overflow-x:auto}.quick button{flex:0 0 auto;white-space:nowrap}
</style>
