//顶点着色器

attribute vec3 position;          // 顶点位置
attribute vec3 normal;           // 法线向量
attribute vec2 uv;               // UV 坐标
attribute vec4 color;            // 顶点颜色

// 矩阵 uniforms
uniform mat4 projectionMatrix;    // 投影矩阵
uniform mat4 modelViewMatrix;     // 模型视图矩阵
uniform mat4 modelMatrix;         // 模型矩阵
uniform mat4 viewMatrix;          // 视图矩阵
uniform vec3 cameraPosition;      // 相机位置

varying vec3 v_position;

void main(void){
    v_position = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );// 归一化
}