<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const status = ref('waiting'); // waiting | scanned | error

onMounted(() => {
  // Phase 1: 模拟扫码流程，3 秒后自动完成
  setTimeout(() => {
    status.value = 'scanned';
    setTimeout(() => router.push('/done'), 800);
  }, 3000);
});
</script>

<template>
  <div class="page">
    <div class="mascot">📱</div>
    <p class="mascot-text">
      {{ status === 'waiting' ? '好嘞！现在让 AI 连上你的 QQ~' : '连上了！' }}
    </p>

    <div class="card" style="text-align: center; padding: 40px;">
      <div
        style="width: 180px; height: 180px; background: #f1f5f9; margin: 0 auto 16px;
               border-radius: 12px; display: flex; align-items: center; justify-content: center;"
      >
        <span v-if="status === 'waiting'" style="font-size: 64px;">📷</span>
        <span v-else style="font-size: 64px;">✅</span>
      </div>

      <div
        class="status-badge"
        :class="status === 'waiting' ? 'offline' : 'online'"
        style="justify-content: center;"
      >
        {{ status === 'waiting' ? '⏳ 等待扫码中...' : '✅ 扫码成功！' }}
      </div>

      <p style="font-size: 13px; color: var(--text-secondary); margin-top: 12px;">
        💡 用手机 QQ 扫一扫，不会泄露密码
      </p>
    </div>
  </div>
</template>
