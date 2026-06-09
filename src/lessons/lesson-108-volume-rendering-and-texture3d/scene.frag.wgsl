struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
  volumeParams: vec4f,
  animationParams: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) localPosition: vec3f,
  @location(3) objectColor: vec4f,
  @location(4) surfaceParams: vec4f,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
@group(2) @binding(0) var volumeTexture: texture_3d<f32>;
@group(2) @binding(1) var volumeSampler: sampler;

fn litColor(input: FragmentInput) -> vec3f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(sceneUniforms.lightPosition.xyz - input.worldPosition);
  let viewDirection = normalize(sceneUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  let lambert = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0);
  let ambient = vec3f(0.09, 0.11, 0.14);

  var baseColor = input.objectColor.rgb;
  if (input.surfaceParams.x > 0.5) {
    let detailScale = max(0.0001, input.surfaceParams.y);
    let gridUv = abs(fract(input.worldPosition.xz * detailScale) - 0.5);
    let gridLine = 1.0 - smoothstep(0.45, 0.5, min(gridUv.x, gridUv.y));
    baseColor += vec3f(0.14, 0.18, 0.24) * gridLine;
  }

  return ambient + baseColor * (0.24 + lambert * 0.92) + vec3f(0.85) * specular * 0.16;
}

@fragment
fn opaqueFragment(input: FragmentInput) -> @location(0) vec4f {
  return vec4f(litColor(input), 1.0);
}

@fragment
fn sliceFragment(input: FragmentInput) -> @location(0) vec4f {
  let sliceDepth = sceneUniforms.volumeParams.x;
  let uvw = vec3f(
    input.localPosition.x * 0.5 + 0.5,
    input.localPosition.y * 0.5 + 0.5,
    clamp(sliceDepth * 0.5 + 0.5, 0.0, 1.0)
  );
  let density = textureSampleLevel(volumeTexture, volumeSampler, uvw, 0.0).r;
  let contour = 1.0 - smoothstep(0.16, 0.5, abs(fract(density * 9.0) - 0.5));
  let glow = smoothstep(0.22, 0.9, density);
  let cool = mix(vec3f(0.07, 0.13, 0.22), vec3f(0.18, 0.84, 1.0), density);
  let warm = vec3f(1.0, 0.72, 0.34) * glow * 0.42;
  let frameFade = smoothstep(1.0, 0.76, max(abs(input.localPosition.x), abs(input.localPosition.y)));
  let color = (cool + warm + contour * 0.22) * frameFade;
  let alpha = mix(0.28, 0.96, density) * frameFade;
  return vec4f(color, alpha);
}
