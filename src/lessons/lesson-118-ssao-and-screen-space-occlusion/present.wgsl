struct PresentUniforms {
  lightDirection: vec4f,
  ambientColor: vec4f,
  params: vec4f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var albedoTexture: texture_2d<f32>;
@group(0) @binding(2) var normalTexture: texture_2d<f32>;
@group(0) @binding(3) var viewPositionTexture: texture_2d<f32>;
@group(0) @binding(4) var rawAoTexture: texture_2d<f32>;
@group(0) @binding(5) var blurredAoTexture: texture_2d<f32>;
@group(0) @binding(6) var<uniform> presentUniforms: PresentUniforms;

struct FullscreenOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

fn trianglePosition(vertexIndex: u32) -> vec2f {
  switch vertexIndex {
    case 0u: {
      return vec2f(-1.0, -1.0);
    }
    case 1u: {
      return vec2f(3.0, -1.0);
    }
    default: {
      return vec2f(-1.0, 3.0);
    }
  }
}

fn decodeNormal(encoded: vec3f) -> vec3f {
  return normalize(encoded * 2.0 - 1.0);
}

fn linearToSrgb(color: vec3f) -> vec3f {
  return pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.2));
}

fn backdropColor(uv: vec2f) -> vec3f {
  let top = vec3f(0.12, 0.08, 0.12);
  let bottom = vec3f(0.03, 0.05, 0.08);
  return mix(bottom, top, pow(1.0 - uv.y, 1.1));
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> FullscreenOutput {
  let clipPosition = trianglePosition(vertexIndex);
  var output: FullscreenOutput;
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  return output;
}

@fragment
fn fsMain(input: FullscreenOutput) -> @location(0) vec4f {
  let leftPanel = input.uv.x < 0.5;
  var panelUv = input.uv;
  if (leftPanel) {
    panelUv.x = input.uv.x * 2.0;
  } else {
    panelUv.x = (input.uv.x - 0.5) * 2.0;
  }

  let albedo =
    textureSampleLevel(albedoTexture, presentSampler, panelUv, 0.0).rgb;
  let viewPosition =
    textureSampleLevel(viewPositionTexture, presentSampler, panelUv, 0.0).xyz;

  if (length(viewPosition) < 0.0001) {
    var backdrop = backdropColor(panelUv);
    if (abs(input.uv.x - 0.5) < 0.0025) {
      backdrop = vec3f(0.97, 0.67, 0.42);
    }
    return vec4f(backdrop, 1.0);
  }

  let normal = decodeNormal(
    textureSampleLevel(normalTexture, presentSampler, panelUv, 0.0).xyz
  );
  let rawAo =
    textureSampleLevel(rawAoTexture, presentSampler, panelUv, 0.0).r;
  let blurredAo =
    textureSampleLevel(blurredAoTexture, presentSampler, panelUv, 0.0).r;
  let ssao = mix(rawAo, blurredAo, presentUniforms.params.y);
  let occlusion = pow(clamp(ssao, 0.0, 1.0), presentUniforms.params.x);

  let lightDirection = normalize(presentUniforms.lightDirection.xyz);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let ambient = select(
    presentUniforms.ambientColor.rgb,
    presentUniforms.ambientColor.rgb * occlusion,
    !leftPanel
  );
  let direct = vec3f(0.92, 0.88, 0.8) * (lambert * 0.88 + 0.06);
  let fill = vec3f(0.18, 0.22, 0.31) * max(normal.y, 0.0) * 0.32;
  var color = linearToSrgb(albedo * (ambient + direct + fill));

  if (abs(input.uv.x - 0.5) < 0.0025) {
    color = vec3f(0.97, 0.67, 0.42);
  }

  return vec4f(color, 1.0);
}
