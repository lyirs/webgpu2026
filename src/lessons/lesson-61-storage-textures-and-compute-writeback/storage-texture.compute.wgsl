struct StorageTextureParams {
  time: f32,
  width: f32,
  height: f32,
  pattern: f32,
};

@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> params: StorageTextureParams;

fn palette(value: f32, uv: vec2f) -> vec4f {
  let warm = vec3f(1.0, 0.54, 0.22);
  let cool = vec3f(0.12, 0.78, 1.0);
  let ink = vec3f(0.03, 0.07, 0.14);
  let wave = 0.5 + 0.5 * sin(value * 6.28318);
  let tint = mix(cool, warm, wave);
  let vignette = smoothstep(0.82, 0.18, distance(uv, vec2f(0.5)));
  return vec4f(mix(ink, tint, 0.38 + 0.62 * vignette), 1.0);
}

@compute @workgroup_size(8, 8)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let size = vec2u(u32(params.width), u32(params.height));
  if (globalId.x >= size.x || globalId.y >= size.y) {
    return;
  }

  let pixel = vec2f(globalId.xy);
  let uv = (pixel + vec2f(0.5)) / vec2f(params.width, params.height);
  let centered = uv - vec2f(0.5);
  let radial = length(centered);
  let waves = sin((uv.x * 11.0 + params.time * 0.65) * 6.28318)
    + cos((uv.y * 9.0 - params.time * 0.45) * 6.28318);
  let checker = select(0.0, 1.0, (u32(floor(uv.x * 12.0)) + u32(floor(uv.y * 12.0))) % 2u == 0u);
  let rings = sin((radial * 18.0 - params.time * 0.9) * 6.28318);
  let mixed = mix(0.5 + 0.25 * waves, checker, params.pattern);
  let value = mix(mixed, 0.5 + 0.5 * rings, abs(params.pattern - 0.5) * 2.0);

  textureStore(outputTexture, vec2i(globalId.xy), palette(value, uv));
}
