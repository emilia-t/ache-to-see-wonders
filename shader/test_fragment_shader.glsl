uniform vec3 u_color;
uniform vec2 u_resolution;

void main (void)
{
  vec2 uv = gl_FragCoord.xy/u_resolution;
  vec3 color = mix(vec3(1.0,0.0,0.0), vec3(0.0,0.0,1.0), uv.y);
  gl_FragColor = vec4(color, 1.0); 
  
}