struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  lightDirection: vec4f,
  settings: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) uv: vec2f,
  @builtin(front_facing) isFrontFacing: bool,
};

fn cutoutSignedDistance(uv: vec2f) -> f32 {
  let p = uv * 2.0 - vec2f(1.0, 1.0);
  let center = 1.0 - abs(p.y);
  let stem = 0.075 - abs(p.x);
  let bladeHalfWidth = 0.085 + 0.68 * center;
  let serration =
    0.042 * smoothstep(0.0, 0.95, center) * abs(sin((p.y + 1.0) * 18.0));
  let blade = bladeHalfWidth - serration - abs(p.x);
  return max(stem, blade);
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal =
    normalize(select(-input.worldNormal, input.worldNormal, input.isFrontFacing));
  let lightDirection = normalize(uniforms.lightDirection.xyz);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let isCutout = uniforms.settings.x;
  let renderMode = uniforms.settings.y;
  let signedDistance = cutoutSignedDistance(input.uv);
  let alpha = select(
    1.0,
    clamp(signedDistance / 0.04 + 0.5, 0.0, 1.0),
    isCutout > 0.5
  );

  if (isCutout > 0.5 && renderMode < 0.5 && signedDistance < 0.0) {
    discard;
  }

  let litColor = uniforms.baseColor.rgb * (0.24 + 0.76 * lambert);
  return vec4f(litColor, alpha);
}
