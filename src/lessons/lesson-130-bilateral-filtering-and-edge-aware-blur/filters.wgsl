struct RawUniforms {
  invTexelSize: vec2f,
  radius: f32,
  noiseAmount: f32,
};

struct BlurUniforms {
  invTexelSize: vec2f,
  radius: f32,
  _padding: f32,
};

struct EdgeUniforms {
  invTexelSize: vec2f,
  radius: f32,
  depthSigma: f32,
  normalSigma: f32,
  _padding: vec3f,
};

@group(0) @binding(0) var normalTexture: texture_2d<f32>;
@group(0) @binding(1) var positionTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var<uniform> rawUniforms: RawUniforms;

@group(0) @binding(0) var rawTexture: texture_2d<f32>;
@group(0) @binding(1) var rawSampler: sampler;
@group(0) @binding(2) var<uniform> blurUniforms: BlurUniforms;

@group(0) @binding(0) var edgeRawTexture: texture_2d<f32>;
@group(0) @binding(1) var edgePositionTexture: texture_2d<f32>;
@group(0) @binding(2) var edgeNormalTexture: texture_2d<f32>;
@group(0) @binding(3) var edgeSampler: sampler;
@group(0) @binding(4) var<uniform> edgeUniforms: EdgeUniforms;

@group(0) @binding(0) var presentColorTexture: texture_2d<f32>;
@group(0) @binding(1) var presentRawTexture: texture_2d<f32>;
@group(0) @binding(2) var presentPlainTexture: texture_2d<f32>;
@group(0) @binding(3) var presentEdgeTexture: texture_2d<f32>;
@group(0) @binding(4) var presentSampler: sampler;

fn decodeNormal(encoded: vec3f) -> vec3f {
  return normalize(encoded * 2.0 - 1.0);
}

fn hash12(value: vec2f) -> f32 {
  let seed = dot(value, vec2f(127.1, 311.7));
  return fract(sin(seed) * 43758.5453123);
}

fn panelInfo(uv: vec2f, columns: f32) -> vec3f {
  let scaled = uv.x * columns;
  let index = floor(scaled);
  let panelUv = vec2f(fract(scaled), uv.y);
  return vec3f(index, panelUv);
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn rawFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy * rawUniforms.invTexelSize;
  let centerPosition = textureSampleLevel(positionTexture, linearSampler, uv, 0.0).xyz;
  if (length(centerPosition) < 0.0001) {
    return vec4f(1.0);
  }

  let centerNormal = decodeNormal(
    textureSampleLevel(normalTexture, linearSampler, uv, 0.0).xyz
  );
  let offsets = array<vec2f, 8>(
    vec2f(-1.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, -1.0),
    vec2f(0.0, 1.0),
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, 1.0),
  );

  var occlusion = 0.0;
  for (var index = 0u; index < 8u; index += 1u) {
    let offset = offsets[index];
    let jitter = mix(0.72, 1.28, hash12(uv * 127.0 + offset * 19.0));
    let sampleUv = clamp(
      uv + offset * rawUniforms.invTexelSize * rawUniforms.radius * jitter,
      vec2f(0.001),
      vec2f(0.999),
    );
    let samplePosition = textureSampleLevel(positionTexture, linearSampler, sampleUv, 0.0).xyz;
    if (length(samplePosition) < 0.0001) {
      continue;
    }

    let delta = samplePosition - centerPosition;
    let distance = max(length(delta), 0.0001);
    let direction = delta / distance;
    let horizon = max(dot(centerNormal, direction) - 0.08, 0.0);
    let rangeWeight = exp(-distance * 2.8);
    occlusion += horizon * rangeWeight;
  }

  var value = clamp(1.0 - occlusion / 1.7, 0.0, 1.0);
  let noise = (hash12(uv * 421.0) - 0.5) * rawUniforms.noiseAmount * 0.34;
  value = clamp(value + noise, 0.0, 1.0);
  return vec4f(vec3f(value), 1.0);
}

