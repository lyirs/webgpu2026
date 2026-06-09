struct PresentUniforms {
  texelSize: vec2f,
  focusDistance: f32,
  aperture: f32,
  maxBlurRadius: f32,
  focusDebug: f32,
  dividerSoftness: f32,
  reserved0: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;
@group(0) @binding(2) var cocTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> presentUniforms: PresentUniforms;

fn cocValue(uv: vec2f) -> f32 {
  return textureSampleLevel(cocTexture, presentSampler, uv, 0.0).x;
}

fn cocVisualization(uv: vec2f) -> vec3f {
  let coc = cocValue(uv);
  let magnitude = clamp(abs(coc), 0.0, 1.0);
  let nearColor = vec3f(1.0, 0.76, 0.48);
  let farColor = vec3f(0.54, 0.72, 1.0);
  let neutral = vec3f(0.15, 0.18, 0.22);
  var color = mix(neutral, select(farColor, nearColor, coc < 0.0), magnitude);

  if (presentUniforms.focusDebug > 0.5 && abs(coc) < 0.06) {
    color = mix(color, vec3f(0.56, 1.0, 0.74), 0.75);
  }

  return color;
}

fn sampleDof(uv: vec2f) -> vec3f {
  let baseColor = textureSampleLevel(colorTexture, presentSampler, uv, 0.0).rgb;
  let centerCoc = cocValue(uv);
  let radius = abs(centerCoc) * presentUniforms.maxBlurRadius;

  if (radius < 0.6) {
    return baseColor;
  }

  let texelRadius = radius * presentUniforms.texelSize;
  let signValue = select(-1.0, 1.0, centerCoc > 0.0);

  let kernel = array(
    vec2f(1.0, 0.0),
    vec2f(0.5, 0.866),
    vec2f(-0.5, 0.866),
    vec2f(-1.0, 0.0),
    vec2f(-0.5, -0.866),
    vec2f(0.5, -0.866),
    vec2f(0.0, 1.2),
    vec2f(0.0, -1.2),
    vec2f(1.16, 0.56),
    vec2f(-1.16, 0.56),
    vec2f(-1.16, -0.56),
    vec2f(1.16, -0.56)
  );

  var accum = baseColor;
  var weight = 1.0;

  for (var index = 0; index < 12; index += 1) {
    let sampleUv = clamp(uv + kernel[index] * texelRadius, vec2f(0.0), vec2f(1.0));
    let sampleCoc = cocValue(sampleUv);

    if (sampleCoc * signValue < -0.03) {
      continue;
    }

    accum += textureSampleLevel(colorTexture, presentSampler, sampleUv, 0.0).rgb;
    weight += 1.0;
  }

  let blurred = accum / weight;
  let mixAmount = clamp(abs(centerCoc), 0.0, 1.0);
  return mix(baseColor, blurred, mixAmount);
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var clip = array(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let clipPosition = clip[vertexIndex];
  var output: VertexOutput;
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let third = 1.0 / 3.0;
  let panelIndex = select(select(1u, 2u, input.uv.x >= third * 2.0), 0u, input.uv.x < third);
  let panelUv = vec2f(
    select(
      select((input.uv.x - third * 2.0) * 3.0, (input.uv.x - third) * 3.0, panelIndex == 1u),
      input.uv.x * 3.0,
      panelIndex == 0u
    ),
    input.uv.y
  );

  let rawColor = textureSampleLevel(colorTexture, presentSampler, panelUv, 0.0).rgb;
  let cocColor = cocVisualization(panelUv);
  let dofColor = sampleDof(panelUv);
  let panelColor = select(select(dofColor, cocColor, panelIndex == 1u), rawColor, panelIndex == 0u);

  let dividerA =
    smoothstep(third - presentUniforms.dividerSoftness, third, input.uv.x) -
    smoothstep(third, third + presentUniforms.dividerSoftness, input.uv.x);
  let dividerB =
    smoothstep(third * 2.0 - presentUniforms.dividerSoftness, third * 2.0, input.uv.x) -
    smoothstep(third * 2.0, third * 2.0 + presentUniforms.dividerSoftness, input.uv.x);
  let dividerMix = clamp(dividerA + dividerB, 0.0, 1.0);
  let shaded = mix(panelColor, vec3f(1.0, 0.72, 0.5), dividerMix);
  return vec4f(shaded, 1.0);
}
