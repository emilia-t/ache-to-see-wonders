

varying vec3 v_position;

float line(float position, float width, float center){
        float halfWidth = width * 0.5;
        return step(center - halfWidth, position) - step(center + halfWidth, position);

}

void main(void){
    vec2 uv = gl_FragCoord.xy;//gl_FragCoord 是屏幕视图坐标中的像素位置
    vec3 color = 
            vec3(1.0, 1.0, 0.0) * 
            line(uv.x, 10.0, 100.0);//三个值分别代表了 渲染的线条的轴方向 线条宽度 线条中心点位置(这是基于屏幕视图坐标而定的)
    gl_FragColor = vec4(color,1.0);
}