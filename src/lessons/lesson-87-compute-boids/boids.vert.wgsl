struct SimulationUniforms {
  paramsA: vec4f,
  paramsB: vec4f,
};

struct Boid {
  motion: vec4f,
  colorSize: vec4f,
};

@group(0) @binding(0) var<uniform> simulationUniforms: SimulationUniforms;
@group(0) @binding(1) var<storage, read> boids: array<Boid>;

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) color: vec4f,
  @location(1) facingAmount: f32,
};

const localTriangle = array<vec2f, 3>(
  vec2f(0.0, 1.2),
  vec2f(-0.62, -0.8),
  vec2f(0.62, -0.8),
);

@vertex
fn vsMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let boid = boids[instanceIndex];
  let velocity = boid.motion.zw;
  let forward = normalize(select(vec2f(0.0, 1.0), velocity, length(velocity) > 0.0001));
  let side = vec2f(-forward.y, forward.x);
  let scale = boid.colorSize.w;
  let local = localTriangle[vertexIndex];
  let worldPosition =
    boid.motion.xy + side * local.x * scale + forward * local.y * scale;

  var output: VertexOutput;
  output.clipPosition = vec4f(worldPosition, 0.0, 1.0);
  output.color = vec4f(boid.colorSize.rgb, 1.0);
  output.facingAmount = local.y;
  return output;
}
