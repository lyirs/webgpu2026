struct BlurUniforms {
  texelSize: vec4f,
};

@group(0) @binding(0) var blurSampler: sampler;
@group(0) @binding(1) var aoTexture: texture_2d<f32>;
@group(0) @binding(2) var normalTexture: texture_2d<f32>;
@group(0) @binding(3) var viewPositionTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> blurUniforms: BlurUniforms;

struct FullscreenOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

fn trianglePosition(vertexIndex: u32) -> vec2f {
  switch vertexIndex {
    case 0u: {
      return vec2f(-1.0, -1.0);
    }
    case 1u: {
      return vec2f(3.0, -1.0);
    }
    default: {
      return vec2f(-1.0, 3.0);
    }
  }
}

fn decodeNormal(encoded: vec3f) -> vec3f {
  return normalize(encoded * 2.0 - 1.0);
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> FullscreenOutput {
  let clipPosition = trianglePosition(vertexIndex);
  var output: FullscreenOutput;
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  return output;
}

@fragment
fn fsMain(input: FullscreenOutput) -> @location(0) vec4f {
  let baseViewPosition =
    textureSampleLevel(viewPositionTexture, blurSampler, input.uv, 0.0).xyz;
  let baseNormal =
    decodeNormal(
      textureSampleLevel(normalTexture, blurSampler, input.uv, 0.0).xyz
    );

  if (length(baseViewPosition) < 0.0001) {
    return vec4f(1.0, 1.0, 1.0, 1.0);
  }

  let offsets = array<vec2f, 5>(
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(-1.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(0.0, -1.0),
  );
  let kernelWeights = array<f32, 5>(0.38, 0.155, 0.155, 0.155, 0.155);

  var accumulatedAo = 0.0;
  var accumulatedWeight = 0.0;

  for (var sampleIndex = 0u; sampleIndex < 5u; sampleIndex += 1u) {
    let sampleUv =
      input.uv + offsets[sampleIndex] * blurUniforms.texelSize.xy;
    let sampleViewPosition =
      textureSampleLevel(viewPositionTexture, blurSampler, sampleUv, 0.0).xyz;

    if (length(sampleViewPosition) < 0.0001) {
      continue;
    }

    let sampleNormal =
      decodeNormal(
        textureSampleLevel(normalTexture, blurSampler, sampleUv, 0.0).xyz
      );
    let sampleAo = textureSampleLevel(aoTexture, blurSampler, sampleUv, 0.0).r;
    let normalWeight = pow(max(dot(baseNormal, sampleNormal), 0.0), 8.0);
    let depthWeight =
      exp(-abs(baseViewPosition.z - sampleViewPosition.z) * 28.0);
    let weight = kernelWeights[sampleIndex] * max(normalWeight * depthWeight, 0.0001);

    accumulatedAo += sampleAo * weight;
    accumulatedWeight += weight;
  }

  let ao = accumulatedAo / max(accumulatedWeight, 0.0001);
  return vec4f(vec3f(ao), 1.0);
}
