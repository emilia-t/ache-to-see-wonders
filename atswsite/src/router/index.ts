// The relative position of this file: src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import PageUpdating from '@/components/PageUpdating.vue'
import PageNeuroSandbox from '@/components/PageNeuroSandbox.vue'
import PageTestSandbox from '@/components/PageTestSandbox.vue'
import PageChineseChess from '@/components/PageChineseChess.vue'
import PageHome from '@/components/PageHome.vue'

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
      component: PageHome
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
    }
  ]
})

export default router