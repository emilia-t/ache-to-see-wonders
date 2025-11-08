import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
// @ts-ignore
import Spritesmith from 'vite-plugin-spritesmith'
import path from 'node:path'
import {deleteSync} from 'del'
import fs from 'node:fs'
import glob from 'glob'

// 用于生成路径的函数
const resolve = (dir:string) => path.join(process.cwd(), dir)
// spritesmith插件生成的雪碧图和样式表存放地址
const spriteConfig = {
	imgTarget: resolve('./src/sprite/img/'),
	scssTarget: resolve('./src/sprite/style/')
}
// 导出整个网站的路径（根据实际情况修改）
const buildOutput = '../python/miracle-kanban/dist'
// 每次有更新或删除之前重新生成新的雪碧图和样式表
deleteSync(
  [spriteConfig.imgTarget,
   spriteConfig.scssTarget]
)

// 复制文件的函数
function copySpritesToDist() {
  return {
    name: 'copy-sprites-to-dist',
    apply: 'build',
    closeBundle() {
      const sourceDir = spriteConfig.imgTarget
      const targetDir = path.join(resolve(buildOutput), 'assets/src/sprite/img')
      
      // 确保目标目录存在
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      
      // 获取所有图片文件
      const files = glob.sync('*', { cwd: sourceDir })
      
      // 复制每个文件
      files.forEach(file => {
        const sourcePath = path.join(sourceDir, file)
        const targetPath = path.join(targetDir, file)
        
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, targetPath)
          console.log(`Copied: ${file} -> ${targetPath}`)
        }
      })
      
      console.log('雪碧图文件复制完成!')
    }
  }
}

export default defineConfig({
  build: {
    outDir: buildOutput
  },
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    Spritesmith(
      {
        watch: true,
        src: {
          cwd: resolve('./src/assets/sprite'), // 图标的源文件目录
          glob: '*.png', // 图标的文件格式
        },
        target: { 
          image:  `${spriteConfig.imgTarget}sprite.png`,// 生成的雪碧图的路径
          css: `${spriteConfig.scssTarget}sprite.scss`// 雪碧图的定位样式表路径
        },
        apiOptions: {
          cssImageRef: './src/sprite/img/sprite.png', // 一定要在src下，否则图片无法加载
          spritesheet_info: {
            name: 'vite1',
          },
          retina_spritesheet_info: {
            name: 'vi-retina',
          }
        },
        retina: {
          classifier(p:string) {
            let type = 'normal'
            let normalName = p
            let retinaName = p.replace('.png', '@2x.png') // 普通的图片

            if (p.endsWith('@2x.png')) {
              type = 'retina'
              normalName = p.replace('@2x.png', '.png') // 更清晰的图片
              retinaName = p
            }
            return {
              type,
              normalName,
              retinaName,
            };
          },
          targetImage: `${spriteConfig.imgTarget}sprite-retina.png`,
          cssImageRef: './src/sprite/img/sprite-retina.png',
        }
	    }
    ),
    copySpritesToDist()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})