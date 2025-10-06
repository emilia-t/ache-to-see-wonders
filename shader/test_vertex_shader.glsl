void main() {	
  varying vec3 v_position;// 通过使用varying 可以限制一个数据只能从 顶点着色器(vertex) 向 片段着色器 (fragment) 传递值



  gl_Position = projectionMatrix * modelViewMatrix * vec4( position,1 );
  
}