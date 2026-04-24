struct PresentUniforms {
  panelInfo: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var leftTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> rightPixels: array<vec4f>;
@group(0) @binding(3) var<uniform> presentUniforms: PresentUniforms;

fn tonemap(color: vec3f, exposure: f32) -> vec3f {
  let mapped = color * exposure;
  let reinhard = mapped / (1.0 + mapped);
  return pow(reinhard, vec3f(1.0 / 2.2));
}

fn sampleRightPixel(panelUv: vec2f) -> vec3f {
  let width = u32(presentUniforms.panelInfo.x);
  let height = u32(presentUniforms.panelInfo.y);
  let x = min(u32(panelUv.x * f32(width)), max(width, 1u) - 1u);
  let y = min(u32(panelUv.y * f32(height)), max(height, 1u) - 1u);
  return rightPixels[y * width + x].xyz;
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];

  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  return output;
}

@fragment
fn fsPresent(input: VertexOutput) -> @location(0) vec4f {
  let panelUv = vec2f(fract(input.uv.x * 2.0), input.uv.y);
  let exposure = presentUniforms.panelInfo.z;

  var color = vec3f(0.0);
  if (input.uv.x < 0.5) {
    color = textureSampleLevel(leftTexture, presentSampler, panelUv, 0.0).xyz;
  } else {
    color = sampleRightPixel(panelUv);
  }

  let divider = smoothstep(0.498, 0.5, input.uv.x) * (1.0 - smoothstep(0.5, 0.502, input.uv.x));
  let mapped = tonemap(color, exposure) + vec3f(1.0, 0.72, 0.45) * divider;
  return vec4f(mapped, 1.0);
}
