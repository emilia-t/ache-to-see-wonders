<script setup lang="ts">
// The relative position of this file: src/components/PageTestSandbox.vue
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'
/* ---------- 响应式数据 ---------- */
const containerRef = ref<HTMLDivElement>(); // 画布挂载点
const coordRef = ref<HTMLDivElement>();     // 坐标信息容器
const coordHtml = ref('');                  // 坐标信息 HTML

/* ---------- Three.js 对象 ---------- */
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
const cubes: THREE.Mesh[] = [];

/* ---------- 坐标信息更新 ---------- */
function updateCoordinateInfo(
  screenX: number,
  screenY: number,
  worldPos: THREE.Vector3
) {
  coordHtml.value = `
    <p><strong>屏幕像素坐标:</strong><br>
    X: ${screenX.toFixed(0)} px<br>
    Y: ${screenY.toFixed(0)} px</p>
    <p><strong>3D 世界坐标:</strong><br>
    X: ${worldPos.x.toFixed(2)}<br>
    Y: ${worldPos.y.toFixed(2)}<br>
    Z: ${worldPos.z.toFixed(2)}</p>
  `;
}

/* ---------- 加载材质 ---------- */
const texture_1 = new THREE.TextureLoader().setPath("https://s3-us-west-2.amazonaws.com/s.cdpn.io/2666677/").load("sa1.jpg");
const uniforms = {
  u_color: { value: new THREE.Color(0xff0000) },
  u_time: { value: 0.0 },
  u_mouse: { value:{ x:0.0, y:0.0 }},
  u_resolution: { value:{ x:0, y:0 }},
  u_tex: { value: texture_1 }
}
const vshader = `
varying vec2 v_uv;
void main() {
  v_uv = uv;	
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`
const fshader = `
#define PI 3.141592653589
uniform vec3 u_color;
varying vec2 v_uv;
uniform sampler2D u_tex;
vec2 rotate(vec2 pt, float theta){
  float c = cos(theta);
  float s = sin(theta);
  mat2 mat = mat2(c,s,-s,c);
  return mat*pt;
}
void main (void)
{
  vec2 center = vec2(0.5);
  vec3 color = texture2D(
    u_tex,
    rotate( v_uv - center , PI / 0.5) + center
  ).rgb;
  gl_FragColor = vec4(color, 1.0); 
}
`
/* ---------- 创建立方体 ---------- */
function createCube(position: THREE.Vector3) {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshPhongMaterial({
    color: Math.random() * 0xffffff,
    transparent: true,
    opacity: 0.8
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.copy(position);
  cube.castShadow = true;
  scene.add(cube);
  cubes.push(cube);

  /* 限制数量 */
  if (cubes.length > 10) {
    const old = cubes.shift()!
    scene.remove(old);
  }
}

/* ---------- 鼠标交互 ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(e: MouseEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length) {
    updateCoordinateInfo(e.clientX, e.clientY, intersects[0].point);
  }
}

function onMouseClick(e: MouseEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length) {
    createCube(intersects[0].point);
    updateCoordinateInfo(e.clientX, e.clientY, intersects[0].point);
  }
}

/* ---------- 窗口 resize ---------- */
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

/* ---------- 动画循环 ---------- */
let rafId = 0;
function animate() {
  controls.update();
  cubes.forEach(c => {
    c.rotation.x += 0.01;
    c.rotation.y += 0.01;
  });
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

/* ---------- 初始化 ---------- */
onMounted(() => {
  const container = containerRef.value!;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AxesHelper(5));
  scene.add(new THREE.GridHelper(20, 20));

  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(10, 10, 5);
  directional.castShadow = true;
  scene.add(directional);

  updateCoordinateInfo(0, 0, new THREE.Vector3(0, 0, 0));
  const geometry = new THREE.PlaneGeometry( 2, 2 );
  const material = new THREE.ShaderMaterial( {
    uniforms: uniforms,
    vertexShader: vshader,
    fragmentShader: fshader
  } );

  const plane = new THREE.Mesh( geometry, material );
  scene.add(plane);
  animate();

  /* 事件绑定 */
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);
});

/* ---------- 清理 ---------- */
onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.domElement.removeEventListener('mousemove', onMouseMove);
  renderer.domElement.removeEventListener('click', onMouseClick);

  cubes.forEach(c => scene.remove(c));
  cubes.length = 0;
  renderer.dispose();
});
</script>

<template>
  <div ref="containerRef" class="container">
    <div class="info">
      <h3>坐标转换信息</h3>
      <div ref="coordRef" v-html="coordHtml"></div>
    </div>
    <div class="instructions">
      点击 3D 场景放置立方体<br />
      移动鼠标查看坐标转换关系
    </div>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>
.container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.info {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 10px;
  border-radius: 5px;
  font-size: 14px;
  max-width: 300px;
}
.instructions {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 10px;
  border-radius: 5px;
  font-size: 14px;
}
</style>