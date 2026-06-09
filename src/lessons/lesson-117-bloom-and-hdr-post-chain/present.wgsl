struct PresentUniforms {
  params: vec4f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> presentUniforms: PresentUniforms;

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

fn linearToSrgb(color: vec3f) -> vec3f {
  return pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.2));
}

fn toneMapReinhard(color: vec3f) -> vec3f {
  return color / (vec3f(1.0) + color);
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

  let sceneHdr = textureSample(sceneTexture, presentSampler, panelUv).rgb;
  let bloomHdr = textureSample(bloomTexture, presentSampler, panelUv).rgb;
  let sceneBrightness = max(max(sceneHdr.r, sceneHdr.g), sceneHdr.b);
  let coreMask = smoothstep(
    presentUniforms.params.z * 0.72,
    presentUniforms.params.z * 1.4,
    sceneBrightness
  );
  let bloomContribution =
    bloomHdr * presentUniforms.params.y * (1.0 - coreMask * 0.97);
  let hdrColor = select(
    sceneHdr,
    sceneHdr + bloomContribution,
    !leftPanel
  );
  var color = linearToSrgb(toneMapReinhard(hdrColor * presentUniforms.params.x));

  if (abs(input.uv.x - 0.5) < 0.0025) {
    color = vec3f(0.97, 0.67, 0.42);
  }

  return vec4f(color, 1.0);
}
