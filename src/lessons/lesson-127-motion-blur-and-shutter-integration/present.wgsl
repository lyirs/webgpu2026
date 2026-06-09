struct PresentUniforms {
  texelSize: vec2f,
  shutterScale: f32,
  sampleCount: f32,
  velocityClampPx: f32,
  dividerSoftness: f32,
  reserved0: f32,
  reserved1: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;
@group(0) @binding(2) var velocityTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> presentUniforms: PresentUniforms;

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

fn sampleScene(uv: vec2f) -> vec3f {
  return textureSampleLevel(colorTexture, presentSampler, uv, 0.0).rgb;
}

fn sampleMotionBlur(uv: vec2f) -> vec3f {
  let color = sampleScene(uv);
  let velocity = textureSampleLevel(velocityTexture, presentSampler, uv, 0.0).xy;
  var uvVelocity =
    vec2f(velocity.x * 0.5, -velocity.y * 0.5) * presentUniforms.shutterScale;
  let maxLength =
    presentUniforms.velocityClampPx *
    max(presentUniforms.texelSize.x, presentUniforms.texelSize.y);
  let currentLength = length(uvVelocity);

  if (currentLength > maxLength && currentLength > 0.00001) {
    uvVelocity = normalize(uvVelocity) * maxLength;
  }

  if (length(uvVelocity) < 0.0005 || presentUniforms.sampleCount < 2.0) {
    return color;
  }

  var accum = vec3f(0.0);
  var weight = 0.0;

  for (var sampleIndex = 0; sampleIndex < 24; sampleIndex += 1) {
    if (f32(sampleIndex) >= presentUniforms.sampleCount) {
      break;
    }

    let t = (f32(sampleIndex) / max(presentUniforms.sampleCount - 1.0, 1.0)) - 0.5;
    let sampleUv = clamp(uv + uvVelocity * t, vec2f(0.0), vec2f(1.0));
    accum += sampleScene(sampleUv);
    weight += 1.0;
  }

  return accum / max(weight, 1.0);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let isLeft = input.uv.x < 0.5;
  let panelUv = vec2f(select((input.uv.x - 0.5) * 2.0, input.uv.x * 2.0, isLeft), input.uv.y);
  let rawColor = sampleScene(panelUv);
  let blurredColor = sampleMotionBlur(panelUv);
  let dividerMix = smoothstep(
    0.5 - presentUniforms.dividerSoftness,
    0.5,
    input.uv.x
  ) - smoothstep(
    0.5,
    0.5 + presentUniforms.dividerSoftness,
    input.uv.x
  );
  let panelColor = select(blurredColor, rawColor, isLeft);
  let shaded = mix(panelColor, vec3f(1.0, 0.72, 0.5), dividerMix);
  return vec4f(shaded, 1.0);
}
