struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  lightPosition: vec4f,
  eyePosition: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
};

struct StaticVertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct MeshVertexInput {
  @location(0) position: vec4f,
  @location(1) normal: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec3f,
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
fn vsStatic(input: StaticVertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = object.modelMatrix * vec4f(input.position, 1.0);
  let worldNormal = transformStaticNormal(object.modelMatrix, input.normal);

  output.position = scene.viewProjectionMatrix * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = worldNormal;
  output.baseColor = object.color.xyz;
  return output;
}

@vertex
fn vsMesh(input: MeshVertexInput) -> VertexOutput {
  var output: VertexOutput;
  let accent = clamp(input.position.y * 0.42 + 0.52, 0.0, 1.0);
  let cool = vec3f(0.18, 0.78, 1.0);
  let warm = vec3f(1.0, 0.72, 0.30);

  output.position = scene.viewProjectionMatrix * vec4f(input.position.xyz, 1.0);
  output.worldPosition = input.position.xyz;
  output.worldNormal = normalize(input.normal.xyz);
  output.baseColor = mix(cool, warm, accent);
  return output;
}
