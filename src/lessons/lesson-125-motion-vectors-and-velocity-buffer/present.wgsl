struct PresentUniforms {
  vectorScale: f32,
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

fn hsvToRgb(hsv: vec3f) -> vec3f {
  let rgb = clamp(abs(fract(hsv.x + vec3f(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));
  return hsv.z * mix(vec3f(1.0), rgb, hsv.y);
}

fn velocityColor(velocity: vec2f) -> vec3f {
  let scaledVelocity = velocity * presentUniforms.vectorScale * 160.0;
  let magnitude = clamp(length(scaledVelocity), 0.0, 1.0);
  let angle = atan2(scaledVelocity.y, scaledVelocity.x);
  let hue = fract(angle / 6.28318530718 + 1.0);
  return hsvToRgb(vec3f(hue, 0.9, 0.16 + magnitude * 0.84));
}

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

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let isLeft = input.uv.x < 0.5;
  let panelUv = vec2f(select((input.uv.x - 0.5) * 2.0, input.uv.x * 2.0, isLeft), input.uv.y);
  let sceneColor = textureSampleLevel(colorTexture, presentSampler, panelUv, 0.0).rgb;
  let velocity = textureSampleLevel(velocityTexture, presentSampler, panelUv, 0.0).xy;
  let dividerMix = smoothstep(
    0.5 - presentUniforms.dividerSoftness,
    0.5,
    input.uv.x
  ) - smoothstep(
    0.5,
    0.5 + presentUniforms.dividerSoftness,
    input.uv.x
  );

  let panelColor = select(
    velocityColor(velocity),
    sceneColor,
    isLeft
  );
  let dividerColor = vec3f(1.0, 0.72, 0.5);
  let shaded = mix(panelColor, dividerColor, dividerMix);
  return vec4f(shaded, 1.0);
}
