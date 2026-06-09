struct RingUniforms {
  time: f32,
  ringSlot: f32,
  objectCount: f32,
  generation: f32,
};

@group(0) @binding(0) var<uniform> ringUniforms: RingUniforms;
@group(1) @binding(0) var presentSampler: sampler;
@group(1) @binding(1) var presentTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) localUv: vec2f,
  @location(1) tint: vec3f,
};

@vertex
fn vsScene(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  let gridX = f32(instanceIndex % 12u);
  let gridY = f32(instanceIndex / 12u);
  let wobble = vec2f(
    sin(ringUniforms.time * 1.7 + f32(instanceIndex) * 0.31),
    cos(ringUniforms.time * 1.2 + f32(instanceIndex) * 0.19)
  ) * 0.025;
  let cell = vec2f((gridX + 0.5) / 12.0, (gridY + 0.5) / 8.0);
  let size = 0.052 + 0.018 * sin(ringUniforms.time + f32(instanceIndex) * 0.5);
  let position = (cell * 2.0 - vec2f(1.0)) + quad[vertexIndex] * size + wobble;
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.localUv = quad[vertexIndex] * 0.5 + vec2f(0.5);
  output.tint = 0.45 + 0.45 * cos(vec3f(0.0, 1.7, 3.4) + f32(instanceIndex) * 0.37 + ringUniforms.ringSlot);
  return output;
}

@fragment
fn fsScene(input: VertexOutput) -> @location(0) vec4f {
  let edge = smoothstep(0.52, 0.48, distance(input.localUv, vec2f(0.5)));
  let generationPulse = 0.1 * sin(ringUniforms.generation * 1.7);
  return vec4f(input.tint * edge + generationPulse, 1.0);
}

struct PresentOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsPresent(@builtin(vertex_index) vertexIndex: u32) -> PresentOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];
  var output: PresentOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5);
  return output;
}

@fragment
fn fsPresent(input: PresentOutput) -> @location(0) vec4f {
  let color = textureSample(presentTexture, presentSampler, input.uv).rgb;
  let vignette = smoothstep(0.92, 0.22, distance(input.uv, vec2f(0.5)));
  return vec4f(color * (0.62 + 0.38 * vignette), 1.0);
}
