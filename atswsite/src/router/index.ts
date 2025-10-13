// The relative position of this file: src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import PageUpdating from '@/components/PageUpdating.vue'
import PageNeuroSandbox from '@/components/PageNeuroSandbox.vue'
import PageTestSandbox from '@/components/PageTestSandbox.vue'
import PageChineseChess from '@/components/PageChineseChess.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/chinese-chess'  // 添加根路径重定向到/updating
    },
    {
      path: '/updating',
      name: 'updating',
      component: PageUpdating
    },
    {
      path: '/neuro-sandbox',
      name: 'neuro-sandbox',
      component: PageNeuroSandbox
    },
    {
      path: '/test-sandbox',
      name: 'test-sandbox',
      component: PageTestSandbox
    },
    {
      path: '/chinese-chess',
      name: 'chinese-chess',
      component: PageChineseChess
    },
    // 可以添加其他路由
  ],
})

export default router