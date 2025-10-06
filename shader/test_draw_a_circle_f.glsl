//片段着色器

varying vec3 v_position;

void main(void){

    float inCircle = 1.0 - step(0.5 , length(v_position.xy));//判断此点是否在原内 返回值 1.0 和0.0
    vec3 color = vec3(1.0, 1.0, 0.0) * inCircle; //如果在则颜色为黄色否则为黑色

    gl_FragColor = vec4(color, 1.0);
}