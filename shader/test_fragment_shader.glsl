uniform vec3 u_color;// 通过使用 uniform 修饰器，可以使得变量可以被外部的js代码所修改
uniform vec2 u_resolution;

vec3 color = vec3(0.0);// 你完全可以使用一个"0.0"来表示3个同样的值 vec3(0.0, 0.0, 0.0)

//clamp(value,minimum,maximum)
float maxValue = clamp(2.0,0.0,1.0);//minValue = 1.0 使用clamp()函数来限制值的范围不会大于第三个值也不会小于第二个值
float minValue = clamp(-1.0,0.0,1.0);//minValue = 0.0

//step(edge, value) 当value<edge 则返回0.0否则返回1.0 这在处理光照突变的边缘很有用
float edgen=step(0.0,0.0);//1
float edgen=step(0.0,-1.0);//0

//smoothstep() 平滑处理
//smoothstep(edge0, edge1, n)
//
//if n<edge0 - 0.0 returned // 不处理小于edge0
//if n>edge1 - 1.0 returned // 不处理大于edge1
//if n>edge0 and n<edge1 then
//函数源码：
//float smoothstep(edge0,edge1,n){
//  float t = clamp((n-edge0) / (edge1 - edge0), 0.0, 1.0);
//  return t*t*(3.0-2.0*t);
//}
void main (void){

  varying vec3 v_position;

  vec2 uv = gl_FragCoord.xy/u_resolution;
  vec3 color = mix(vec3(1.0,0.0,0.0), vec3(0.0,0.0,1.0), uv.y);// 使用 mix 可以将颜色进行混合处理，此处使用红色渐变蓝色，以uv的y轴为过度路径

  //在 GLSL 中，vec2 是一个内置的二维向量类型，它有 .x、.y、.xy 等分量访问器。
  vec3 position = vec3(1.0, 2.0, 3.0);//坐标命名空间 (xyzw)

  float x = position.x;    // 1.0
  float y = position.y;    // 2.0  
  float z = position.z;    // 3.0

  vec2 xy = position.xy;   // vec2(1.0, 2.0)
  vec2 xz = position.xz;   // vec2(1.0, 3.0)
  vec3 xyz = position.xyz; // vec3(1.0, 2.0, 3.0) - 与原向量相同

  vec3 color = vec3(0.2, 0.5, 0.8);//颜色命名空间 (rgba)

  float r = color.r;       // 0.2
  float g = color.g;       // 0.5
  float b = color.b;       // 0.8

  vec2 rg = color.rg;      // vec2(0.2, 0.5)
  vec3 rgb = color.rgb;    // vec3(0.2, 0.5, 0.8) - 与原向量相同

  vec3 texCoord = vec3(0.1, 0.2, 0.3);//纹理坐标命名空间 (stpq)

  float s = texCoord.s;    // 0.1
  float t = texCoord.t;    // 0.2
  float p = texCoord.p;    // 0.3

  vec2 st = texCoord.st;   // vec2(0.1, 0.2)

  //可以重复使用分量（如 .xx, .rrr）


  //float length(float x)      // 对于标量，返回绝对值 |x|
  //float length(vec2 x)       // 返回 √(x.x² + x.y²)
  //float length(vec3 x)       // 返回 √(x.x² + x.y² + x.z²)
  //float length(vec4 x)       // 返回 √(x.x² + x.y² + x.z² + x.w²)

  vec2 v2 = vec2(3.0, 4.0);   // 计算 2D 向量长度
  float len = length(v);     // 返回 5.0 (因为 √(3² + 4²) = 5)

  vec3 v3 = vec3(1.0, 2.0, 2.0);//计算 3D 向量长度
  float len = length(v);       // 返回 3.0 (因为 √(1² + 2² + 2²) = 3)

  gl_FragColor = vec4(color, 1.0); 

}


/**
已知的函数：

mix()
mix(a, b, t) 线性插值
    当 t=0.0 时返回 a
    当 t=1.0 时返回 b
    如果 t = 0.5 会返回 a 和 b 的中间值


clamp()
clamp(v, min, max) 限高夹子
    当 v > max 时返回 max
    当 v < min 时返回 min

step() 
step(edge, value) 硬边缘过渡 
    当 value < edge 时返回 0.0 
    当 value ≥ edge 时返回 1.0

smoothstep() 
smoothstep(edge0, edge1, value) 返回 a 和 b 的中间值
   当 value ≤ edge0 时返回 0.0
   当 value ≥ edge1 时返回 1.0
   当 edge0 < value < edge1 时，返回在 0.0 到 1.0 之间的平滑过渡值

length()
length(float x) 返回向量长度
   对于向量 vec2(x, y)，返回 √(x² + y²)
   对于向量 vec3(x, y, z)，返回 √(x² + y² + z²)

**/