struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
  surfaceParams: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) localPosition: vec3f,
  @location(3) objectColor: vec4f,
  @location(4) surfaceParams: vec4f,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
@group(1) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

fn transformNormal(model: mat4x4f, normal: vec3f) -> vec3f {
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
fn main(input: VertexInput) -> VertexOutput {
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  let worldNormal = transformNormal(objectUniforms.modelMatrix, input.normal);

  var output: VertexOutput;
  output.clipPosition = sceneUniforms.viewProjectionMatrix * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = worldNormal;
  output.localPosition = input.position;
  output.objectColor = objectUniforms.color;
  output.surfaceParams = objectUniforms.surfaceParams;
  return output;
}
