struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
  volumeParams: vec4f,
  animationParams: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) localPosition: vec3f,
  @location(3) objectColor: vec4f,
  @location(4) surfaceParams: vec4f,
};

const MAX_RAY_STEPS = 160u;

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
@group(2) @binding(0) var volumeTexture: texture_3d<f32>;
@group(2) @binding(1) var volumeSampler: sampler;

fn safeInverseDirection(direction: vec3f) -> vec3f {
  let fallback = vec3f(0.0001, 0.0001, 0.0001);
  let safeDirection = select(direction, fallback, abs(direction) < vec3f(0.0001));
  return 1.0 / safeDirection;
}

fn intersectBox(origin: vec3f, direction: vec3f) -> vec2f {
  let inverseDirection = safeInverseDirection(direction);
  let boxMin = vec3f(-1.0, -1.0, -1.0);
  let boxMax = vec3f(1.0, 1.0, 1.0);
  let t0 = (boxMin - origin) * inverseDirection;
  let t1 = (boxMax - origin) * inverseDirection;
  let tMin = min(t0, t1);
  let tMax = max(t0, t1);
  return vec2f(
    max(max(tMin.x, tMin.y), tMin.z),
    min(min(tMax.x, tMax.y), tMax.z)
  );
}

fn densityColor(density: f32, sliceBoost: f32) -> vec3f {
  let cool = mix(vec3f(0.05, 0.11, 0.18), vec3f(0.20, 0.86, 1.0), clamp(density * 1.2, 0.0, 1.0));
  let warm = vec3f(1.0, 0.72, 0.34) * smoothstep(0.34, 0.92, density) * 0.68;
  let highlight = vec3f(1.0, 0.87, 0.48) * sliceBoost;
  return cool + warm + highlight;
}

@fragment
fn volumeFragment(input: FragmentInput) -> @location(0) vec4f {
  let sliceDepth = sceneUniforms.volumeParams.x;
  let densityGain = sceneUniforms.volumeParams.y;
  let requestedSteps = max(1u, u32(sceneUniforms.volumeParams.z));

  let rayDirection = normalize(input.localPosition - sceneUniforms.eyePosition.xyz);
  let marchOrigin = input.localPosition + rayDirection * 0.006;
  let hit = intersectBox(marchOrigin, rayDirection);

  if (hit.y <= 0.0 || hit.x > hit.y) {
    discard;
  }

  let entryDistance = max(0.0, hit.x);
  let totalDistance = max(0.0, hit.y - entryDistance);

  if (totalDistance <= 0.0001) {
    discard;
  }

  let clampedSteps = min(requestedSteps, MAX_RAY_STEPS);
  let stepDistance = totalDistance / f32(clampedSteps);

  var accumulatedColor = vec3f(0.0, 0.0, 0.0);
  var accumulatedAlpha = 0.0;
  var distanceTravelled = entryDistance + stepDistance * 0.5;

  for (var step = 0u; step < MAX_RAY_STEPS; step += 1u) {
    if (step >= clampedSteps || accumulatedAlpha > 0.985) {
      break;
    }

    let samplePosition = marchOrigin + rayDirection * distanceTravelled;
    let uvw = samplePosition * 0.5 + 0.5;
    let rawDensity = textureSampleLevel(volumeTexture, volumeSampler, uvw, 0.0).r;
    let shapedDensity = max(0.0, rawDensity - 0.1) * densityGain;

    if (shapedDensity > 0.0001) {
      let sliceBoost = smoothstep(0.12, 0.0, abs(samplePosition.z - sliceDepth)) * 0.48;
      let sampleColor = densityColor(rawDensity, sliceBoost);
      let sampleAlpha = 1.0 - exp(-shapedDensity * 3.4 * stepDistance);
      let contribution = (1.0 - accumulatedAlpha) * sampleAlpha;
      accumulatedColor += sampleColor * contribution;
      accumulatedAlpha += contribution;
    }

    distanceTravelled += stepDistance;
  }

  if (accumulatedAlpha <= 0.003) {
    discard;
  }

  return vec4f(accumulatedColor, accumulatedAlpha);
}
