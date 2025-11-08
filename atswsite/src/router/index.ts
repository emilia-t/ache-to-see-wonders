// The relative position of this file: src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/home'  // 添加根路径重定向到??
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/components/PageHome.vue')
    },
    {
      path: '/updating',
      name: 'updating',
      component: () => import('@/components/PageUpdating.vue')
    },
    {
      path: '/neuro-sandbox',
      name: 'neuro-sandbox',
      component: () => import('@/components/PageNeuroSandbox.vue')
    },
    {
      path: '/test-sandbox',
      name: 'test-sandbox',
      component: () => import('@/components/PageTestSandbox.vue')
    },
    {
      path: '/chinese-chess',
      name: 'chinese-chess',
      component: () => import('@/components/PageChineseChess.vue')
    }
  ]
})

export default router