struct SsgiUniforms {
  projectionMatrix: mat4x4f,
  maxSteps: f32,
  stepScale: f32,
  thickness: f32,
  indirectStrength: f32,
  _padding: vec4f,
};

@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var positionTexture: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<uniform> ssgiUniforms: SsgiUniforms;

fn decodeNormal(encoded: vec3f) -> vec3f {
  return normalize(encoded * 2.0 - 1.0);
}

fn panelInfo(uv: vec2f, columns: f32) -> vec3f {
  let scaled = uv.x * columns;
  let index = floor(scaled);
  let panelUv = vec2f(fract(scaled), uv.y);
  return vec3f(index, panelUv);
}

fn projectViewPosition(position: vec3f) -> vec2f {
  let clipPosition = ssgiUniforms.projectionMatrix * vec4f(position, 1.0);
  if (clipPosition.w <= 0.0001) {
    return vec2f(-1.0);
  }
  let ndc = clipPosition.xy / clipPosition.w;
  return vec2f(ndc.x * 0.5 + 0.5, ndc.y * -0.5 + 0.5);
}

fn tangentBasis(normal: vec3f) -> mat3x3f {
  let helper = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(normal.y) > 0.96);
  let tangent = normalize(cross(helper, normal));
  let bitangent = normalize(cross(normal, tangent));
  return mat3x3f(tangent, bitangent, normal);
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fsMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let size = vec2f(textureDimensions(colorTexture));
  let uv = position.xy / size;
  let info = panelInfo(uv, 2.0);
  let panelIndex = i32(info.x);
  let panelUv = info.yz;

  let baseColor = textureSampleLevel(colorTexture, linearSampler, panelUv, 0.0).rgb;
  if (panelIndex == 0) {
    let separator = smoothstep(0.494, 0.5, abs(fract(uv.x * 2.0) - 0.5));
    return vec4f(mix(baseColor, vec3f(1.0, 0.69, 0.4), separator * 0.9), 1.0);
  }

  let centerPosition = textureSampleLevel(positionTexture, linearSampler, panelUv, 0.0).xyz;
  if (length(centerPosition) < 0.0001) {
    return vec4f(baseColor, 1.0);
  }
  let centerNormal = decodeNormal(textureSampleLevel(normalTexture, linearSampler, panelUv, 0.0).xyz);
  let basis = tangentBasis(centerNormal);
  let rayDirections = array<vec3f, 4>(
    normalize(basis * vec3f(-0.32, 0.12, 1.0)),
    normalize(basis * vec3f(0.28, -0.14, 1.0)),
    normalize(basis * vec3f(-0.18, -0.28, 1.0)),
    normalize(basis * vec3f(0.36, 0.26, 1.0)),
  );

  var indirect = vec3f(0.0);
  var hitCount = 0.0;
  for (var rayIndex = 0u; rayIndex < 4u; rayIndex += 1u) {
    let rayDirection = rayDirections[rayIndex];
    for (var stepIndex = 0u; stepIndex < 24u; stepIndex += 1u) {
      if (f32(stepIndex) >= ssgiUniforms.maxSteps) {
        break;
      }
      let travel = ssgiUniforms.stepScale * (f32(stepIndex) + 1.0);
      let rayPosition = centerPosition + rayDirection * travel;
      let sampleUv = projectViewPosition(rayPosition);
      if (any(sampleUv < vec2f(0.001)) || any(sampleUv > vec2f(0.999))) {
        continue;
      }
      let scenePosition = textureSampleLevel(positionTexture, linearSampler, sampleUv, 0.0).xyz;
      if (length(scenePosition) < 0.0001) {
        continue;
      }
      let missDistance = length(scenePosition - rayPosition);
      if (missDistance < ssgiUniforms.thickness * 4.5) {
        let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUv, 0.0).rgb;
        let normalWeight = max(dot(centerNormal, normalize(scenePosition - centerPosition)), 0.0);
        indirect += sampleColor * (0.35 + normalWeight * 0.65);
        hitCount += 1.0;
        break;
      }
    }
  }

  let bounced = select(baseColor * 0.04, indirect / max(hitCount, 1.0), hitCount > 0.0);
  var finalColor = baseColor + bounced * ssgiUniforms.indirectStrength;
  finalColor = min(finalColor, vec3f(6.0));
  let separator = smoothstep(0.494, 0.5, abs(fract(uv.x * 2.0) - 0.5));
  finalColor = mix(finalColor, vec3f(1.0, 0.69, 0.4), separator * 0.9);
  return vec4f(finalColor, 1.0);
}
