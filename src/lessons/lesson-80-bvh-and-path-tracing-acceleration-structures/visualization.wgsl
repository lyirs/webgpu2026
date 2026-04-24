struct LessonSettings {
  canvasSize: vec2f,
  boxCount: f32,
  sampleCount: f32,
  showDepthTint: f32,
  maxDepth: f32,
  time: f32,
  freezeSeed: f32,
  padding: vec2f,
};

struct BoxData {
  minCorner: vec2f,
  maxCorner: vec2f,
  color: vec3f,
  leafDepth: f32,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;
@group(0) @binding(1) var<storage, read> boxes: array<BoxData>;

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * 2.0;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn roomBounds(localUv: vec2f) -> bool {
  return localUv.x > 0.08 && localUv.x < 0.92 && localUv.y > 0.14 && localUv.y < 0.88;
}

fn lineDistance(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * t);
}

fn projectPoint(point: vec2f) -> vec2f {
  return vec2f(
    mix(0.12, 0.88, (point.x + 1.6) / 3.2),
    mix(0.84, 0.16, (point.y + 1.6) / 3.2)
  );
}

fn depthTint(depth: f32, maxDepth: f32) -> vec3f {
  let t = select(0.0, clamp(depth / max(maxDepth, 1.0), 0.0, 1.0), maxDepth > 0.0);
  return vec3f(
    (90.0 + t * 120.0) / 255.0,
    (140.0 - t * 48.0) / 255.0,
    (255.0 - t * 110.0) / 255.0
  );
}

fn drawRoom(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!roomBounds(localUv)) {
    return color;
  }

  let roomMin = projectPoint(vec2f(-1.6, -1.6));
  let roomMax = projectPoint(vec2f(1.6, 1.6));
  if (
    localUv.x > roomMin.x &&
    localUv.x < roomMax.x &&
    localUv.y > roomMax.y &&
    localUv.y < roomMin.y
  ) {
    color = vec3f(0.07, 0.11, 0.16);
  }

  for (var index = 0u; index < u32(settings.boxCount); index += 1u) {
    let box = boxes[index];
    let minUv = projectPoint(box.minCorner);
    let maxUv = projectPoint(box.maxCorner);
    if (
      localUv.x > minUv.x &&
      localUv.x < maxUv.x &&
      localUv.y > maxUv.y &&
      localUv.y < minUv.y
    ) {
      color = select(box.color, depthTint(box.leafDepth, settings.maxDepth), panelIndex == 1 && settings.showDepthTint > 0.5);
    }
  }

  let camera = projectPoint(vec2f(0.0, 2.58));
  let cameraMask = smoothstep(0.016, 0.0, distance(localUv, camera));
  color = mix(color, vec3f(1.0, 0.84, 0.56), cameraMask);

  let visibleRays = min(u32(settings.sampleCount), 80u);
  for (var rayIndex = 0u; rayIndex < visibleRays; rayIndex += 1u) {
    let t = select(0.5, f32(rayIndex) / max(f32(visibleRays - 1u), 1.0), visibleRays > 1u);
    let angle = mix(-0.72, 0.72, t) + (hash11(f32(rayIndex) * 0.71 + settings.time * 0.27) - 0.5) * 0.03;
    let end = projectPoint(vec2f(sin(angle) * 2.2, -cos(angle) * 2.2));
    let distanceToRay = lineDistance(localUv, camera, end);
    let rayMask = smoothstep(0.0045, 0.0, distanceToRay);
    let rayColor = select(vec3f(0.96, 0.75, 0.44), vec3f(0.55, 0.78, 1.0), panelIndex == 1);
    color = mix(color, rayColor, rayMask * 0.18);
  }

  let border =
    smoothstep(0.004, 0.0, abs(localUv.x - roomMin.x)) +
    smoothstep(0.004, 0.0, abs(localUv.x - roomMax.x)) +
    smoothstep(0.004, 0.0, abs(localUv.y - roomMax.y)) +
    smoothstep(0.004, 0.0, abs(localUv.y - roomMin.y));
  color = mix(color, vec3f(0.86, 0.9, 0.98), clamp(border, 0.0, 1.0) * 0.35);

  return color;
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fsVisualize(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / settings.canvasSize;
  let panel = panelInfo(uv);
  let panelIndex = i32(panel.x);
  let localUv = panel.yz;
  var color = drawRoom(panelIndex, localUv);
  let divider = smoothstep(0.002, 0.0, abs(uv.x - 0.5));
  color = mix(color, vec3f(1.0, 0.72, 0.46), divider * 0.6);
  return vec4f(color, 1.0);
}
