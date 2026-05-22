<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAssistantStore } from '@/stores/assistant';
import { gateway } from '@/services/gateway';

const router = useRouter();
const store = useAssistantStore();

const providers = [
  { id: 'deepseek', label: 'DeepSeek', badge: '推荐✨', apiUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'openai', label: 'OpenAI', badge: '', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { id: 'qwen', label: '通义千问', badge: '', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'custom', label: '自定义', badge: '', apiUrl: '', model: '' },
];

const form = reactive({
  apiUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  activeProvider: 'deepseek',
});

const testing = ref(false);
const testResult = ref<'idle' | 'success' | 'error'>('idle');
const testMessage = ref('');

function selectProvider(provider: typeof providers[0]) {
  form.activeProvider = provider.id;
  form.apiUrl = provider.apiUrl;
  form.model = provider.model;
  testResult.value = 'idle';
}

async function testConnection() {
  if (!form.apiUrl || !form.apiKey || !form.model) return;
  testing.value = true;
  testResult.value = 'idle';

  try {
    const res = await gateway.testLLM({
      baseUrl: form.apiUrl,
      apiKey: form.apiKey,
      model: form.model,
    });

    if (res.status === 'ok') {
      testResult.value = 'success';
      testMessage.value = `连接成功！${res.data?.model ?? form.model} 已就绪`;

      // 同步配置到网关
      await gateway.updateLLMConfig({
        baseUrl: form.apiUrl,
        apiKey: form.apiKey,
        model: form.model,
      });

      // 保存到 store
      store.setLLMConfig({ provider: form.activeProvider, model: form.model });
    } else {
      testResult.value = 'error';
      testMessage.value = res.message ?? '连接失败';
    }
  } catch (err: unknown) {
    testResult.value = 'error';
    testMessage.value = '无法连接到网关服务，请确认 AI 助手已正常启动';
  } finally {
    testing.value = false;
  }
}

function next() {
  if (testResult.value === 'success') {
    router.push('/scan');
  }
}
</script>

<template>
  <div class="page">
    <div class="mascot">🧠</div>
    <p class="mascot-text">
      现在来给 AI 配个「大脑」~<br />
      别担心，填 3 个信息就好！
    </p>

    <!-- 快捷填入 -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px;">
      <button
        v-for="p in providers"
        :key="p.id"
        class="chip"
        :class="{ active: form.activeProvider === p.id }"
        @click="selectProvider(p)"
      >
        {{ p.label }} <span v-if="p.badge" style="font-size:11px">{{ p.badge }}</span>
      </button>
    </div>

    <!-- 3 行配置 -->
    <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
      <div>
        <div class="label">① API 地址</div>
        <input v-model="form.apiUrl" class="input" placeholder="https://api.deepseek.com/v1" />
      </div>

      <div>
        <div class="label">② API 密钥</div>
        <input v-model="form.apiKey" class="input" type="password" placeholder="sk-xxxxxxxxxxxxxxxx" />
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
          💡 还没密钥？
          <a href="#" style="color: var(--primary)" @click.prevent="() => {}">
            📖 1分钟教你免费获取 →
          </a>
        </div>
      </div>

      <div>
        <div class="label">③ 模型名称</div>
        <input v-model="form.model" class="input" placeholder="deepseek-chat" />
      </div>

      <!-- 测试连接 -->
      <button
        class="btn btn-success"
        style="width: 100%"
        :disabled="testing || !form.apiUrl || !form.apiKey || !form.model"
        @click="testConnection"
      >
        {{ testing ? '⏳ 正在测试...' : '🟢 测试连接' }}
      </button>

      <div
        v-if="testResult !== 'idle'"
        class="status-badge"
        :class="testResult === 'success' ? 'online' : 'offline'"
        style="justify-content: center; padding: 8px;"
      >
        {{ testResult === 'success' ? '✅' : '❌' }} {{ testMessage }}
      </div>
    </div>

    <button
      class="btn btn-primary"
      style="margin-top: 20px; width: 100%"
      :disabled="testResult !== 'success'"
      @click="next"
    >
      下一步
    </button>
  </div>
</template>
