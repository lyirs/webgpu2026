struct LessonSettings {
  canvasSize: vec2f,
  samplesPerFrame: f32,
  maxBounce: f32,
  lightSize: f32,
  time: f32,
  freezeSeed: f32,
  _padding: vec2f,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;

const ROOM_MIN_X = -1.25;
const ROOM_MAX_X = 1.25;
const FLOOR_Y = 0.0;
const CEILING_Y = 1.55;
const OCCLUDER_MIN_X = -0.18;
const OCCLUDER_MAX_X = 0.22;
const OCCLUDER_HEIGHT = 0.98;

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * 2.0;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn clipLine(p: f32, q: f32, t0Value: ptr<function, f32>, t1Value: ptr<function, f32>) -> bool {
  if (abs(p) < 1e-6) {
    return q >= 0.0;
  }
  let r = q / p;
  if (p < 0.0) {
    if (r > (*t1Value)) {
      return false;
    }
    if (r > (*t0Value)) {
      (*t0Value) = r;
    }
  } else {
    if (r < (*t0Value)) {
      return false;
    }
    if (r < (*t1Value)) {
      (*t1Value) = r;
    }
  }
  return true;
}

fn segmentIntersectsRect(a: vec2f, b: vec2f, rect: vec4f) -> bool {
  let dir = b - a;
  var t0 = 0.0;
  var t1 = 1.0;
  if (!clipLine(-dir.x, a.x - rect.x, &t0, &t1)) { return false; }
  if (!clipLine(dir.x, rect.x + rect.z - a.x, &t0, &t1)) { return false; }
  if (!clipLine(-dir.y, a.y - rect.y, &t0, &t1)) { return false; }
  if (!clipLine(dir.y, rect.y + rect.w - a.y, &t0, &t1)) { return false; }
  return t1 > t0;
}

fn projectPoint(point: vec2f) -> vec2f {
  return vec2f(
    mix(0.10, 0.90, (point.x - ROOM_MIN_X) / (ROOM_MAX_X - ROOM_MIN_X)),
    mix(0.82, 0.18, point.y / CEILING_Y)
  );
}

fn evaluateEmissive(receiverX: f32, seedOffset: f32) -> f32 {
  var contribution = 0.0;
  let spp = u32(settings.samplesPerFrame);
  for (var sampleIndex = 0u; sampleIndex < spp; sampleIndex += 1u) {
    var x = receiverX;
    var y = FLOOR_Y + 0.001;
    for (var bounce = 0u; bounce < u32(settings.maxBounce); bounce += 1u) {
      let h = hash11(seedOffset + f32(sampleIndex) * 1.17 + f32(bounce) * 0.37 + settings.time * 0.13);
      let angle = h * 3.14159265;
      let dx = cos(angle);
      let dy = sin(angle);
      if (dy <= 0.0) {
        break;
      }
      let ceilingDistance = (CEILING_Y - y) / max(dy, 1e-4);
      let ceilingX = x + dx * ceilingDistance;
      let hitsEmitter = abs(ceilingX) <= settings.lightSize;
      let blocked = segmentIntersectsRect(
        vec2f(x, y),
        vec2f(ceilingX, CEILING_Y),
        vec4f(OCCLUDER_MIN_X, FLOOR_Y, OCCLUDER_MAX_X - OCCLUDER_MIN_X, OCCLUDER_HEIGHT)
      );
      if (hitsEmitter && !blocked) {
        let delta = vec2f(ceilingX - x, CEILING_Y - y);
        let distanceSq = max(dot(delta, delta), 0.3);
        let distance = sqrt(distanceSq);
        let cosine = (CEILING_Y - y) / max(distance, 1e-4);
        contribution += cosine * 10.5 / distanceSq;
        break;
      }
      x += dx * 0.18;
      y += dy * 0.18;
      if (x < ROOM_MIN_X || x > ROOM_MAX_X || y > CEILING_Y) {
        break;
      }
    }
  }
  return contribution / max(settings.samplesPerFrame, 1.0);
}

fn evaluateNee(receiverX: f32, seedOffset: f32) -> f32 {
  var contribution = 0.0;
  let spp = u32(settings.samplesPerFrame);
  let lightPdf = 1.0 / max(settings.lightSize * 2.0, 1e-4);
  for (var sampleIndex = 0u; sampleIndex < spp; sampleIndex += 1u) {
    var x = receiverX;
    var y = FLOOR_Y + 0.001;
    for (var bounce = 0u; bounce < u32(settings.maxBounce); bounce += 1u) {
      let h = hash11(seedOffset + f32(sampleIndex) * 2.13 + f32(bounce) * 0.67 + settings.time * 0.19);
      let lightX = mix(-settings.lightSize, settings.lightSize, h);
      let blocked = segmentIntersectsRect(
        vec2f(x, y),
        vec2f(lightX, CEILING_Y),
        vec4f(OCCLUDER_MIN_X, FLOOR_Y, OCCLUDER_MAX_X - OCCLUDER_MIN_X, OCCLUDER_HEIGHT)
      );
      if (!blocked) {
        let delta = vec2f(lightX - x, CEILING_Y - y);
        let distanceSq = max(dot(delta, delta), 0.3);
        let distance = sqrt(distanceSq);
        let cosine = (CEILING_Y - y) / max(distance, 1e-4);
        contribution += (cosine * 10.5 / distanceSq) / lightPdf;
        break;
      }
      let angle = hash11(seedOffset + f32(sampleIndex) * 1.31 + f32(bounce) * 0.43 + 21.0) * 3.14159265;
      let dx = cos(angle);
      let dy = sin(angle);
      if (dy <= 0.0) {
        break;
      }
      x += dx * 0.18;
      y += dy * 0.18;
      if (x < ROOM_MIN_X || x > ROOM_MAX_X || y > CEILING_Y) {
        break;
      }
    }
  }
  return contribution / max(settings.samplesPerFrame, 1.0);
}

fn drawRoom(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!(localUv.x > 0.08 && localUv.x < 0.92 && localUv.y > 0.12 && localUv.y < 0.58)) {
    return color;
  }
  let roomMin = projectPoint(vec2f(ROOM_MIN_X, FLOOR_Y));
  let roomMax = projectPoint(vec2f(ROOM_MAX_X, CEILING_Y));
  if (
    localUv.x > roomMin.x &&
    localUv.x < roomMax.x &&
    localUv.y > roomMax.y &&
    localUv.y < roomMin.y
  ) {
    color = vec3f(0.08, 0.12, 0.18);
  }
  let occMin = projectPoint(vec2f(OCCLUDER_MIN_X, FLOOR_Y));
  let occMax = projectPoint(vec2f(OCCLUDER_MAX_X, OCCLUDER_HEIGHT));
  if (
    localUv.x > occMin.x &&
    localUv.x < occMax.x &&
    localUv.y > occMax.y &&
    localUv.y < occMin.y
  ) {
    color = vec3f(0.2, 0.24, 0.31);
  }
  let lightMin = projectPoint(vec2f(-settings.lightSize, CEILING_Y));
  let lightMax = projectPoint(vec2f(settings.lightSize, CEILING_Y));
  if (localUv.x > lightMin.x && localUv.x < lightMax.x && abs(localUv.y - lightMin.y) < 0.012) {
    color = select(vec3f(1.0, 0.82, 0.52), vec3f(0.56, 0.9, 1.0), panelIndex == 1);
  }
  return color;
}

