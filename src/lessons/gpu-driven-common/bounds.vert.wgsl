struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  eyePosition: vec4f,
};

struct BoundsUniforms {
  color: vec4f,
  options: vec4f,
};

struct InstanceData {
  centerRadius: vec4f,
  scaleLod: vec4f,
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) visible: f32,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(0) @binding(1) var<storage, read> instances: array<InstanceData>;
@group(0) @binding(2) var<storage, read> visibilityFlags: array<u32>;
@group(0) @binding(3) var<uniform> boundsUniforms: BoundsUniforms;

@vertex
fn vsMain(
  input: VertexInput,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let instance = instances[instanceIndex];
  let radius = max(instance.centerRadius.w, 0.01);
  let worldPosition = input.position * radius + instance.centerRadius.xyz;
  let visible = select(1.0, f32(visibilityFlags[instanceIndex]), boundsUniforms.options.z > 0.5);

  var output: VertexOutput;
  output.clipPosition = frameUniforms.viewProjectionMatrix * vec4f(worldPosition, 1.0);
  output.worldNormal = input.normal;
  output.visible = visible;
  return output;
}
