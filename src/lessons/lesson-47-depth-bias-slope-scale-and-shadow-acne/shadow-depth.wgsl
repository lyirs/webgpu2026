fn scenePosition(vertexIndex: u32) -> vec3f {
  let positions = array<vec3f, 18>(
    vec3f(-1.0, 0.0, -1.0), vec3f(1.0, 0.0, -1.0), vec3f(-1.0, 0.0, 1.0),
    vec3f(-1.0, 0.0, 1.0), vec3f(1.0, 0.0, -1.0), vec3f(1.0, 0.0, 1.0),

    vec3f(-0.38, 0.02, -0.18), vec3f(0.38, 0.02, -0.18), vec3f(-0.38, 0.72, -0.18),
    vec3f(-0.38, 0.72, -0.18), vec3f(0.38, 0.02, -0.18), vec3f(0.38, 0.72, -0.18),

    vec3f(-0.72, 0.02, 0.42), vec3f(-0.28, 0.02, 0.42), vec3f(-0.72, 0.52, 0.42),
    vec3f(-0.72, 0.52, 0.42), vec3f(-0.28, 0.02, 0.42), vec3f(-0.28, 0.52, 0.42)
  );
  return positions[vertexIndex];
}

fn lightProject(position: vec3f) -> vec4f {
  let clipX = position.x * 0.72 + position.z * 0.22;
  let clipY = position.z * 0.62 - position.y * 0.52;
  let depth = 0.48 + position.y * 0.24 + position.z * 0.08 - position.x * 0.035;
  return vec4f(clipX, clipY, depth, 1.0);
}

@vertex
fn vsShadow(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  return lightProject(scenePosition(vertexIndex));
}