fn drawStrip(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!(localUv.y > 0.64 && localUv.y < 0.92)) {
    return color;
  }
  let stripUv = vec2f(localUv.x, (localUv.y - 0.64) / 0.28);
  let receiverX = mix(ROOM_MIN_X + 0.08, ROOM_MAX_X - 0.08, stripUv.x);
  let value = select(
    evaluateEmissive(receiverX, 13.0),
    evaluateNee(receiverX, 29.0),
    panelIndex == 1
  );
  let reference = evaluateNee(receiverX, 59.0 + settings.time * 0.37);
  let normalized = clamp(value / max(reference, 0.0001), 0.0, 1.4);
  let insideBar = stripUv.y >= 1.0 - normalized;
  if (insideBar) {
    color = select(
      vec3f(0.78, 0.60, 0.36),
      vec3f(0.54, 0.86, 1.0),
      panelIndex == 1
    );
  } else {
    color = mix(color, vec3f(0.14, 0.19, 0.27), 0.25);
  }
  let divider = smoothstep(0.004, 0.0, abs(fract(stripUv.x * 40.0) - 0.5));
  color = mix(color, vec3f(0.12, 0.16, 0.22), divider * 0.18);
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
  color = mix(color, drawStrip(panelIndex, localUv), select(0.0, 1.0, localUv.y > 0.64));
  let divider = smoothstep(0.002, 0.0, abs(uv.x - 0.5));
  color = mix(color, vec3f(1.0, 0.72, 0.46), divider * 0.58);
  return vec4f(color, 1.0);
}
