<script setup lang="ts">
// The relative position of this file: src/components/ViewFilingLicense.vue
</script>

<template>
  <div class="view-filing-license-container">
    <a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=53062602000121" target="_blank">
        <div class="left-license">
            <img src="../../public/batb.d0289dc0.png">
            <p>滇公网安备 53062602000121号&nbsp;&nbsp;</p>
        </div>
    </a>
    <a href="https://beian.miit.gov.cn" target="_blank">
        滇ICP备20002587号-2
    </a>
  </div>
</template>

<style scoped>
.view-filing-license-container{
    width: 100vw;
    height: 10px;
    position: fixed;
    z-index: 9999;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5px;
    text-align: center;
    bottom: 5px;
    left: 0;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
}
.left-license{
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
}
img{
    width: 10px;
    height: 10px;
    opacity: 0.5;
}
a{
    color:rgba(42, 42, 42, 0.5);
    text-decoration:none;
}
</style>