struct SsrUniforms {
  projectionMatrix: mat4x4f,
  maxSteps: f32,
  stepScale: f32,
  thickness: f32,
  reflectionStrength: f32,
  dividerSoftness: f32,
  reserved0: f32,
  reserved1: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var ssrSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;
@group(0) @binding(2) var normalTexture: texture_2d<f32>;
@group(0) @binding(3) var viewPositionTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> ssrUniforms: SsrUniforms;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var clip = array(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let clipPosition = clip[vertexIndex];
  var output: VertexOutput;
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

fn projectToUv(viewPosition: vec3f) -> vec2f {
  let clip = ssrUniforms.projectionMatrix * vec4f(viewPosition, 1.0);
  let ndc = clip.xy / max(clip.w, 0.0001);
  return ndc * vec2f(0.5, -0.5) + vec2f(0.5);
}

fn sampleSsr(panelUv: vec2f) -> vec3f {
  let baseColor = textureSampleLevel(colorTexture, ssrSampler, panelUv, 0.0).rgb;
  let normalReflectivity =
    textureSampleLevel(normalTexture, ssrSampler, panelUv, 0.0);
  let reflectivity = normalReflectivity.a;

  if (reflectivity < 0.05) {
    return baseColor;
  }

  let viewPosition =
    textureSampleLevel(viewPositionTexture, ssrSampler, panelUv, 0.0).xyz;

  if (length(viewPosition) < 0.0001) {
    return baseColor;
  }

  let normal = normalize(normalReflectivity.xyz * 2.0 - 1.0);
  let viewDirection = normalize(viewPosition);
  let rayDirection = normalize(reflect(viewDirection, normal));
  var rayPosition = viewPosition + normal * 0.05;
  var hitColor = baseColor;
  var hitMask = 0.0;

  for (var stepIndex = 0; stepIndex < 96; stepIndex += 1) {
    if (f32(stepIndex) >= ssrUniforms.maxSteps) {
      break;
    }

    rayPosition += rayDirection * ssrUniforms.stepScale;
    let rayUv = projectToUv(rayPosition);

    if (rayUv.x < 0.0 || rayUv.x > 1.0 || rayUv.y < 0.0 || rayUv.y > 1.0) {
      break;
    }

    let sampledViewPosition =
      textureSampleLevel(viewPositionTexture, ssrSampler, rayUv, 0.0).xyz;

    if (length(sampledViewPosition) < 0.0001) {
      continue;
    }

    let rayDepth = -rayPosition.z;
    let sceneDepth = -sampledViewPosition.z;

    if (abs(rayDepth - sceneDepth) < ssrUniforms.thickness) {
      hitColor = textureSampleLevel(colorTexture, ssrSampler, rayUv, 0.0).rgb;
      hitMask = 1.0;
      break;
    }
  }

  return mix(baseColor, hitColor, hitMask * reflectivity * ssrUniforms.reflectionStrength);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let isLeft = input.uv.x < 0.5;
  let panelUv = vec2f(select((input.uv.x - 0.5) * 2.0, input.uv.x * 2.0, isLeft), input.uv.y);
  let rawColor = textureSampleLevel(colorTexture, ssrSampler, panelUv, 0.0).rgb;
  let ssrColor = sampleSsr(panelUv);
  let dividerMix = smoothstep(
    0.5 - ssrUniforms.dividerSoftness,
    0.5,
    input.uv.x
  ) - smoothstep(
    0.5,
    0.5 + ssrUniforms.dividerSoftness,
    input.uv.x
  );
  let panelColor = select(ssrColor, rawColor, isLeft);
  let shaded = mix(panelColor, vec3f(1.0, 0.72, 0.5), dividerMix);
  return vec4f(shaded, 1.0);
}
