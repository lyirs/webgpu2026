struct PresentUniforms {
  panelInfo: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var linearDepthTexture: texture_2d<f32>;
@group(0) @binding(3) var<storage, read> currentPixels: array<vec4f>;
@group(0) @binding(4) var<storage, read> accumulatedPixels: array<vec4f>;
@group(0) @binding(5) var<uniform> presentUniforms: PresentUniforms;

fn tonemap(color: vec3f, exposure: f32) -> vec3f {
  let mapped = color * exposure;
  let reinhard = mapped / (1.0 + mapped);
  return pow(reinhard, vec3f(1.0 / 2.2));
}

fn readBufferPixel(bufferIndex: u32, x: u32, y: u32, width: u32) -> vec3f {
  let index = y * width + x;
  if (bufferIndex == 0u) {
    return currentPixels[index].xyz;
  }
  return accumulatedPixels[index].xyz;
}

fn readCurrent(panelUv: vec2f) -> vec3f {
  let width = u32(presentUniforms.panelInfo.x);
  let height = u32(presentUniforms.panelInfo.y);
  let x = min(u32(panelUv.x * f32(width)), max(width, 1u) - 1u);
  let y = min(u32(panelUv.y * f32(height)), max(height, 1u) - 1u);
  return currentPixels[y * width + x].xyz;
}

fn readAccumulated(panelUv: vec2f) -> vec3f {
  let width = u32(presentUniforms.panelInfo.x);
  let height = u32(presentUniforms.panelInfo.y);
  let x = min(u32(panelUv.x * f32(width)), max(width, 1u) - 1u);
  let y = min(u32(panelUv.y * f32(height)), max(height, 1u) - 1u);
  return accumulatedPixels[y * width + x].xyz;
}

fn denoiseAccumulated(panelUv: vec2f) -> vec3f {
  let width = u32(presentUniforms.panelInfo.x);
  let height = u32(presentUniforms.panelInfo.y);
  let strength = presentUniforms.panelInfo.z;
  let resolution = vec2f(f32(width), f32(height));
  let coord = clamp(panelUv, vec2f(0.0), vec2f(0.9999));
  let pixel = vec2u(coord * resolution);
  let centerNormal = normalize(textureSampleLevel(normalTexture, presentSampler, coord, 0.0).xyz * 2.0 - 1.0);
  let centerDepth = textureSampleLevel(linearDepthTexture, presentSampler, coord, 0.0).x;
  var color = readAccumulated(coord);
  var weightSum = 1.0;

  let offsets = array<vec2i, 8>(
    vec2i(1, 0),
    vec2i(-1, 0),
    vec2i(0, 1),
    vec2i(0, -1),
    vec2i(2, 0),
    vec2i(-2, 0),
    vec2i(0, 2),
    vec2i(0, -2)
  );

  for (var index = 0u; index < 8u; index += 1u) {
    let offset = offsets[index];
    let nx = clamp(i32(pixel.x) + offset.x, 0, i32(width) - 1);
    let ny = clamp(i32(pixel.y) + offset.y, 0, i32(height) - 1);
    let neighborUv = (vec2f(f32(nx) + 0.5, f32(ny) + 0.5)) / resolution;
    let neighborNormal = normalize(textureSampleLevel(normalTexture, presentSampler, neighborUv, 0.0).xyz * 2.0 - 1.0);
    let neighborDepth = textureSampleLevel(linearDepthTexture, presentSampler, neighborUv, 0.0).x;
    let normalWeight = pow(max(dot(centerNormal, neighborNormal), 0.0), mix(6.0, 28.0, strength));
    let depthWeight = exp(-abs(neighborDepth - centerDepth) * mix(18.0, 64.0, strength));
    let spatialWeight = select(0.5, 1.0, index < 4u);
    let weight = normalWeight * depthWeight * spatialWeight;
    color += readBufferPixel(1u, u32(nx), u32(ny), width) * weight;
    weightSum += weight;
  }

  let filtered = color / max(weightSum, 1e-5);
  return mix(readAccumulated(coord), filtered, strength);
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
  let panelUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let exposure = presentUniforms.panelInfo.w;

  var color = vec3f(0.0);
  if (input.uv.x < 0.33333334) {
    color = readCurrent(panelUv);
  } else if (input.uv.x < 0.6666667) {
    color = readAccumulated(panelUv);
  } else {
    color = denoiseAccumulated(panelUv);
  }

  let dividerLeft = smoothstep(0.331, 0.33333334, input.uv.x) * (1.0 - smoothstep(0.33333334, 0.3355, input.uv.x));
  let dividerRight = smoothstep(0.664, 0.6666667, input.uv.x) * (1.0 - smoothstep(0.6666667, 0.669, input.uv.x));
  let divider = dividerLeft + dividerRight;
  let mapped = tonemap(color, exposure) + vec3f(1.0, 0.72, 0.45) * divider;
  return vec4f(mapped, 1.0);
}
