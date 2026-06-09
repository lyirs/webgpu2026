struct DisplayUniforms {
  displayParams: vec4f,
};

@group(0) @binding(0) var hdrSampler: sampler;
@group(0) @binding(1) var hdrTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> displayUniforms: DisplayUniforms;

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

fn toneMapAcesFit(color: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp(
    (color * (a * color + vec3f(b))) /
      (color * (c * color + vec3f(d)) + vec3f(e)),
    vec3f(0.0),
    vec3f(1.0)
  );
}

fn mapDisplayColor(hdrColor: vec3f, leftPanel: bool) -> vec3f {
  return select(
    clamp(hdrColor, vec3f(0.0), vec3f(1.0)),
    select(
      toneMapReinhard(hdrColor * displayUniforms.displayParams.x),
      toneMapAcesFit(hdrColor * displayUniforms.displayParams.x),
      displayUniforms.displayParams.y > 0.5
    ),
    !leftPanel
  );
}

fn hdrReferenceIntensity(x: f32) -> f32 {
  if (x < 1.0 / 6.0) {
    return 0.18;
  }
  if (x < 2.0 / 6.0) {
    return 1.0;
  }
  if (x < 3.0 / 6.0) {
    return 2.0;
  }
  if (x < 4.0 / 6.0) {
    return 4.0;
  }
  if (x < 5.0 / 6.0) {
    return 8.0;
  }
  return 16.0;
}

fn hdrReferenceColor(localUv: vec2f) -> vec3f {
  let intensity = hdrReferenceIntensity(localUv.x);
  let warm = vec3f(1.45, 1.06, 0.68);
  let cool = vec3f(0.72, 1.34, 1.78);
  let tint = mix(warm, cool, clamp(localUv.x * 1.08, 0.0, 1.0));
  let glow = mix(0.76, 1.18, 1.0 - smoothstep(0.0, 1.0, localUv.y));
  return tint * intensity * glow;
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

  var hdrColor = textureSample(hdrTexture, hdrSampler, panelUv).rgb;
  let stripMin = vec2f(0.08, 0.055);
  let stripMax = vec2f(0.92, 0.16);
  let inReferenceStrip =
    panelUv.x >= stripMin.x &&
    panelUv.x <= stripMax.x &&
    panelUv.y >= stripMin.y &&
    panelUv.y <= stripMax.y;

  if (inReferenceStrip) {
    let localUv =
      (panelUv - stripMin) / vec2f(stripMax.x - stripMin.x, stripMax.y - stripMin.y);
    hdrColor = hdrReferenceColor(localUv);
  }

  let mapped = mapDisplayColor(hdrColor, leftPanel);

  var color = linearToSrgb(mapped);
  if (inReferenceStrip) {
    let localUv =
      (panelUv - stripMin) / vec2f(stripMax.x - stripMin.x, stripMax.y - stripMin.y);
    let edgeMask =
      select(0.0, 1.0, localUv.x < 0.005 || localUv.x > 0.995 || localUv.y < 0.045 || localUv.y > 0.955);
    let dividerMask = select(
      0.0,
      1.0,
      abs(fract(localUv.x * 6.0) - 0.5) > 0.486
    );
    color = mix(color, vec3f(0.96, 0.96, 0.98), max(edgeMask, dividerMask * 0.45));
  }
  if (abs(input.uv.x - 0.5) < 0.0025) {
    color = vec3f(0.97, 0.67, 0.42);
  }

  return vec4f(color, 1.0);
}
