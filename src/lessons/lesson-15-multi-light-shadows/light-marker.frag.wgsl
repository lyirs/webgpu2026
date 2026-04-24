struct LightMarkerUniforms {
  cameraViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  markerColor: vec4f,
}

struct FragmentInput {
  @location(0) worldNormal: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: LightMarkerUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let lightDirection = normalize(vec3f(-0.35, 0.8, 0.45));
  let lambert = max(dot(normalize(input.worldNormal), lightDirection), 0.0);
  let brightness = 0.35 + lambert * 0.65;
  return vec4f(uniforms.markerColor.rgb * brightness, uniforms.markerColor.a);
}
