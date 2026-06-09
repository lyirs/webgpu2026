const PI = 3.14159265359;

struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  lightingParams: vec4f,
};

struct MaterialUniforms {
  baseColorFactor: vec4f,
  metallicRoughnessNormalScale: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(2) @binding(0) var materialSampler: sampler;
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;
@group(2) @binding(2) var metallicRoughnessTexture: texture_2d<f32>;
@group(2) @binding(3) var normalTexture: texture_2d<f32>;
@group(2) @binding(4) var<uniform> materialUniforms: MaterialUniforms;
@group(3) @binding(0) var environmentSampler: sampler;
@group(3) @binding(1) var environmentTexture: texture_cube<f32>;

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
};

fn srgbToLinear(color: vec3f) -> vec3f {
  return pow(color, vec3f(2.2));
}

fn linearToSrgb(color: vec3f) -> vec3f {
  return pow(color, vec3f(1.0 / 2.2));
}

fn rotateDirectionY(direction: vec3f, angle: f32) -> vec3f {
  let cosine = cos(angle);
  let sine = sin(angle);
  return vec3f(
    direction.x * cosine + direction.z * sine,
    direction.y,
    -direction.x * sine + direction.z * cosine
  );
}

fn sampleWorldNormal(input: FragmentInput) -> vec3f {
  let mappedNormal =
    textureSample(normalTexture, materialSampler, input.uv).xyz * 2.0 - vec3f(1.0);
  let scaledNormal = vec3f(
    mappedNormal.x * materialUniforms.metallicRoughnessNormalScale.z,
    mappedNormal.y * materialUniforms.metallicRoughnessNormalScale.z,
    mappedNormal.z
  );
  let dp1 = dpdx(input.worldPosition);
  let dp2 = dpdy(input.worldPosition);
  let duv1 = dpdx(input.uv);
  let duv2 = dpdy(input.uv);
  let geometricNormal = normalize(input.worldNormal);
  let determinant = duv1.x * duv2.y - duv1.y * duv2.x;

  if (abs(determinant) < 1e-6) {
    return geometricNormal;
  }

  let tangent = normalize((dp1 * duv2.y - dp2 * duv1.y) / determinant);
  let bitangent = normalize((-dp1 * duv2.x + dp2 * duv1.x) / determinant);
  let tbn = mat3x3f(tangent, bitangent, geometricNormal);
  return normalize(tbn * scaledNormal);
}

fn distributionGGX(normal: vec3f, halfVector: vec3f, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alphaSquared = alpha * alpha;
  let normalDotHalf = max(dot(normal, halfVector), 0.0);
  let normalDotHalfSquared = normalDotHalf * normalDotHalf;
  let denominator =
    normalDotHalfSquared * (alphaSquared - 1.0) + 1.0;
  return alphaSquared / max(PI * denominator * denominator, 1e-5);
}

fn geometrySchlickGGX(normalDotDirection: f32, roughness: f32) -> f32 {
  let factor = roughness + 1.0;
  let k = (factor * factor) / 8.0;
  return normalDotDirection / max(normalDotDirection * (1.0 - k) + k, 1e-5);
}

fn geometrySmith(
  normal: vec3f,
  viewDirection: vec3f,
  lightDirection: vec3f,
  roughness: f32
) -> f32 {
  let normalDotView = max(dot(normal, viewDirection), 0.0);
  let normalDotLight = max(dot(normal, lightDirection), 0.0);
  let ggxView = geometrySchlickGGX(normalDotView, roughness);
  let ggxLight = geometrySchlickGGX(normalDotLight, roughness);
  return ggxView * ggxLight;
}

fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - cosTheta, 5.0);
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let baseColorSample = textureSample(baseColorTexture, materialSampler, input.uv);
  let metallicRoughnessSample =
    textureSample(metallicRoughnessTexture, materialSampler, input.uv).rgb;
  let albedo =
    srgbToLinear(baseColorSample.rgb * materialUniforms.baseColorFactor.rgb);
  let metallic =
    clamp(
      metallicRoughnessSample.b *
        materialUniforms.metallicRoughnessNormalScale.x,
      0.0,
      1.0
    );
  let roughness =
    clamp(
      metallicRoughnessSample.g *
        materialUniforms.metallicRoughnessNormalScale.y,
      0.045,
      1.0
    );
  let normal = sampleWorldNormal(input);
  let viewDirection =
    normalize(frameUniforms.cameraPosition.xyz - input.worldPosition);
  let lightDirection = normalize(frameUniforms.lightDirection.xyz);
  let halfVector = normalize(viewDirection + lightDirection);
  let directRadiance = vec3f(4.8, 4.5, 4.2) * frameUniforms.lightingParams.x;

  let baseReflectance = mix(vec3f(0.04), albedo, metallic);
  let fresnel = fresnelSchlick(max(dot(halfVector, viewDirection), 0.0), baseReflectance);
  let distribution = distributionGGX(normal, halfVector, roughness);
  let geometry = geometrySmith(normal, viewDirection, lightDirection, roughness);
  let specularNumerator = distribution * geometry * fresnel;
  let denominator =
    4.0 *
    max(dot(normal, viewDirection), 0.0) *
    max(dot(normal, lightDirection), 0.0);
  let directSpecular = specularNumerator / max(vec3f(denominator), vec3f(0.001));

  let kS = fresnel;
  let kD = (vec3f(1.0) - kS) * (1.0 - metallic);
  let normalDotLight = max(dot(normal, lightDirection), 0.0);
  let directDiffuse = kD * albedo / PI;
  let directColor = (directDiffuse + directSpecular) * directRadiance * normalDotLight;

  let rotation = frameUniforms.lightingParams.z;
  let iblWeight = frameUniforms.lightingParams.w;
  let rotatedNormal = normalize(rotateDirectionY(normal, rotation));
  let rotatedReflectDirection = normalize(
    rotateDirectionY(reflect(-viewDirection, normal), rotation)
  );
  let diffuseEnvironment = srgbToLinear(
    textureSample(environmentTexture, environmentSampler, rotatedNormal).rgb
  );
  let reflectedEnvironment = srgbToLinear(
    textureSample(
      environmentTexture,
      environmentSampler,
      rotatedReflectDirection
    ).rgb
  );
  let blurredReflection = mix(
    reflectedEnvironment,
    diffuseEnvironment,
    roughness * roughness
  );
  let fresnelView = fresnelSchlick(max(dot(normal, viewDirection), 0.0), baseReflectance);
  let iblDiffuse =
    diffuseEnvironment * albedo / PI * (vec3f(1.0) - fresnelView) * (1.0 - metallic);
  let iblSpecular = blurredReflection * fresnelView;
  let iblColor =
    (iblDiffuse + iblSpecular) *
    frameUniforms.lightingParams.y *
    iblWeight;

  let ambientFloor = albedo * 0.02;
  let color = ambientFloor + directColor + iblColor;
  let toneMapped = color / (color + vec3f(1.0));

  return vec4f(linearToSrgb(toneMapped), baseColorSample.a);
}
