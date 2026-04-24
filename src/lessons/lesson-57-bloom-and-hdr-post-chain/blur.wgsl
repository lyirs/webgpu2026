@group(0) @binding(0) var blurSampler: sampler;
@group(0) @binding(1) var blurSource: texture_2d<f32>;

struct BlurParams {
  direction: vec4f,
};

@group(0) @binding(2) var<uniform> blurParams: BlurParams;

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
  let offset = blurParams.direction.xy;
  var color = textureSample(blurSource, blurSampler, input.uv) * 0.227027027;
  color +=
    textureSample(blurSource, blurSampler, input.uv + offset * 1.3846153846) *
    0.3162162162;
  color +=
    textureSample(blurSource, blurSampler, input.uv - offset * 1.3846153846) *
    0.3162162162;
  color +=
    textureSample(blurSource, blurSampler, input.uv + offset * 3.2307692308) *
    0.0702702703;
  color +=
    textureSample(blurSource, blurSampler, input.uv - offset * 3.2307692308) *
    0.0702702703;
  return vec4f(color.rgb, 1.0);
}
