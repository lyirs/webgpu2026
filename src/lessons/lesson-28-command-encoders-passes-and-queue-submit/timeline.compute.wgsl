@group(0) @binding(0) var<storage, read_write> timeline: array<vec4f>;

@compute @workgroup_size(16)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  if (index >= 16u) {
    return;
  }

  let phase = f32(index) / 15.0;
  let wave = 0.35 + 0.55 * abs(sin(phase * 6.28318));
  let red = mix(0.25, 1.0, phase);
  let green = 0.45 + wave * 0.35;
  let blue = mix(1.0, 0.28, phase);
  timeline[index] = vec4f(red, green, blue, wave);
}