@fragment
fn plainBlurFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy * blurUniforms.invTexelSize;
  let offsets = array<vec2f, 9>(
    vec2f(-1.0, -1.0),
    vec2f(0.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(-1.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
  );

  var total = 0.0;
  for (var index = 0u; index < 9u; index += 1u) {
    let sampleUv = clamp(
      uv + offsets[index] * blurUniforms.invTexelSize * blurUniforms.radius,
      vec2f(0.001),
      vec2f(0.999),
    );
    total += textureSampleLevel(rawTexture, rawSampler, sampleUv, 0.0).x;
  }

  let blurred = total / 9.0;
  return vec4f(vec3f(blurred), 1.0);
}

@fragment
fn edgeAwareFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy * edgeUniforms.invTexelSize;
  let centerPosition = textureSampleLevel(edgePositionTexture, edgeSampler, uv, 0.0).xyz;
  if (length(centerPosition) < 0.0001) {
    return vec4f(1.0);
  }

  let centerNormal = decodeNormal(
    textureSampleLevel(edgeNormalTexture, edgeSampler, uv, 0.0).xyz
  );
  let centerValue = textureSampleLevel(edgeRawTexture, edgeSampler, uv, 0.0).x;
  let offsets = array<vec2f, 9>(
    vec2f(-1.0, -1.0),
    vec2f(0.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(-1.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
  );

  var totalWeight = 1.0;
  var totalValue = centerValue;
  for (var index = 0u; index < 9u; index += 1u) {
    let offset = offsets[index];
    if (all(offset == vec2f(0.0))) {
      continue;
    }
    let sampleUv = clamp(
      uv + offset * edgeUniforms.invTexelSize * edgeUniforms.radius,
      vec2f(0.001),
      vec2f(0.999),
    );
    let sampleValue = textureSampleLevel(edgeRawTexture, edgeSampler, sampleUv, 0.0).x;
    let samplePosition = textureSampleLevel(edgePositionTexture, edgeSampler, sampleUv, 0.0).xyz;
    let sampleNormal = decodeNormal(
      textureSampleLevel(edgeNormalTexture, edgeSampler, sampleUv, 0.0).xyz
    );
    if (length(samplePosition) < 0.0001) {
      continue;
    }

    let depthDiff = length(samplePosition - centerPosition);
    let normalDiff = 1.0 - max(dot(centerNormal, sampleNormal), 0.0);
    let spatialWeight = exp(-dot(offset, offset) * 0.65);
    let depthWeight = exp(-depthDiff * edgeUniforms.depthSigma * 3.2);
    let normalWeight = exp(-normalDiff * edgeUniforms.normalSigma * 8.0);
    let weight = spatialWeight * depthWeight * normalWeight;
    totalValue += sampleValue * weight;
    totalWeight += weight;
  }

  let filtered = totalValue / max(totalWeight, 0.0001);
  return vec4f(vec3f(filtered), 1.0);
}

@fragment
fn presentFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let size = vec2f(textureDimensions(presentColorTexture));
  let uv = position.xy / size;
  let info = panelInfo(uv, 3.0);
  let panelIndex = i32(info.x);
  let panelUv = info.yz;

  let baseColor = textureSampleLevel(presentColorTexture, presentSampler, panelUv, 0.0).rgb;
  let rawValue = textureSampleLevel(presentRawTexture, presentSampler, panelUv, 0.0).x;
  let plainValue = textureSampleLevel(presentPlainTexture, presentSampler, panelUv, 0.0).x;
  let edgeValue = textureSampleLevel(presentEdgeTexture, presentSampler, panelUv, 0.0).x;
  var ao = rawValue;
  if (panelIndex == 1) {
    ao = plainValue;
  } else if (panelIndex == 2) {
    ao = edgeValue;
  }

  let shaded = baseColor * ao;
  let grayscale = vec3f(ao);
  var color = mix(shaded, grayscale, 0.18);

  let separator = smoothstep(0.494, 0.5, abs(fract(uv.x * 3.0) - 0.5));
  color = mix(color, vec3f(1.0, 0.69, 0.4), separator * 0.9);

  let vignette = smoothstep(0.95, 0.28, distance(panelUv, vec2f(0.5, 0.5)));
  color *= mix(0.9, 1.0, vignette);
  return vec4f(color, 1.0);
}
