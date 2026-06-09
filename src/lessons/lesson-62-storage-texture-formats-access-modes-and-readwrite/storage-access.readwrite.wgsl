struct Params {
  time: f32,
  mode: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, read_write>;
@group(0) @binding(1) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let size = textureDimensions(outputTexture);
  if (globalId.x >= size.x || globalId.y >= size.y) {
    return;
  }
  let uv = vec2f(globalId.xy) / vec2f(size);
  let previous = textureLoad(outputTexture, vec2i(globalId.xy));
  let pulse = 0.5 + 0.5 * sin(params.time + uv.x * 10.0);
  let updated = mix(previous, vec4f(1.0 - previous.rgb, 1.0), 0.08 + pulse * 0.05);
  textureStore(outputTexture, vec2i(globalId.xy), updated);
}
