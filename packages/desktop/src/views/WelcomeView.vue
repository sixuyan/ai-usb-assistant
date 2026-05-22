<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const scenes = [
  { id: 'qq-group', icon: '📋', title: '帮我看管 QQ 群', desc: '自动回答问题、踢广告、活跃气氛' },
  { id: 'knowledge', icon: '📚', title: '做个知识百宝箱', desc: '把你的文档拖进来，随时问随时答' },
  { id: 'personal', icon: '💬', title: '当我的私人聊天助理', desc: '在微信/QQ里直接使唤我' },
  { id: 'work', icon: '🏢', title: '工作台助手', desc: '接入飞书/企微，处理工作消息' },
];

const selectedScene = ref<string | null>(null);

function selectScene(id: string) {
  selectedScene.value = id;
}

function next() {
  if (selectedScene.value) {
    router.push('/config');
  }
}
</script>

<template>
  <div class="page">
    <div class="mascot">🐱</div>
    <p class="mascot-text">
      嗨！我是你的 AI 助手小伙伴~<br />
      你想让我帮你做什么呢？
    </p>

    <div class="scene-grid">
      <div
        v-for="s in scenes"
        :key="s.id"
        class="scene-card"
        :class="{ active: selectedScene === s.id }"
        :style="selectedScene === s.id ? { borderColor: 'var(--primary)', background: '#eef2ff' } : {}"
        @click="selectScene(s.id)"
      >
        <div class="icon">{{ s.icon }}</div>
        <div class="title">{{ s.title }}</div>
        <div class="desc">{{ s.desc }}</div>
      </div>
    </div>

    <button
      class="btn btn-primary"
      style="margin-top: 24px; width: 100%"
      :disabled="!selectedScene"
      @click="next"
    >
      下一步
    </button>
  </div>
</template>
