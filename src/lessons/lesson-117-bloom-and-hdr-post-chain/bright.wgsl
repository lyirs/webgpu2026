struct ExtractUniforms {
  params: vec4f,
};

@group(0) @binding(0) var extractSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> extractUniforms: ExtractUniforms;

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

fn extractBrightColor(color: vec3f, threshold: f32) -> vec3f {
  let brightness = max(max(color.r, color.g), color.b);
  let softKnee = max(threshold * 0.18, 0.001);
  let soft = clamp(brightness - threshold + softKnee, 0.0, softKnee * 2.0);
  let softContribution = (soft * soft) / (softKnee * 4.0);
  let hardContribution = max(brightness - threshold, 0.0);
  let contribution =
    max(softContribution, hardContribution) / max(brightness, 0.0001);
  return color * contribution;
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
  let hdrColor = textureSample(sceneTexture, extractSampler, input.uv).rgb;
  let extracted = extractBrightColor(hdrColor, extractUniforms.params.x);
  return vec4f(extracted, 1.0);
}
