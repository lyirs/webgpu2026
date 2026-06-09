struct ShadowUniforms {
  projectionMatrix: mat4x4f,
  lightDirectionView: vec3f,
  rayLength: f32,
  stepCount: f32,
  thickness: f32,
  shadowStrength: f32,
  _padding: vec2f,
};

@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var positionTexture: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<uniform> shadowUniforms: ShadowUniforms;

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
  let clipPosition = shadowUniforms.projectionMatrix * vec4f(position, 1.0);
  if (clipPosition.w <= 0.0001) {
    return vec2f(-1.0);
  }
  let ndc = clipPosition.xy / clipPosition.w;
  return vec2f(ndc.x * 0.5 + 0.5, ndc.y * -0.5 + 0.5);
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
  let lightDirection = normalize(shadowUniforms.lightDirectionView);
  let NdotL = max(dot(centerNormal, -lightDirection), 0.0);
  if (NdotL <= 0.01) {
    return vec4f(baseColor, 1.0);
  }

  let startPosition = centerPosition + centerNormal * shadowUniforms.thickness * 1.2;
  var occluded = 0.0;
  for (var stepIndex = 0u; stepIndex < 24u; stepIndex += 1u) {
    if (f32(stepIndex) >= shadowUniforms.stepCount) {
      break;
    }
    let travel = shadowUniforms.rayLength * (f32(stepIndex) + 1.0) / max(shadowUniforms.stepCount, 1.0);
    let rayPosition = startPosition - lightDirection * travel;
    let sampleUv = projectViewPosition(rayPosition);
    if (any(sampleUv < vec2f(0.002)) || any(sampleUv > vec2f(0.998))) {
      continue;
    }
    let scenePosition = textureSampleLevel(positionTexture, linearSampler, sampleUv, 0.0).xyz;
    if (length(scenePosition) < 0.0001) {
      continue;
    }
    if (length(scenePosition - rayPosition) < shadowUniforms.thickness * 4.4) {
      occluded = 1.0;
      break;
    }
  }

  let shadowFactor = mix(1.0, 1.0 - shadowUniforms.shadowStrength, occluded);
  var color = baseColor * shadowFactor;
  let separator = smoothstep(0.494, 0.5, abs(fract(uv.x * 2.0) - 0.5));
  color = mix(color, vec3f(1.0, 0.69, 0.4), separator * 0.9);
  return vec4f(color, 1.0);
}
