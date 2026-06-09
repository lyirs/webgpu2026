struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
};

struct FieldUniforms {
  metaballs: array<vec4f, 4>,
  params: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) localPosition: vec3f,
  @location(3) objectColor: vec4f,
  @location(4) surfaceParams: vec4f,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
@group(2) @binding(0) var<uniform> fieldUniforms: FieldUniforms;

fn sampleField(position: vec3f) -> f32 {
  var density = 0.0;

  for (var index = 0u; index < 4u; index = index + 1u) {
    let metaball = fieldUniforms.metaballs[index];
    let delta = position - metaball.xyz;
    let radiusSq = max(metaball.w * metaball.w, 0.00001);
    density = density + exp(-dot(delta, delta) / radiusSq);
  }

  return density * fieldUniforms.params.y;
}

fn sampleGradient(position: vec3f) -> vec3f {
  let delta = 0.028;
  let dx = sampleField(position + vec3f(delta, 0.0, 0.0)) - sampleField(position - vec3f(delta, 0.0, 0.0));
  let dy = sampleField(position + vec3f(0.0, delta, 0.0)) - sampleField(position - vec3f(0.0, delta, 0.0));
  let dz = sampleField(position + vec3f(0.0, 0.0, delta)) - sampleField(position - vec3f(0.0, 0.0, delta));
  return vec3f(dx, dy, dz);
}

fn fieldPalette(fieldValue: f32, isoLevel: f32) -> vec3f {
  let normalized = clamp((fieldValue - isoLevel * 0.34) / max(isoLevel * 1.24, 0.0001), 0.0, 1.0);
  let cool = mix(vec3f(0.04, 0.08, 0.15), vec3f(0.18, 0.84, 1.0), normalized);
  let warm = vec3f(1.0, 0.72, 0.32) * smoothstep(0.42, 1.0, normalized) * 0.58;
  return cool + warm;
}

fn litStaticColor(input: FragmentInput) -> vec3f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(sceneUniforms.lightPosition.xyz - input.worldPosition);
  let viewDirection = normalize(sceneUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 28.0);
  let ambient = vec3f(0.08, 0.10, 0.14);

  var baseColor = input.objectColor.rgb;
  if (input.surfaceParams.x > 0.5) {
    let detailScale = max(0.0001, input.surfaceParams.y);
    let gridUv = abs(fract(input.worldPosition.xz * detailScale) - 0.5);
    let gridLine = 1.0 - smoothstep(0.45, 0.5, min(gridUv.x, gridUv.y));
    baseColor = baseColor + vec3f(0.14, 0.18, 0.24) * gridLine;
  }

  return ambient + baseColor * (0.24 + diffuse * 0.92) + vec3f(0.92) * specular * 0.18;
}

fn rayBoxIntersection(origin: vec3f, direction: vec3f) -> vec2f {
  let boxMin = vec3f(-1.0, -1.0, -1.0);
  let boxMax = vec3f(1.0, 1.0, 1.0);
  let safeDirection = vec3f(
    select(direction.x, 0.00001, abs(direction.x) < 0.00001),
    select(direction.y, 0.00001, abs(direction.y) < 0.00001),
    select(direction.z, 0.00001, abs(direction.z) < 0.00001)
  );
  let invDirection = 1.0 / safeDirection;
  let t0 = (boxMin - origin) * invDirection;
  let t1 = (boxMax - origin) * invDirection;
  let tMin3 = min(t0, t1);
  let tMax3 = max(t0, t1);
  let tMin = max(max(tMin3.x, tMin3.y), tMin3.z);
  let tMax = min(min(tMax3.x, tMax3.y), tMax3.z);
  return vec2f(tMin, tMax);
}

