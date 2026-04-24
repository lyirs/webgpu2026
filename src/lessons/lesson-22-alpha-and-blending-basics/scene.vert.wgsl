struct SpriteUniforms {
  centerScale: vec4f,
  tint: vec4f,
  params: vec4f,
};

@group(0) @binding(0) var<uniform> spriteUniforms: SpriteUniforms;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) uv: vec2f,
};

struct BackdropVertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

struct SpriteVertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) softness: f32,
};

@vertex
fn vsBackdrop(input: VertexInput) -> BackdropVertexOutput {
  var output: BackdropVertexOutput;
  output.clipPosition = vec4f(input.position, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}

@vertex
fn vsSprite(input: VertexInput) -> SpriteVertexOutput {
  var output: SpriteVertexOutput;
  let rotation = spriteUniforms.params.x;
  let cosTheta = cos(rotation);
  let sinTheta = sin(rotation);
  let rotationMatrix = mat2x2f(
    vec2f(cosTheta, sinTheta),
    vec2f(-sinTheta, cosTheta)
  );
  let localPosition = rotationMatrix * (input.position * spriteUniforms.centerScale.zw);

  output.clipPosition = vec4f(spriteUniforms.centerScale.xy + localPosition, 0.0, 1.0);
  output.uv = input.uv;
  output.color = spriteUniforms.tint;
  output.softness = spriteUniforms.params.y;
  return output;
}
