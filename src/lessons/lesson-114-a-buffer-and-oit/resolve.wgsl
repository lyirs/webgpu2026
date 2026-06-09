struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightDirection: vec4f,
  ambientColor: vec4f,
  pixelInfo: vec4u,
};

struct FragmentNode {
  depthBits: u32,
  colorPacked: u32,
};

struct FullscreenOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

const MAX_A_BUFFER_CAPACITY = 8u;

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var leftTexture: texture_2d<f32>;
@group(0) @binding(2) var rightTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> scene: SceneUniforms;
@group(0) @binding(4) var<storage, read> counts: array<u32>;
@group(0) @binding(5) var<storage, read> fragments: array<FragmentNode>;

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> FullscreenOutput {
  var output: FullscreenOutput;
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  output.uv = vec2f(x, y);
  output.position = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return output;
}

fn resolveABuffer(localUv: vec2f) -> vec4f {
  let background = textureSampleLevel(rightTexture, presentSampler, localUv, 0.0);
  let dimensions = textureDimensions(rightTexture);
  let width = max(dimensions.x, 1u);
  let height = max(dimensions.y, 1u);
  let capacity = min(max(scene.pixelInfo.z, 1u), MAX_A_BUFFER_CAPACITY);
  let pixelX = min(u32(localUv.x * f32(width)), width - 1u);
  let pixelY = min(u32(localUv.y * f32(height)), height - 1u);
  let pixelIndex = pixelY * width + pixelX;
  let count = min(counts[pixelIndex], capacity);
  var depthValues: array<u32, MAX_A_BUFFER_CAPACITY>;
  var colorValues: array<vec4f, MAX_A_BUFFER_CAPACITY>;

  for (var index = 0u; index < count; index = index + 1u) {
    let node = fragments[pixelIndex * capacity + index];
    depthValues[index] = node.depthBits;
    colorValues[index] = unpack4x8unorm(node.colorPacked);
  }

  for (var outer = 1u; outer < count; outer = outer + 1u) {
    let savedDepth = depthValues[outer];
    let savedColor = colorValues[outer];
    var current = outer;

    loop {
      if (current == 0u || depthValues[current - 1u] >= savedDepth) {
        break;
      }

      depthValues[current] = depthValues[current - 1u];
      colorValues[current] = colorValues[current - 1u];
      current = current - 1u;
    }

    depthValues[current] = savedDepth;
    colorValues[current] = savedColor;
  }

  var accumulated = background;

  for (var layer = 0u; layer < count; layer = layer + 1u) {
    let fragmentColor = colorValues[layer];
    accumulated = vec4f(
      fragmentColor.rgb + (1.0 - fragmentColor.a) * accumulated.rgb,
      fragmentColor.a + (1.0 - fragmentColor.a) * accumulated.a
    );
  }

  return vec4f(accumulated.rgb, 1.0);
}

@fragment
fn fsPresent(input: FullscreenOutput) -> @location(0) vec4f {
  let dividerWidth = 0.0016;
  let dividerDistance = abs(input.uv.x - 0.5);
  let dividerMix = clamp(1.0 - dividerDistance / dividerWidth, 0.0, 1.0);

  var color = vec4f(0.0);

  if (input.uv.x < 0.5) {
    color = textureSampleLevel(
      leftTexture,
      presentSampler,
      vec2f(input.uv.x * 2.0, input.uv.y),
      0.0
    );
  } else {
    color = resolveABuffer(vec2f((input.uv.x - 0.5) * 2.0, input.uv.y));
  }

  let dividerColor = vec3f(0.42, 0.66, 0.96);
  let blendedRgb =
    color.rgb * (1.0 - dividerMix * 0.45) + dividerColor * dividerMix * 0.45;
  return vec4f(blendedRgb, color.a);
}
