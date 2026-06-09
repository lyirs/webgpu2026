struct Feedback {
  hiddenVisible: f32,
  sideVisible: f32,
  time: f32,
  _pad: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) instance: f32,
};

@group(0) @binding(0) var<uniform> feedback: Feedback;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
  var base = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  var centers = array<vec2f, 3>(
    vec2f(-0.18, 0.02),
    vec2f(-0.18, 0.02),
    vec2f(0.48, -0.18)
  );
  var scales = array<vec2f, 3>(
    vec2f(0.34, 0.62),
    vec2f(0.22, 0.42),
    vec2f(0.24, 0.36)
  );
  var depths = array<f32, 3>(0.34, 0.58, 0.22);
  let local = base[vertexIndex];
  let phase = (sin(feedback.time * 0.9 - 1.5708) + 1.0) * 0.5;
  centers[1].x = -0.72 + phase * 1.28;
  var output: VertexOutput;
  output.position = vec4f(centers[instanceIndex] + local * scales[instanceIndex], depths[instanceIndex], 1.0);
  output.local = local;
  output.instance = f32(instanceIndex);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let edge = smoothstep(0.82, 1.0, max(abs(input.local.x), abs(input.local.y)));
  let occluder = vec3f(0.12, 0.18, 0.26);
  let hiddenFeedback = mix(vec3f(0.95, 0.28, 0.18), vec3f(0.28, 0.9, 1.0), feedback.hiddenVisible);
  let sideFeedback = mix(vec3f(0.25, 0.42, 0.82), vec3f(0.88, 0.72, 0.34), feedback.sideVisible);
  let hidden = hiddenFeedback * (0.82 + 0.12 * sin(feedback.time * 3.0));
  let side = sideFeedback;
  let color = select(select(occluder, hidden, input.instance > 0.5), side, input.instance > 1.5);
  return vec4f(mix(color, vec3f(1.0), edge * 0.28), 1.0);
}
