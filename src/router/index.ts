// The relative position of this file: src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import PageUpdating from '../components/PageUpdating.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/updating'  // 添加根路径重定向到/updating
    },
    {
      path: '/updating',
      name: 'updating',
      component: PageUpdating
    },
    // 可以添加其他路由
  ],
})

export default router