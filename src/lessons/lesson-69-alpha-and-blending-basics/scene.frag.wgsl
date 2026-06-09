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

fn softRoundedMask(uv: vec2f, softness: f32) -> f32 {
  let centered = uv * 2.0 - 1.0;
  let q = abs(centered) - vec2f(0.56, 0.34);
  let outside = length(max(q, vec2f(0.0)));
  let inside = min(max(q.x, q.y), 0.0);
  let signedDistance = outside + inside - 0.18;
  let feather = max(0.015, softness * 0.55);
  return clamp(1.0 - smoothstep(0.0, feather, signedDistance), 0.0, 1.0);
}

fn spriteColor(uv: vec2f, tint: vec3f) -> vec3f {
  let centered = uv * 2.0 - 1.0;
  let radial = clamp(1.0 - length(centered) * 0.82, 0.0, 1.0);
  let diagonal = clamp(1.0 - abs(centered.x * 0.72 + centered.y * 0.95), 0.0, 1.0);
  let glow = 0.34 + radial * 0.48 + diagonal * 0.18;
  let highlight = smoothstep(-0.28, 0.42, centered.y - centered.x * 0.24);
  return tint * glow + vec3f(1.0) * highlight * 0.07;
}

@fragment
fn fsBackdrop(input: BackdropVertexOutput) -> @location(0) vec4f {
  let cellX = u32(floor(input.uv.x * 11.0));
  let cellY = u32(floor(input.uv.y * 11.0));
  let checker = f32((cellX + cellY) % 2u);
  let base = mix(vec3f(0.055, 0.078, 0.12), vec3f(0.112, 0.148, 0.21), input.uv.y);
  let checkerTint = mix(vec3f(0.0), vec3f(0.042, 0.055, 0.08), checker);
  let gridX = smoothstep(0.965, 1.0, fract(input.uv.x * 11.0));
  let gridY = smoothstep(0.965, 1.0, fract(input.uv.y * 11.0));
  let borderDistance = min(min(input.uv.x, input.uv.y), min(1.0 - input.uv.x, 1.0 - input.uv.y));
  let border = 1.0 - smoothstep(0.0, 0.028, borderDistance);
  let color = base + checkerTint + vec3f(0.055) * max(gridX, gridY) + vec3f(0.16, 0.18, 0.22) * border;
  return vec4f(color, 1.0);
}

@fragment
fn fsStraight(input: SpriteVertexOutput) -> @location(0) vec4f {
  let alpha = softRoundedMask(input.uv, input.softness) * input.color.a;
  let rgb = spriteColor(input.uv, input.color.rgb);
  return vec4f(rgb, alpha);
}

@fragment
fn fsPremultiplied(input: SpriteVertexOutput) -> @location(0) vec4f {
  let alpha = softRoundedMask(input.uv, input.softness) * input.color.a;
  let rgb = spriteColor(input.uv, input.color.rgb);
  return vec4f(rgb * alpha, alpha);
}
