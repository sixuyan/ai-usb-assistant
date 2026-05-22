<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { gateway } from '@/services/gateway';

const router = useRouter();
const activeTab = ref('platform');

const tabs = [
  { id: 'platform', label: '平台管理', icon: '📱' },
  { id: 'model', label: 'AI 引擎', icon: '🧠' },
  { id: 'knowledge', label: '知识库', icon: '📚' },
  { id: 'security', label: '内容安全', icon: '🛡️' },
  { id: 'logs', label: '运行日志', icon: '📋' },
];

// 平台状态
const platforms = ref([
  { id: 'qq', name: 'QQ', status: 'not_connected', icon: '🐧' },
  { id: 'feishu', name: '飞书', status: 'not_connected', icon: '🐦' },
  { id: 'wechat-work', name: '企业微信', status: 'not_connected', icon: '💼' },
  { id: 'telegram', name: 'Telegram', status: 'not_connected', icon: '✈️' },
]);

// 知识库文档
const knowledgeDocs = ref<Array<{ id: string; title: string; source: string }>>([]);
const loadingDocs = ref(false);

async function loadKnowledgeDocs() {
  loadingDocs.value = true;
  try {
    const res = await fetch('http://127.0.0.1:19800/api/knowledge/documents');
    const data = await res.json();
    knowledgeDocs.value = data.data ?? [];
  } catch { /* gateway not running */ }
  loadingDocs.value = false;
}

// 内容安全规则
const securityRules = ref<Array<{ id: string; category: string; pattern: string; action: string; enabled: boolean }>>([]);
const loadingRules = ref(false);

async function loadSecurityRules() {
  loadingRules.value = true;
  try {
    const res = await fetch('http://127.0.0.1:19800/api/security/rules');
    const data = await res.json();
    securityRules.value = data.data ?? [];
  } catch { /* */ }
  loadingRules.value = false;
}

// 日志
const logLines = ref<Array<{ time: string; level: string; message: string }>>([
  { time: new Date().toLocaleTimeString(), level: 'info', message: 'Gateway 引擎已启动' },
  { time: new Date().toLocaleTimeString(), level: 'info', message: '消息流水线就绪' },
]);

// LLM 配置热重载测试
async function testLLMConnection() {
  try {
    const res = await gateway.getLLMConfig();
    alert(`当前引擎: ${res.data?.model ?? '未配置'}`);
  } catch {
    alert('无法连接到 AI 引擎');
  }
}

// 回到首页
function goHome() {
  router.push('/home');
}

// Tab 切换时加载数据
function onTabChange(tab: string) {
  if (tab === 'knowledge') loadKnowledgeDocs();
  if (tab === 'security') loadSecurityRules();
}
</script>

<template>
  <div class="page" style="justify-content: flex-start; padding-top: 8px; max-width: 600px;">
    <!-- 顶部导航 -->
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 16px;">
      <h2 style="font-size: 18px;">⚙️ 高级设置</h2>
      <button class="btn btn-outline" style="padding: 6px 14px; font-size: 13px;" @click="goHome">
        返回
      </button>
    </div>

    <!-- Tab 切换 -->
    <div style="display: flex; gap: 6px; width: 100%; overflow-x: auto; margin-bottom: 16px;">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="chip"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id; onTabChange(t.id)"
      >
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- 平台管理 -->
    <div v-if="activeTab === 'platform'" class="card" style="display: flex; flex-direction: column; gap: 12px;">
      <h3 style="font-size: 15px;">已接入平台</h3>
      <div
        v-for="p in platforms"
        :key="p.id"
        style="display: flex; align-items: center; gap: 12px; padding: 12px;
               border: 1px solid var(--border); border-radius: 8px;"
      >
        <span style="font-size: 24px;">{{ p.icon }}</span>
        <span style="flex: 1; font-weight: 500;">{{ p.name }}</span>
        <span class="status-badge" :class="p.status === 'connected' ? 'online' : 'offline'">
          {{ p.status === 'connected' ? '已连接' : '未连接' }}
        </span>
        <button class="btn btn-outline" style="padding: 4px 12px; font-size: 12px;">
          {{ p.status === 'connected' ? '断开' : '连接' }}
        </button>
      </div>
    </div>

    <!-- AI 引擎 -->
    <div v-if="activeTab === 'model'" class="card" style="display: flex; flex-direction: column; gap: 12px;">
      <h3 style="font-size: 15px;">AI 引擎配置</h3>
      <p style="font-size: 13px; color: var(--text-secondary);">
        模型配置在首次引导时完成。如需更换模型，请重新运行引导流程。
      </p>
      <button class="btn btn-primary" style="width: 100%" @click="testLLMConnection">
        🟢 测试当前连接
      </button>
      <button class="btn btn-outline" style="width: 100%" @click="router.push('/config')">
        重新配置 AI 引擎
      </button>
    </div>

    <!-- 知识库 -->
    <div v-if="activeTab === 'knowledge'" class="card" style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 15px;">已学习的文档</h3>
        <button class="btn btn-outline" style="padding: 6px 14px; font-size: 13px;" @click="loadKnowledgeDocs">
          🔄 刷新
        </button>
      </div>
      <div v-if="loadingDocs" style="text-align: center; color: var(--text-secondary); padding: 20px;">
        加载中...
      </div>
      <div v-else-if="knowledgeDocs.length === 0" style="text-align: center; color: var(--text-secondary); padding: 20px;">
        还没有文档。去首页点击"教 AI 你的知识"上传文件。
      </div>
      <div
        v-for="doc in knowledgeDocs"
        :key="doc.id"
        style="padding: 8px; border-bottom: 1px solid var(--border); font-size: 14px;"
      >
        📄 {{ doc.title }} <span style="color: var(--text-secondary); font-size: 12px;">({{ doc.source }})</span>
      </div>
    </div>

    <!-- 内容安全 -->
    <div v-if="activeTab === 'security'" class="card" style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 15px;">过滤规则</h3>
        <button class="btn btn-outline" style="padding: 6px 14px; font-size: 13px;" @click="loadSecurityRules">
          🔄 刷新
        </button>
      </div>
      <div v-if="loadingRules" style="text-align: center; color: var(--text-secondary);">加载中...</div>
      <div
        v-for="rule in securityRules"
        :key="rule.id"
        style="display: flex; align-items: center; gap: 8px; padding: 8px;
               border-bottom: 1px solid var(--border); font-size: 13px;"
      >
        <span :style="{ color: rule.enabled ? 'var(--success)' : 'var(--text-secondary)' }">
          {{ rule.enabled ? '🟢' : '⚫' }}
        </span>
        <span style="flex: 1;">{{ rule.pattern }}</span>
        <span class="status-badge" :class="rule.action === 'block' ? 'offline' : 'online'">
          {{ rule.action === 'block' ? '拦截' : rule.action === 'warn' ? '警告' : '记录' }}
        </span>
      </div>
    </div>

    <!-- 运行日志 -->
    <div v-if="activeTab === 'logs'" class="card" style="display: flex; flex-direction: column; gap: 4px;">
      <h3 style="font-size: 15px; margin-bottom: 8px;">运行日志</h3>
      <div
        v-for="(log, i) in logLines"
        :key="i"
        style="font-size: 12px; font-family: monospace; padding: 4px 0; border-bottom: 1px solid var(--border);"
      >
        <span style="color: var(--text-secondary);">{{ log.time }}</span>
        <span :style="{ color: log.level === 'error' ? 'var(--danger)' : 'var(--success)', margin: '0 8px' }">
          [{{ log.level.toUpperCase() }}]
        </span>
        <span>{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>
