struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  eyePosition: vec4f,
  viewportRect: vec4f,
  clusterInfo: vec4u,
  depthParams: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
};

struct Light {
  positionRange: vec4f,
  colorIntensity: vec4f,
};

struct ObjectVertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec3f,
  @location(3) viewDepth: f32,
};

struct MarkerOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> lights: array<Light>;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

fn transformStaticNormal(model: mat4x4f, normal: vec3f) -> vec3f {
  let axisX = model[0].xyz;
  let axisY = model[1].xyz;
  let axisZ = model[2].xyz;
  let safeScale = max(
    vec3f(length(axisX), length(axisY), length(axisZ)),
    vec3f(0.00001)
  );
  let unitBasis = mat3x3f(axisX / safeScale.x, axisY / safeScale.y, axisZ / safeScale.z);
  return normalize(unitBasis * (normal / safeScale));
}

@vertex
fn vsObject(input: ObjectVertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = object.modelMatrix * vec4f(input.position, 1.0);
  let worldNormal = transformStaticNormal(object.modelMatrix, input.normal);
  let viewPosition = scene.viewMatrix * worldPosition;

  output.position = scene.viewProjectionMatrix * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = worldNormal;
  output.baseColor = object.color.xyz;
  output.viewDepth = -viewPosition.z;
  return output;
}

@vertex
fn vsLightMarker(
  input: ObjectVertexInput,
  @builtin(instance_index) instanceIndex: u32
) -> MarkerOutput {
  var output: MarkerOutput;
  let light = lights[instanceIndex];
  let markerScale = max(light.positionRange.w * 0.075, 0.06);
  let worldPosition = vec4f(
    input.position * markerScale + light.positionRange.xyz,
    1.0
  );

  output.position = scene.viewProjectionMatrix * worldPosition;
  output.color = light.colorIntensity.rgb * (1.1 + light.colorIntensity.a * 0.08);
  return output;
}
