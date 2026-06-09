struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightPosition: vec4f,
  eyePosition: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
  @location(3) surfaceParams: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

/**
 * 基于世界空间坐标做一层细网格，让运动和清晰度差异更容易被看见。
 */
fn gridMask(coord: vec2f, scale: f32) -> f32 {
  let scaled = coord * scale;
  let lineDistance = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), vec2f(0.0001));
  let line = 1.0 - min(min(lineDistance.x, lineDistance.y), 1.0);
  return smoothstep(0.35, 0.92, line);
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightVector = frameUniforms.lightPosition.xyz - input.worldPosition;
  let lightDirection = normalize(lightVector);
  let lightDistance = max(length(lightVector), 0.001);
  let attenuation = 1.0 / (1.0 + lightDistance * 0.17 + lightDistance * lightDistance * 0.028);
  let viewDirection = normalize(frameUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  var surfaceColor = input.baseColor.rgb;
  let grid = gridMask(input.worldPosition.xz, input.surfaceParams.y);
  if (input.surfaceParams.x > 0.5) {
    let darkened = surfaceColor * vec3f(0.48, 0.50, 0.56);
    let highlighted = min(
      surfaceColor * vec3f(1.14, 1.18, 1.24) + vec3f(0.05, 0.07, 0.09),
      vec3f(1.0)
    );
    surfaceColor = mix(darkened, highlighted, grid);
  }

  let ambient = surfaceColor * vec3f(0.20, 0.22, 0.28);
  let diffuse = surfaceColor * max(dot(normal, lightDirection), 0.0) * attenuation;
  let specular = vec3f(1.0, 0.98, 0.94) *
    pow(max(dot(normal, halfVector), 0.0), 28.0) *
    attenuation *
    0.36;
  let rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.8) * 0.11;

  let color = ambient + diffuse + specular + surfaceColor * rim;
  return vec4f(color, 1.0);
}
