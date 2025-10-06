varying vec3 v_position;

float myRect(vec2 position, vec2 size, vec2 center){//以 center 点为中心渲染一个矩形
    vec2 newP = position - center;//偏移后的点的新位置
    vec2 halfSzie = size * 0.5;//计算半个边长

    float horizontal = step(-halfSzie.x, newP.x) - step(halfSzie.x, newP.x);
    float vertical = step(-halfSzie.y, newP.y) - step(halfSzie.y, newP.y);

    return horizontal * vertical;
}

/*
运行过程：
假设当前渲染的点
v_position = vec3(-1.0, 0.0, 0.0)
size = vec2(1.0, 1.0)
center = vec2(0.0, 0.0)

从x轴上看该点是否需要渲染？


取一个半长度 = 0.5 ,（因为是以center为中心）

看左侧：

step(-0.5 , -1.0) -> 0.0

看右侧：

step(0.5 , -1.0) -> 0.0

0.0 - 0.0 = 0.0

所以这个点不渲染
以此类推可以得到其他点的x轴的值，然后再和y轴相乘得到最终这个点的值。


*/

/* 2d
                          -------------------------（1.0, 1.0, 0.0）(x, y, z)
                          |                       |
                          |                       |
                          |                       |
                          |                       |
                          |                       |
                          |                       |
                          |                       |
(-1.0, -1.0, 0.0）(x, y, z)-------------------------
*/

void main(void){

    float inRect = myRect(v_position.xy, vec2(1.0,1.0), vec2(0.0,0.0));
    vec3 color = vec3(1.0, 1.0, 0.0) * inRect;
    gl_FragColor = vec4(color,1.0);
}


/*

我们再继续简化到 一维 更容易理解渲染过程：

/* 一维
    （-1.0）-------------------------（1.0）

    假设要渲染一个 以 (0.0)为中心点  长度为 1 的线条该如何计算哪些像素点需要渲染呢？

    我们很容易想到 可以在 (0.0) 往左绘制 0.5 个单位长度 ,
    然后再往右绘制 0.5 个长度，于是我们就得到了一个 长度为1 且居中显示的线条

    所以我们先取长度的一半 并命名为 halfSize = 0.5

    然后计算线段左侧的坐标  leftP = 0.0 - halfSize = -0.5

    然后计算线段右侧的坐标 rightP = 0.0 + halfSize = 0.5

    最后挨个计算每个点是否处于 -0.5 ~ 0.5 区间，如果是则渲染

*/
