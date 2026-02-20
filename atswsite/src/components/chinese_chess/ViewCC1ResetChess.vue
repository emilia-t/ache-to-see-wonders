<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1ResetChess.vue
import {ref} from 'vue'

// 定义组件属性
interface Props {
    giveUpState: boolean;
    giveUpConveyor: string;
}

const props = withDefaults(defineProps<Props>(), {
  giveUpState:false,
  giveUpConveyor: ''
});

const isVisible = ref(true);//默认启用

// 定义点击事件
const emit = defineEmits<{
  'click-reset-chess': [value: boolean]
}>();

// 方法
const handleClick = () => {
  emit('click-reset-chess', props.giveUpState);
};

// 暴露给父组件
defineExpose({
  isVisible
});
</script>

<template>
  <div 
    v-if="isVisible"
    class="view-reset-chess-container"
    :class="giveUpState?'t':'f'"
  >
    <a 
      class="button"
      @click="handleClick"
      role="button"
      tabindex="0"
      @keydown.enter="handleClick"
      @keydown.space.prevent="handleClick"
    >
      <div class="icon-wrapper">
        <ul class="icon">
            <li class="c_refresh"></li>
        </ul>
      </div>
      <span>
        重置
      </span>
    </a>
  </div>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '../sprite/style/sprite.scss';
.view-reset-chess-container {
    position: fixed;
    left: 20px;
    top: 260px;
    z-index: 490;
}

@media (max-width: 480px) {
    .view-reset-chess-container {
        position: fixed;
        left: 10px;
        top: 200px;
    }
}

.button {
  border: 2px solid #c7c7c7;
  border-radius: 40px;
  padding: 0.45rem 0.75rem;
  color: #878787;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  // filter: grayscale(100%);
  -webkit-user-select: none;
     -moz-user-select: none;
      -ms-user-select: none;
          user-select: none;
  text-decoration: none;
  background: rgba(255, 255, 255, 1);
  cursor: pointer;
  outline: none;
}
.button.openState {
  color: #ff6e6f;
  border-color: currentColor;
  // filter: grayscale(0);
}
.button:hover {
  border-color: currentColor;
}
.button span{
    margin-left: 0.25em
}

/*** sprites icon ***/
// .png 图片引用
.icon {
	@include sprites($spritesheet-sprites);
}
// @2x.png 图片引用
.icon_retina {
	@include retina-sprites($retina_groups);
}
// 自定义图标样式
.icon-wrapper {
  width: 22px;  /* 图标显示的大小 */
  height: 22px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 隐藏超出部分 */
}
.icon-wrapper .icon {
  transform: scale(0.24); /* 根据原始图标与显示尺寸的比例调整 */
  /* 例如图标原始尺寸是60x60，想显示为30x30，则缩放0.5 */
}
ul.icon{
  padding-inline-start:0px;
  padding-block-end:0px;
  margin-block-start:0px;
  margin-block-end:0px;
  opacity:0.8; /* 增加透明度 */
}
.icon-wrapper .icon.t2{
  transform: scale(0.4); /* 根据原始图标与显示尺寸的比例调整 */
  /* 例如图标原始尺寸是60x60，想显示为30x30，则缩放0.5 */
}
</style>