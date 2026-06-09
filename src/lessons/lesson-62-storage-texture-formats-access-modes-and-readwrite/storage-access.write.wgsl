struct Params {
  time: f32,
  mode: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let size = textureDimensions(outputTexture);
  if (globalId.x >= size.x || globalId.y >= size.y) {
    return;
  }
  let uv = vec2f(globalId.xy) / vec2f(size);
  let wave = 0.5 + 0.5 * sin((uv.x * 12.0 + uv.y * 8.0) + params.time);
  let color = vec4f(uv.x, wave, 0.9 - uv.y * 0.45, 1.0);
  textureStore(outputTexture, vec2i(globalId.xy), color);
}