fn shadeFieldHit(hitPoint: vec3f, fieldValue: f32, tint: vec4f) -> vec4f {
  let isoLevel = fieldUniforms.params.x;
  let gradient = sampleGradient(hitPoint);
  let safeGradient =
    select(gradient, vec3f(0.0, 1.0, 0.0), length(gradient) < 0.0001);
  let normal = normalize(safeGradient);
  let lightDirection = normalize(sceneUniforms.lightPosition.xyz - hitPoint);
  let viewDirection = normalize(sceneUniforms.eyePosition.xyz - hitPoint);
  let halfVector = normalize(lightDirection + viewDirection);

  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 34.0);
  let rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  let baseColor = mix(fieldPalette(fieldValue, isoLevel), tint.rgb, 0.18);
  let color =
    baseColor * (0.18 + diffuse * 0.9) +
    vec3f(1.0, 0.98, 0.92) * specular * 0.2 +
    baseColor * rim * 0.22;

  return vec4f(color, clamp(tint.a, 0.18, 1.0));
}

@fragment
fn staticFragment(input: FragmentInput) -> @location(0) vec4f {
  return vec4f(litStaticColor(input), 1.0);
}

@fragment
fn sliceFragment(input: FragmentInput) -> @location(0) vec4f {
  let isoLevel = fieldUniforms.params.x;
  let sliceDepth = fieldUniforms.params.z;
  let samplePoint = vec3f(input.localPosition.xy, sliceDepth);
  let fieldValue = sampleField(samplePoint);
  let normalized = clamp(
    (fieldValue - isoLevel * 0.18) / max(isoLevel * 1.24, 0.0001),
    0.0,
    1.0
  );
  let isoBand = 1.0 - smoothstep(0.0, 0.055, abs(fieldValue - isoLevel));
  let gridUv = abs(fract((input.localPosition.xy * 0.5 + 0.5) * 18.0) - 0.5);
  let grid = 1.0 - smoothstep(0.42, 0.5, min(gridUv.x, gridUv.y));
  let frameFade = smoothstep(1.0, 0.82, max(abs(input.localPosition.x), abs(input.localPosition.y)));

  var color = mix(vec3f(0.02, 0.04, 0.08), fieldPalette(fieldValue, isoLevel), normalized);
  color = color + vec3f(1.0, 0.76, 0.32) * isoBand * 0.88;
  color = color + vec3f(0.18, 0.24, 0.28) * grid * 0.14;
  color = mix(color, color + input.objectColor.rgb * 0.16, 0.5);

  let alpha = max(0.22 + normalized * 0.68, isoBand * 0.92) * input.objectColor.a;
  return vec4f(color * frameFade, alpha * frameFade);
}

@fragment
fn fieldFragment(input: FragmentInput) -> @location(0) vec4f {
  let isoLevel = fieldUniforms.params.x;
  let entryPoint = clamp(input.localPosition, vec3f(-1.0), vec3f(1.0));
  let rayDirection = normalize(entryPoint - sceneUniforms.eyePosition.xyz);
  let hitRange = rayBoxIntersection(entryPoint + rayDirection * 0.0005, rayDirection);

  if (hitRange.y <= 0.0) {
    discard;
    return vec4f(0.0);
  }

  var previousPoint = entryPoint;
  var previousField = sampleField(previousPoint);

  if (previousField >= isoLevel) {
    return shadeFieldHit(previousPoint, previousField, input.objectColor);
  }

  let maxSteps = 92;
  let travelEnd = hitRange.y;
  let stepSize = max(travelEnd / f32(maxSteps), 0.02);
  var travel = stepSize;

  for (var step = 0; step < maxSteps; step = step + 1) {
    if (travel > travelEnd) {
      break;
    }

    let samplePoint = entryPoint + rayDirection * travel;
    let fieldValue = sampleField(samplePoint);

      if (fieldValue >= isoLevel) {
        let delta = max(fieldValue - previousField, 0.00001);
        let blend = clamp((isoLevel - previousField) / delta, 0.0, 1.0);
        let hitPoint = mix(previousPoint, samplePoint, blend);
        let hitField = sampleField(hitPoint);
      return shadeFieldHit(hitPoint, hitField, input.objectColor);
    }

    previousPoint = samplePoint;
    previousField = fieldValue;
    travel = travel + stepSize;
  }

  discard;
  return vec4f(0.0);
}
