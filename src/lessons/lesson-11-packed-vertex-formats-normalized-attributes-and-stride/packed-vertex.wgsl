struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(
  @location(0) position: vec2f,
  @location(1) normal: vec2f,
  @location(2) color: vec4f
) -> VertexOut {
  let liftedNormal = normalize(vec3f(normal, 0.58));
  let light = max(dot(liftedNormal, normalize(vec3f(0.22, 0.52, 0.82))), 0.34);
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.color = vec4f(color.rgb * light, color.a);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return input.color;
}
