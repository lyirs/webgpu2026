struct LessonSettings {
  width: u32,
  height: u32,
  frameIndex: u32,
  motionMode: u32,
  historyBlend: f32,
  clampStrength: f32,
  cameraOffset: f32,
  previousOffset: f32,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;
@group(0) @binding(1) var<storage, read_write> currentBuffer: array<vec4f>;
@group(0) @binding(2) var<storage, read> naivePrev: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> naiveNext: array<vec4f>;
@group(0) @binding(4) var<storage, read> stabilizedPrev: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> stabilizedNext: array<vec4f>;

fn clamp1(value: f32, minValue: f32, maxValue: f32) -> f32 {
  return min(max(value, minValue), maxValue);
}

fn hash31(value: vec3f) -> f32 {
  return fract(sin(dot(value, vec3f(12.9898, 78.233, 37.719))) * 43758.5453123);
}

fn colorAt(worldX: f32, worldY: f32) -> vec3f {
  let isLight = worldY > 2.24 && worldY < 2.34 && abs(worldX) < 0.46;
  if (isLight) {
    return vec3f(1.8, 1.72, 1.58);
  }
  if (worldY < 0.08) {
    return vec3f(0.18 + worldX * 0.02, 0.18, 0.2);
  }
  if (worldX < -1.48) {
    return vec3f(0.55, 0.21, 0.16);
  }
  if (worldX > 1.48) {
    return vec3f(0.18, 0.48, 0.2);
  }
  if (worldY > 2.22) {
    return vec3f(0.32, 0.3, 0.28);
  }

  let leftBox = worldX > -0.95 && worldX < -0.18 && worldY < 1.08 && worldY > 0.0;
  let rightBox = worldX > 0.28 && worldX < 1.04 && worldY < 1.62 && worldY > 0.0;
  if (leftBox) {
    let t = worldY / 1.08;
    return vec3f(0.42 + t * 0.16, 0.42 + t * 0.16, 0.48 + t * 0.10);
  }
  if (rightBox) {
    let t = worldY / 1.62;
    return vec3f(0.50 + t * 0.18, 0.42 + t * 0.14, 0.28 + t * 0.10);
  }

  let bounce = max(0.0, 1.0 - length(vec2f(worldX * 0.54, worldY - 1.7)) * 0.62) * 0.24;
  return vec3f(0.06 + bounce, 0.07 + bounce * 0.96, 0.09 + bounce * 0.88);
}

fn currentColor(x: i32, y: i32) -> vec3f {
  let ndcX = f32(x) / max(f32(settings.width - 1u), 1.0);
  let ndcY = f32(y) / max(f32(settings.height - 1u), 1.0);
  let worldX = (ndcX * 2.0 - 1.0) * 1.7 + settings.cameraOffset;
  let worldY = (1.0 - ndcY) * 2.3;
  let base = colorAt(worldX, worldY);
  let noise = (hash31(vec3f(f32(x), f32(y), f32(settings.frameIndex))) - 0.5) * 0.22;
  return vec3f(
    clamp1(base.x + noise, 0.0, 2.2),
    clamp1(base.y + noise * 0.88, 0.0, 2.2),
    clamp1(base.z + noise * 0.82, 0.0, 2.2)
  );
}

fn neighborhoodRange(x: i32, y: i32) -> vec2f {
  var minValue = 1e9;
  var maxValue = -1e9;
  for (var oy = -1; oy <= 1; oy += 1) {
    for (var ox = -1; ox <= 1; ox += 1) {
      let sx = clamp(x + ox, 0, i32(settings.width) - 1);
      let sy = clamp(y + oy, 0, i32(settings.height) - 1);
      let sample = currentColor(sx, sy);
      let lum = dot(sample, vec3f(0.2126, 0.7152, 0.0722));
      minValue = min(minValue, lum);
      maxValue = max(maxValue, lum);
    }
  }
  return vec2f(minValue, maxValue);
}

@compute @workgroup_size(8, 8)
fn updateHistories(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= settings.width || gid.y >= settings.height) {
    return;
  }

  let index = gid.y * settings.width + gid.x;
  let current = currentColor(i32(gid.x), i32(gid.y));
  currentBuffer[index] = vec4f(current, 1.0);

  if (settings.frameIndex == 0u) {
    naiveNext[index] = vec4f(current, 1.0);
    stabilizedNext[index] = vec4f(current, 1.0);
    return;
  }

  let alpha = 1.0 - settings.historyBlend;
  let naiveHistory = naivePrev[index].xyz;
  naiveNext[index] = vec4f(naiveHistory * settings.historyBlend + current * alpha, 1.0);

  let shiftPixels = i32(round((settings.cameraOffset - settings.previousOffset) * max(f32(settings.width - 1u), 1.0) / 3.4));
  let previousX = i32(gid.x) + shiftPixels;
  var historyValue = current;
  if (previousX >= 0 && previousX < i32(settings.width)) {
    historyValue = stabilizedPrev[gid.y * settings.width + u32(previousX)].xyz;
  }
  let range = neighborhoodRange(i32(gid.x), i32(gid.y));
  let currentLum = dot(current, vec3f(0.2126, 0.7152, 0.0722));
  let span = (range.y - range.x) * (0.45 + settings.clampStrength * 0.75);
  let historyLum = dot(historyValue, vec3f(0.2126, 0.7152, 0.0722));
  let clampedLum = clamp1(historyLum, currentLum - span, currentLum + span);
  let scale = clampedLum / max(historyLum, 1e-4);
  let clampedHistory = historyValue * scale;
  stabilizedNext[index] = vec4f(clampedHistory * settings.historyBlend + current * alpha, 1.0);
}
