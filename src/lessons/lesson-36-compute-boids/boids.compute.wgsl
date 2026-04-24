struct SimulationUniforms {
  paramsA: vec4f,
  paramsB: vec4f,
};

struct Boid {
  motion: vec4f,
  colorSize: vec4f,
};

@group(0) @binding(0) var<uniform> simulationUniforms: SimulationUniforms;
@group(0) @binding(1) var<storage, read> currentBoids: array<Boid>;
@group(0) @binding(2) var<storage, read_write> nextBoids: array<Boid>;

fn limitVector(vector: vec2f, maxLength: f32) -> vec2f {
  let lengthValue = length(vector);
  if (lengthValue > maxLength && lengthValue > 0.0001) {
    return normalize(vector) * maxLength;
  }

  return vector;
}

fn wrapAxis(value: f32, bounds: f32) -> f32 {
  if (value > bounds) {
    return -bounds;
  }
  if (value < -bounds) {
    return bounds;
  }
  return value;
}

@compute @workgroup_size(64, 1, 1)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let boidCount = u32(simulationUniforms.paramsA.y);
  if (globalId.x >= boidCount) {
    return;
  }

  let deltaTime = simulationUniforms.paramsA.x;
  let alignmentRadius = simulationUniforms.paramsA.z;
  let cohesionRadius = simulationUniforms.paramsA.w;
  let separationRadius = simulationUniforms.paramsB.x;
  let maxSpeed = simulationUniforms.paramsB.y;
  let maxForce = simulationUniforms.paramsB.z;
  let bounds = simulationUniforms.paramsB.w;

  let currentBoid = currentBoids[globalId.x];
  let position = currentBoid.motion.xy;
  let velocity = currentBoid.motion.zw;

  var alignmentSum = vec2f(0.0, 0.0);
  var cohesionSum = vec2f(0.0, 0.0);
  var separationSum = vec2f(0.0, 0.0);
  var alignmentCount = 0.0;
  var cohesionCount = 0.0;
  var separationCount = 0.0;

  for (var index = 0u; index < boidCount; index = index + 1u) {
    if (index == globalId.x) {
      continue;
    }

    let otherBoid = currentBoids[index];
    let offset = otherBoid.motion.xy - position;
    let distanceToNeighbor = length(offset);

    if (distanceToNeighbor < 0.0001) {
      continue;
    }

    if (distanceToNeighbor < alignmentRadius) {
      alignmentSum = alignmentSum + otherBoid.motion.zw;
      alignmentCount = alignmentCount + 1.0;
    }

    if (distanceToNeighbor < cohesionRadius) {
      cohesionSum = cohesionSum + otherBoid.motion.xy;
      cohesionCount = cohesionCount + 1.0;
    }

    if (distanceToNeighbor < separationRadius) {
      separationSum =
        separationSum -
        normalize(offset) * (separationRadius - distanceToNeighbor) / separationRadius;
      separationCount = separationCount + 1.0;
    }
  }

  var steering = vec2f(0.0, 0.0);

  if (alignmentCount > 0.0) {
    let desired =
      normalize(alignmentSum / alignmentCount) * maxSpeed;
    steering = steering + limitVector(desired - velocity, maxForce) * 0.82;
  }

  if (cohesionCount > 0.0) {
    let cohesionTarget = cohesionSum / cohesionCount;
    let desired = normalize(cohesionTarget - position) * maxSpeed;
    steering = steering + limitVector(desired - velocity, maxForce) * 0.5;
  }

  if (separationCount > 0.0) {
    let desired = normalize(separationSum / separationCount) * maxSpeed;
    steering = steering + limitVector(desired - velocity, maxForce) * 1.25;
  }

  let centerPull = -position * 0.18;
  steering = steering + limitVector(centerPull, maxForce * 0.5);

  var nextVelocity = velocity + steering * deltaTime * 28.0;
  nextVelocity = limitVector(nextVelocity, maxSpeed);
  if (length(nextVelocity) < 0.04) {
    nextVelocity = normalize(velocity + vec2f(0.0001, 0.0)) * 0.04;
  }

  let nextPosition = vec2f(
    wrapAxis(position.x + nextVelocity.x * deltaTime, bounds),
    wrapAxis(position.y + nextVelocity.y * deltaTime, bounds * 0.72)
  );

  nextBoids[globalId.x].motion = vec4f(nextPosition, nextVelocity);
  nextBoids[globalId.x].colorSize = currentBoid.colorSize;
}
