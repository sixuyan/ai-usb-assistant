// @aiusb/desktop — 全局状态管理

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { gateway } from '@/services/gateway';

export const useAssistantStore = defineStore('assistant', () => {
  // 引导流程状态
  const onboardingStep = ref<'welcome' | 'config' | 'scan' | 'done' | 'home'>('welcome');
  const selectedScene = ref<string | null>(null);

  // LLM 配置
  const llmConfigured = ref(false);
  const llmProvider = ref('deepseek');
  const llmModel = ref('deepseek-chat');

  // 平台连接
  const platformConnected = ref(false);
  const connectedPlatform = ref<string | null>(null);

  // 场景运行状态
  const activeFeatures = ref([
    { icon: '📋', label: '群管家', status: '运行中' },
    { icon: '🔍', label: '联网搜索', status: '已开启' },
    { icon: '🛡️', label: '内容过滤', status: '已开启' },
    { icon: '🧠', label: 'DeepSeek V3', status: '已连接' },
  ]);

  // 聊天历史
  const chatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const isReady = computed(() => llmConfigured.value && platformConnected.value);

  // Actions
  function setScene(sceneId: string) {
    selectedScene.value = sceneId;

    // 根据场景设置默认功能
    switch (sceneId) {
      case 'qq-group':
        activeFeatures.value = [
          { icon: '📋', label: '群管家', status: '运行中' },
          { icon: '🔍', label: '联网搜索', status: '已开启' },
          { icon: '🛡️', label: '内容过滤', status: '已开启' },
          { icon: '🧠', label: 'AI 引擎', status: '已连接' },
        ];
        break;
      case 'knowledge':
        activeFeatures.value = [
          { icon: '📚', label: '知识百宝箱', status: '运行中' },
          { icon: '🔍', label: '文档问答', status: '已开启' },
          { icon: '🧠', label: 'AI 引擎', status: '已连接' },
        ];
        break;
    }
  }

  function goToStep(step: 'welcome' | 'config' | 'scan' | 'done' | 'home') {
    onboardingStep.value = step;
  }

  function setLLMConfig(config: { provider: string; model: string }) {
    llmProvider.value = config.provider;
    llmModel.value = config.model;
    llmConfigured.value = true;
  }

  function setPlatformConnected(platform: string) {
    connectedPlatform.value = platform;
    platformConnected.value = true;
  }

  function addChatMessage(role: 'user' | 'assistant', content: string) {
    chatMessages.value.push({ role, content });
  }

  async function sendChatMessage(text: string): Promise<string> {
    addChatMessage('user', text);
    try {
      const result = await gateway.sendMessage(text);
      const reply = result.data?.reply ?? '抱歉，没有收到回复';
      addChatMessage('assistant', reply);
      return reply;
    } catch (err) {
      const errorMsg = '网关连接失败，请确认 AI 助手已正常启动';
      addChatMessage('assistant', errorMsg);
      return errorMsg;
    }
  }

  return {
    onboardingStep,
    selectedScene,
    llmConfigured,
    llmProvider,
    llmModel,
    platformConnected,
    connectedPlatform,
    activeFeatures,
    chatMessages,
    isReady,
    setScene,
    goToStep,
    setLLMConfig,
    setPlatformConnected,
    addChatMessage,
    sendChatMessage,
  };
});
