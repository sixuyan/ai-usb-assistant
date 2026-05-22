<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const groups = ref([
  { name: '技术交流群', count: 328, checked: true },
  { name: '摸鱼划水群', count: 156, checked: true },
  { name: '班级通知群', count: 45, checked: false },
]);

function start() {
  router.push('/home');
}
</script>

<template>
  <div class="page">
    <div class="mascot">🐱</div>
    <p class="mascot-text">连上啦！想让 AI 帮你看管哪个群？</p>

    <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
      <div
        v-for="g in groups"
        :key="g.name"
        style="display: flex; align-items: center; gap: 12px; padding: 12px;
               border: 1px solid var(--border); border-radius: 8px;"
      >
        <input type="checkbox" v-model="g.checked" style="width: 18px; height: 18px;" />
        <span style="flex: 1; font-weight: 500;">{{ g.name }}</span>
        <span style="font-size: 13px; color: var(--text-secondary);">{{ g.count }}人</span>
      </div>

      <p style="font-size: 12px; color: var(--text-secondary); text-align: center;">
        💡 可以多选，以后也能随时改
      </p>
    </div>

    <button class="btn btn-primary" style="margin-top: 20px; width: 100%" @click="start">
      开始工作！
    </button>
  </div>
</template>
