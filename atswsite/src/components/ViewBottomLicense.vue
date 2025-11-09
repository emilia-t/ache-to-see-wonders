<script setup lang="ts">
// The relative position of this file: src/components/ViewBottomLicense.vue
</script>

<template>
  <div class="view-bottom-license-container">
    <div class="vto">
        <a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=53062602000121" target="_blank">
        <div class="left-license">
            <img src="/otherImage/batb.d0289dc0.png">
            <p>滇公网安备 53062602000121号&nbsp;&nbsp;</p>
        </div>
        </a>
        <a href="https://beian.miit.gov.cn" target="_blank">
            滇ICP备20002587号-2
        </a>
    </div>
    <p class="copyright-info">
        &nbsp;&nbsp;|&nbsp;&nbsp;Copyright © 2025 Ache to See Wonders. All rights reserved.
    </p>
  </div>
</template>

<style scoped>
.view-bottom-license-container{
    overflow: hidden;
    width: 99vw;
    height: 24px;
    position: relative;
    z-index: 9999;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px;
    text-align: center;
    bottom: 5px;
    left: 0;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    color: rgba(42, 42, 42, 0.5);
    margin-bottom: 5px;
}
.left-license{
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
}
img{
    width: 14px;
    height: 14px;
    opacity: 0.5;
    transform: translateY(1px);
}
a{
    color:rgba(42, 42, 42, 0.5);
    text-decoration:none;
}
@media (max-width: 480px) {
    .view-bottom-license-container{
        font-size: 10px;
        height: 40px;
        margin-bottom: 10px;
    }
    img{
        width: 10px;
        height: 10px;
        opacity: 0.5;
    }
}
.copyright-info{
    margin: 1px 0 0 0;
}
.vto{
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    height: 24px;
}
.vto p{
    margin: 0;
}
</style>