varying vec3 v_position;
varying vec2 v_uv;
uniform float u_time;

//定义常量
#define PI 3.14159265359
#define PI2 6.28318530718

// 旋转函数
vec2 rotate2D(vec2 position, float angle) {
    float sinA = sin(angle);
    float cosA = cos(angle);
    return vec2(
        position.x * cosA - position.y * sinA,
        position.x * sinA + position.y * cosA
    );
}

// 多边形函数
float polygon(vec2 pt, vec2 center, float radius, int sides, float rotate, float edge_thickness) {
    // 1. 将坐标平移到多边形的中心
    vec2 p = pt - center;
    
    // 2. 旋转坐标系统
    p = rotate2D(p, rotate);
    
    // 3. 计算角度和距离
    float angle = atan(p.y, p.x);
    float dist = length(p);
    
    // 4. 计算多边形的角度步长
    float segmentAngle = PI2 / float(sides);
    
    // 5. 找到当前角度所在的多边形边
    float segment = floor((angle + segmentAngle * 0.5) / segmentAngle);
    float segmentCenterAngle = segment * segmentAngle;
    
    // 6. 计算到该边的距离
    // 多边形的边可以用极坐标方程表示：r = radius / cos(θ - segmentCenterAngle)
    float cosAngle = cos(angle - segmentCenterAngle);
    float polygonRadius = radius / cosAngle;
    
    // 7. 计算到多边形边的距离
    float distanceToEdge = abs(dist - polygonRadius);
    
    // 8. 使用smoothstep创建平滑的边缘
    return 1.0 - smoothstep(0.0, edge_thickness, distanceToEdge);
}

float sweepLine(
    vec2 position,
    vec2 center,
    float radius,
    float line_width,
    float edge_thickness
){
    //演示 https://codepen.io/nik-lever/full/YBBjLo
    vec2 d = position - center;//计算从中心到当前像素的向量
    //float theta = u_time * 2.0 ;//根据时间计算旋转角度
    float theta = -(u_time * 2.0);//顺时针旋转
    vec2 p = vec2(cos(theta), sin(theta)) * radius;//在半径为 radius 的圆上的点，随时间旋转
    /*
     dot(d, p)：向量 d 在旋转方向 p 上的投影长度
     dot(p, p)：向量 p 的平方长度（即 radius²）
     h：clamp() 当前像素在扫描线上的投影比例，限制在 [0,1] 范围内
     */
    float h = clamp( dot(d, p) / dot(p, p), 0.0, 1.0);
    float len = length(d - p * h);//计算当前像素到扫描线的最短距离

    float gradient = 0.0;
    const float gradient_angle = PI * 0.5;

    if(length(d) < radius){
        // 使用 atan(d.y, d.x) 
        float pixel_angle = atan(d.y, d.x);
        // 计算与扫描线的角度差
        float angle_diff = mod(pixel_angle - theta + PI2, PI2);
        // 只在扫描线后方显示梯度
        if(angle_diff < gradient_angle){
            gradient = (gradient_angle - angle_diff) / gradient_angle * 0.5;
        }
    }

    /*
     当 len 小于 line_width - edge_thickness 时返回 1.0
     当 len 大于 line_width 时返回 0.0
     在中间区域平滑过渡
     */

    // 确保在有效范围内
    float scan_line = 1.0 - smoothstep(line_width - edge_thickness, line_width, len);
    return clamp(scan_line + gradient, 0.0, 1.0);
}

float straightLine(float position, float width, float center){
        float halfWidth = width * 0.5;
        return step(center - halfWidth, position)
             - step(center + halfWidth, position);
}

float circleLine(vec2 position, float radius, vec2 center, float lineWidth){
    // 计算当前点到圆心的距离
    float dist = distance(position, center);
    
    // 计算线条的内外边界
    float outerRadius = radius + lineWidth * 0.5;
    float innerRadius = radius - lineWidth * 0.5;
    
    // 使用step创建圆环
    float outerCircle = step(dist, outerRadius);  // 距离小于外半径返回1
    float innerCircle = step(dist, innerRadius);  // 距离小于内半径返回1
    
    // 圆环 = 外圆 - 内圆
    return outerCircle - innerCircle;
}

void main(void){
    //vec2 uv = gl_FragCoord.xy;//屏幕视图坐标(0-?)
    vec2 uv = v_uv;//uv坐标(0-1)
    vec3 color = vec3(1.0, 1.0, 0.0) * straightLine(uv.y, 0.005, 0.5);//居中平行线
        color += vec3(1.0, 1.0, 0.0) * straightLine(uv.x, 0.005, 0.5);//居中垂直线
    color += vec3(1.0,1.0,0.0) * circleLine(uv, 0.1 , vec2(0.5,0.5), 0.005);//居中圆环
    color += vec3(1.0,1.0,0.0) * circleLine(uv, 0.15, vec2(0.5,0.5), 0.005);//居中圆环
    color += vec3(1.0,1.0,0.0) * circleLine(uv, 0.2 , vec2(0.5,0.5), 0.005);//居中圆环
    color += vec3(1.0,1.0,0.0) * circleLine(uv, 0.25, vec2(0.5,0.5), 0.005);//居中圆环
    // 扫描线效果
    float sweep = sweepLine(uv, vec2(0.5,0.5), 0.25, 0.003, 0.001);
    color += vec3(0.3137, 0.902, 0.3137) * sweep;
    // 添加三角形标记 - 水平轴两端
    float triangleSize      = 0.01;//三角形大小
    float triangleThickness = 0.003;//三角形厚度
    float dynamicSpeed      = 4.0;//动效速度
    float dynamicValue      = 0.05*(sin(u_time * dynamicSpeed)+2.0);// [0.05 - 0.15]
    // 左三角形 - 水平轴指向右
    float leftTriangle =   polygon(uv, vec2(0.0+dynamicValue, 0.5), triangleSize, 3,  PI * 1.0, triangleThickness);
    // 右三角形 - 水平轴指向左
    float rightTriangle =  polygon(uv, vec2(1.0-dynamicValue, 0.5), triangleSize, 3, -PI * 0.0, triangleThickness);
    // 上三角形 - 垂直轴指向下
    float topTriangle =    polygon(uv, vec2(0.5, 1.0-dynamicValue), triangleSize, 3, -PI * 0.5, triangleThickness);
    // 下三角形 - 垂直轴指向上
    float bottomTriangle = polygon(uv, vec2(0.5, 0.0+dynamicValue), triangleSize, 3,  PI * 0.5, triangleThickness);
    color += vec3(1.0, 0.0, 0.2353) * (leftTriangle + rightTriangle + topTriangle + bottomTriangle);

    gl_FragColor = vec4(color,1.0);
}