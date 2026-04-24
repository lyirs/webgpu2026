struct TaaUniforms {
  texelSize: vec2f,
  historyBlend: f32,
  clampStrength: f32,
  historyValid: f32,
  reserved0: f32,
  reserved1: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var taaSampler: sampler;
@group(0) @binding(1) var currentColorTexture: texture_2d<f32>;
@group(0) @binding(2) var velocityTexture: texture_2d<f32>;
@group(0) @binding(3) var historyTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> taaUniforms: TaaUniforms;

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

fn sampleCurrent(uv: vec2f) -> vec3f {
  return textureSampleLevel(currentColorTexture, taaSampler, uv, 0.0).rgb;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let currentColor = sampleCurrent(input.uv);

  if (taaUniforms.historyValid < 0.5) {
    return vec4f(currentColor, 1.0);
  }

  let velocity = textureSampleLevel(velocityTexture, taaSampler, input.uv, 0.0).xy;
  let uvVelocity = vec2f(velocity.x * 0.5, -velocity.y * 0.5);
  let historyUv = input.uv - uvVelocity;

  if (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) {
    return vec4f(currentColor, 1.0);
  }

  var minColor = currentColor;
  var maxColor = currentColor;

  for (var y = -1; y <= 1; y += 1) {
    for (var x = -1; x <= 1; x += 1) {
      let sampleUv = clamp(
        input.uv + vec2f(f32(x), f32(y)) * taaUniforms.texelSize,
        vec2f(0.0),
        vec2f(1.0)
      );
      let sampleColor = sampleCurrent(sampleUv);
      minColor = min(minColor, sampleColor);
      maxColor = max(maxColor, sampleColor);
    }
  }

  let historyColor =
    textureSampleLevel(historyTexture, taaSampler, historyUv, 0.0).rgb;
  let range = maxColor - minColor;
  let looseness = 1.0 - taaUniforms.clampStrength;
  let low = minColor - range * looseness;
  let high = maxColor + range * looseness;
  let clampedHistory = clamp(historyColor, low, high);
  let blended = mix(currentColor, clampedHistory, taaUniforms.historyBlend);
  return vec4f(blended, 1.0);
}
