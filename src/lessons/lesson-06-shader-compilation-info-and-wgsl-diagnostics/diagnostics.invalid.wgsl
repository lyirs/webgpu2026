@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32(vertexIndex) * 0.2 - 0.2;
  return vec4f(x, 0.0, 0.0, 1.0);
}

@fragment
fn fsMain() -> @location(0) vec4f {
  let color = unresolvedDiagnosticSymbol;
  return vec4f(color, 0.0, 1.0, 1.0);
}
