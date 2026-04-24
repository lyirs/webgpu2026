struct SimParams {
  deltaTime: f32,
  particleCount: f32,
  bounds: vec2f,
};

struct Particle {
  position: vec2f,
  velocity: vec2f,
  colorAndSize: vec4f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) particleColor: vec3f,
  @location(1) localUv: vec2f,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

fn quadCorner(vertexIndex: u32) -> vec2f {
  switch vertexIndex {
    case 0u: {
      return vec2f(-1.0, -1.0);
    }
    case 1u: {
      return vec2f(1.0, -1.0);
    }
    case 2u: {
      return vec2f(-1.0, 1.0);
    }
    case 3u: {
      return vec2f(-1.0, 1.0);
    }
    case 4u: {
      return vec2f(1.0, -1.0);
    }
    default: {
      return vec2f(1.0, 1.0);
    }
  }
}

@vertex
fn vsMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let particle = particles[instanceIndex];
  let aspect = params.bounds.x / params.bounds.y;
  let size = particle.colorAndSize.w;
  let localPosition = quadCorner(vertexIndex) * vec2f(size / aspect, size);
  var output: VertexOutput;
  output.clipPosition = vec4f(particle.position + localPosition, 0.0, 1.0);
  output.particleColor = particle.colorAndSize.xyz;
  output.localUv = quadCorner(vertexIndex) * 0.5 + vec2f(0.5, 0.5);
  return output;
}
