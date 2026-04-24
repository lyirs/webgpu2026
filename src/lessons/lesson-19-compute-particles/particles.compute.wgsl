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

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

const workgroupSize = 64u;

@compute @workgroup_size(workgroupSize)
fn csMain(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let particleIndex = globalId.x;

  if (particleIndex >= u32(params.particleCount)) {
    return;
  }

  var particle = particles[particleIndex];
  let size = particle.colorAndSize.w;

  particle.position += particle.velocity * params.deltaTime;

  if (particle.position.x < -params.bounds.x + size) {
    particle.position.x = -params.bounds.x + size;
    particle.velocity.x = -particle.velocity.x;
  } else if (particle.position.x > params.bounds.x - size) {
    particle.position.x = params.bounds.x - size;
    particle.velocity.x = -particle.velocity.x;
  }

  if (particle.position.y < -params.bounds.y + size) {
    particle.position.y = -params.bounds.y + size;
    particle.velocity.y = -particle.velocity.y;
  } else if (particle.position.y > params.bounds.y - size) {
    particle.position.y = params.bounds.y - size;
    particle.velocity.y = -particle.velocity.y;
  }

  particles[particleIndex] = particle;
}
