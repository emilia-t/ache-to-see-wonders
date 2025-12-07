<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1SwitchCampResult.vue
import {ref,watch,computed} from 'vue'
import { useUserStore } from '@/stores/store';
// 定义组件属性
interface Props {
    pollCount: number; // 发起投票次数
    pollConveyor: string; // 发起投票的人
    resultCount: number; // 投票结果次数
    pollResult: string; // 投票结果
    voteTotal: number; // 投票总数
    voteAgree: number; // 同意的总数
    voteDisagree: number; // 不同意的总数
}

const props = withDefaults(defineProps<Props>(), {
  pollCount: 0,
  pollConveyor: '',
  resultCount: 0,
  pollResult: '',
  voteTotal: 0,
  voteAgree: 0,
  voteDisagree: 0
})

const isVisible = ref(false);
const isMyRest = ref(false);
const userStore = useUserStore();
const myCov = computed(
    ()=>{
       if(userStore.userData!==null){
          return userStore.userData.name + '&' + userStore.userData.email;
       }else{
          return '';
       }
    }
);

const handleOk = () => {
  isVisible.value = false;
};

// 暴露给父组件
defineExpose({
  isVisible
});

// 监听
watch(props,(newValue,oldValue)=>{
    
});
</script>

<template>
  
</template>

<style scoped lang="scss">

</style>