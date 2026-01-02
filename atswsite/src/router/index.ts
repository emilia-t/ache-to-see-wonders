// The relative position of this file: src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const routes =[
  {
    path: '/',
    redirect: '/home'  // 添加根路径重定向到??
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/components/PageHome.vue'),
    meta:{
      title:"ATSW-奇迹看板"
    }
  },
  {
    path: '/updating',
    name: 'updating',
    component: () => import('@/components/PageUpdating.vue'),
    meta:{
      title:"网站更新中"
    }
  },
  {
    path: '/neuro-sandbox',
    name: 'neuro-sandbox',
    component: () => import('@/components/PageNeuroSandbox.vue'),
    meta:{
      title:"neuroSandBox"
    }
  },
  {
    path: '/test-sandbox',
    name: 'test-sandbox',
    component: () => import('@/components/PageTestSandbox.vue'),
    meta:{
      title:"testSandBox"
    }
  },
  {
    path: '/chinese-chess',
    name: 'chinese-chess',
    component: () => import('@/components/PageChineseChess.vue'),
    meta:{
      title:"3D象棋"
    }
  },
  {
    path: '/recreation-hall',
    name: 'recreation-hall',
    component: () => import('@/components/PageRecreationHall.vue'),
    meta:{
      title:"3D娱乐厅"
    }
  },
  {
    path: '/rendering-stress-test',
    name: 'rendering-stress-test',
    component: () => import('@/components/PageRenderingStressTest.vue'),
    meta:{
      title:"3D性能测试"
    }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// 默认标题配置
const DEFAULT_TITLE = 'ATSW-奇迹看板';

// 设置标题的辅助函数
const setDocumentTitle = (to:any) => {
  const pageTitle = to.meta?.title || DEFAULT_TITLE;
  const fullTitle = to.meta?.title ? `${pageTitle}` : pageTitle;
  document.title = fullTitle;
  
  // 同时更新 og:title 用于社交媒体分享
  const ogTitleMeta = document.querySelector('meta[property="og:title"]');
  if (ogTitleMeta) {
    ogTitleMeta.setAttribute('content', fullTitle);
  }
};

// 全局路由守卫
router.beforeEach(
  (to) => {
    setDocumentTitle(to);// 设置页面标题
  }
);

export default router;