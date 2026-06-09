struct SsaoUniforms {
  projectionMatrix: mat4x4f,
  params: vec4f,
};

@group(0) @binding(0) var ssaoSampler: sampler;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var viewPositionTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> ssaoUniforms: SsaoUniforms;

struct FullscreenOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

const SAMPLE_COUNT: u32 = 12u;
const KERNEL: array<vec3f, 12> = array<vec3f, 12>(
  vec3f(0.164, 0.113, 0.214),
  vec3f(-0.127, 0.094, 0.178),
  vec3f(0.084, -0.051, 0.261),
  vec3f(-0.205, -0.068, 0.189),
  vec3f(0.312, 0.145, 0.342),
  vec3f(-0.281, 0.196, 0.308),
  vec3f(0.176, -0.244, 0.387),
  vec3f(-0.341, -0.152, 0.354),
  vec3f(0.421, 0.218, 0.562),
  vec3f(-0.388, 0.092, 0.504),
  vec3f(0.126, -0.398, 0.622),
  vec3f(-0.218, -0.344, 0.714),
);

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

fn hash21(uv: vec2f) -> f32 {
  let value = dot(uv, vec2f(127.1, 311.7));
  return fract(sin(value) * 43758.5453);
}

fn hash22(uv: vec2f) -> vec2f {
  return vec2f(hash21(uv), hash21(uv.yx + vec2f(19.19, 73.41)));
}

fn projectToUv(viewPosition: vec3f) -> vec2f {
  let clip = ssaoUniforms.projectionMatrix * vec4f(viewPosition, 1.0);
  let ndc = clip.xy / max(clip.w, 0.0001);
  return ndc * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
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
  let encodedNormal =
    textureSampleLevel(normalTexture, ssaoSampler, input.uv, 0.0).xyz;
  let centerViewPosition =
    textureSampleLevel(viewPositionTexture, ssaoSampler, input.uv, 0.0).xyz;

  if (length(centerViewPosition) < 0.0001) {
    return vec4f(1.0, 1.0, 1.0, 1.0);
  }

  let normal = decodeNormal(encodedNormal);
  let random2 = hash22(input.uv * vec2f(951.37, 743.13));
  let randomVector = normalize(vec3f(random2 * 2.0 - 1.0, 0.0));
  let tangent = normalize(randomVector - normal * dot(randomVector, normal));
  let bitangent = cross(normal, tangent);
  let tbn = mat3x3f(tangent, bitangent, normal);

  var occlusion = 0.0;

  for (var sampleIndex = 0u; sampleIndex < SAMPLE_COUNT; sampleIndex += 1u) {
    let sampleViewPosition =
      centerViewPosition + (tbn * KERNEL[sampleIndex]) * ssaoUniforms.params.x;
    let sampleUv = projectToUv(sampleViewPosition);

    if (
      sampleUv.x <= 0.0 ||
      sampleUv.x >= 1.0 ||
      sampleUv.y <= 0.0 ||
      sampleUv.y >= 1.0
    ) {
      continue;
    }

    let fetchedViewPosition =
      textureSampleLevel(viewPositionTexture, ssaoSampler, sampleUv, 0.0).xyz;

    if (length(fetchedViewPosition) < 0.0001) {
      continue;
    }

    let depthDifference = abs(centerViewPosition.z - fetchedViewPosition.z);
    let rangeWeight = smoothstep(
      0.0,
      1.0,
      ssaoUniforms.params.x / max(depthDifference, 0.0001)
    );
    let sampleOccluded = select(
      0.0,
      1.0,
      fetchedViewPosition.z >= sampleViewPosition.z + ssaoUniforms.params.y
    );
    occlusion += sampleOccluded * rangeWeight;
  }

  let ao = clamp(1.0 - occlusion / f32(SAMPLE_COUNT), 0.0, 1.0);
  return vec4f(vec3f(ao), 1.0);
}
