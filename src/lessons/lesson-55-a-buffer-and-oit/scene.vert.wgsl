struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightDirection: vec4f,
  ambientColor: vec4f,
  pixelInfo: vec4u,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
};

struct SceneVertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct SceneVertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
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
fn vsScene(input: SceneVertexInput) -> SceneVertexOutput {
  var output: SceneVertexOutput;
  let worldPosition = object.modelMatrix * vec4f(input.position, 1.0);

  output.position = scene.viewProjectionMatrix * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = transformStaticNormal(object.modelMatrix, input.normal);
  output.baseColor = object.color;
  return output;
}
