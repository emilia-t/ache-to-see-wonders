<script setup lang="ts">
// The relative position of this file: src/components/PageUpdating.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'

const EndMaintenanceDate = 1763254800;//网站维护的截止时间戳(秒)

/* ---------- 倒计时核心逻辑 ---------- */
const now = ref(Math.floor(Date.now() / 1000)) // 当前秒级时间戳
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => (now.value = Math.floor(Date.now() / 1000)), 1000)
})
onUnmounted(() => timer && clearInterval(timer))

/** 剩余秒数（如果已过期则固定为 0） */
const remainSeconds = computed(() =>
  Math.max(0, EndMaintenanceDate - now.value)
)

/** 拆成天/时/分/秒 */
const days = computed(() => Math.floor(remainSeconds.value / 86400))
const hours = computed(() => Math.floor((remainSeconds.value % 86400) / 3600))
const minutes = computed(() => Math.floor((remainSeconds.value % 3600) / 60))
const seconds = computed(() => remainSeconds.value % 60)

/** 格式化截止日期（中文习惯） */
const completionDateStr = computed(() => {
  const d = new Date(EndMaintenanceDate * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
})
</script>

<template>
  <div class="page-updating-container">
    <div class="container">
      <div class="logo">🚀</div>
      <h1>网站升级中</h1>
      <p>我们正在对网站进行重大升级，以提供更好的用户体验和更多功能。给您带来不便，敬请谅解。</p>
      
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
      
      <div class="countdown">
        预计剩余时间: 
        <br/>
        <span v-if="remainSeconds === 0">已结束，请刷新页面</span>
        <template v-else>
          <span v-if="days">{{ days }}天</span>
          {{ hours }}小时 {{ minutes }}分钟 {{ seconds }}秒
        </template>
      </div>
      
      <p>升级预计完成时间: <strong>{{ completionDateStr }}</strong></p>
      
      <div class="contact-info">
        <p>如有紧急问题，请联系我们:</p>
        <p>📧 Email: emilia-t@qq.com</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-updating-container {
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  padding: 0px;
  width: 100%;
}

.page-updating-container * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.container {
  text-align: center;
  max-width: 800px;
  width: 100%;
  padding: 40px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
}

h1 {
  font-size: 3.5rem;
  margin-bottom: 20px;
  text-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);
}

p {
  font-size: 1.2rem;
  margin-bottom: 30px;
  line-height: 1.6;
}

.logo {
  font-size: 4rem;
  margin-bottom: 30px;
  animation: pulse 2s infinite;
}

.progress-container {
  width: 100%;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  margin: 40px 0;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  width: 65%;
  background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%);
  border-radius: 10px;
  animation: progress-animation 3s infinite ease-in-out;
}

.countdown {
  font-size: 2.5rem;
  font-weight: bold;
  margin: 30px 0;
  text-shadow: 1px 1px 5px rgba(0, 0, 0, 0.3);
}

.contact-info {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.social-links {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
}

.social-link {
  display: inline-block;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50px;
  text-decoration: none;
  color: white;
  transition: all 0.3s ease;
}

.social-link:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-3px);
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes progress-animation {
  0% { width: 65%; }
  50% { width: 75%; }
  100% { width: 65%; }
}

@media (max-width: 768px) {
  h1 { font-size: 2.5rem; }
  .countdown { font-size: 2rem; }
  .logo { font-size: 3rem; }
  
  .container {
    padding: 20px;
  }
}
</style>