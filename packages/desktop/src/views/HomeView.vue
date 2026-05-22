<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { useAssistantStore } from '@/stores/assistant';

const store = useAssistantStore();
const inputText = ref('');
const chatContainer = ref<HTMLElement | null>(null);
const sending = ref(false);

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || sending.value) return;

  inputText.value = '';
  sending.value = true;

  await store.sendChatMessage(text);

  sending.value = false;
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

watch(() => store.chatMessages.length, async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
});
</script>

<template>
  <div class="page" style="justify-content: flex-start; padding-top: 12px;">
    <!-- 状态概览 -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap; width: 100%; margin-bottom: 12px;">
      <span
        v-for="f in store.activeFeatures"
        :key="f.label"
        class="status-badge online"
      >
        {{ f.icon }} {{ f.label }}
      </span>
    </div>

    <!-- 聊天区域 -->
    <div
      ref="chatContainer"
      style="flex: 1; width: 100%; overflow-y: auto; padding: 8px 0;
             display: flex; flex-direction: column; gap: 12px;"
    >
      <div v-if="store.chatMessages.length === 0" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">
        <div class="mascot">🐱</div>
        <p>去群里 @我 或者在这里直接跟我聊天~</p>
      </div>

      <div
        v-for="(msg, i) in store.chatMessages"
        :key="i"
        :style="{
          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9',
          color: msg.role === 'user' ? 'white' : 'var(--text)',
          fontSize: '14px',
          lineHeight: '1.5',
        }"
      >
        {{ msg.content }}
      </div>

      <div v-if="sending" style="align-self: flex-start; color: var(--text-secondary); font-size: 13px; padding: 8px;">
        ⏳ AI 正在思考...
      </div>
    </div>

    <!-- 输入区域 -->
    <div style="width: 100%; display: flex; gap: 8px; padding: 12px 0;
                border-top: 1px solid var(--border);">
      <input
        v-model="inputText"
        class="input"
        placeholder="输入消息... (Enter 发送)"
        style="flex: 1;"
        :disabled="sending"
        @keydown="handleKeydown"
      />
      <button
        class="btn btn-primary"
        :disabled="!inputText.trim() || sending"
        @click="sendMessage"
      >
        发送
      </button>
    </div>
  </div>
</template>
