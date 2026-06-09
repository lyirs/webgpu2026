struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightPosition: vec4f,
  lightColor: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  albedo: vec4f,
  emission: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(0) @binding(1) var<uniform> objectUniforms: ObjectUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightVector = frameUniforms.lightPosition.xyz - input.worldPosition;
  let lightDistanceSq = max(dot(lightVector, lightVector), 0.05);
  let lightDirection = normalize(lightVector);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let bounceAmbient = objectUniforms.albedo.xyz * 0.08;
  let direct = objectUniforms.albedo.xyz * frameUniforms.lightColor.xyz * diffuse / lightDistanceSq;
  let radiance = bounceAmbient + direct + objectUniforms.emission.xyz;
  return vec4f(radiance, 1.0);
}
