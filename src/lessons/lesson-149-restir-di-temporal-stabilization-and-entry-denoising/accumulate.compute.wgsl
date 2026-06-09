struct RestirSettings {
  gridInfo: vec4f,
  reuseInfo: vec4f,
  historyInfo: vec4f,
};

@group(0) @binding(0) var<uniform> settings: RestirSettings;
@group(0) @binding(1) var<storage, read> currentSurface: array<vec4f>;
@group(0) @binding(2) var<storage, read> currentValues: array<vec4f>;
@group(0) @binding(3) var<storage, read> previousSurface: array<vec4f>;
@group(0) @binding(4) var<storage, read> previousNaiveAccum: array<vec4f>;
@group(0) @binding(5) var<storage, read> previousStabilizedAccum: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> naiveAccum: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> stabilizedAccum: array<vec4f>;

fn gridWidth() -> u32 { return u32(settings.gridInfo.x); }
fn gridHeight() -> u32 { return u32(settings.gridInfo.y); }
fn currentOffset() -> f32 { return settings.reuseInfo.y; }
fn previousOffset() -> f32 { return settings.reuseInfo.z; }
fn historyBlend() -> f32 { return settings.historyInfo.y; }
fn clampStrength() -> f32 { return settings.historyInfo.z; }

fn hasHistorySurface(surface: vec4f) -> bool {
  return surface.x > 0.01;
}

@compute @workgroup_size(8, 8, 1)
fn accumulateMain(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= gridWidth() || globalId.y >= gridHeight()) {
    return;
  }

  let index = globalId.y * gridWidth() + globalId.x;
  let currentValue = currentValues[index].x;
  let surface = currentSurface[index];
  let shiftPixels = i32(round((currentOffset() - previousOffset()) * max(f32(gridWidth() - 1u), 1.0)));
  let previousX = i32(globalId.x) + shiftPixels;

  var naiveValue = currentValue;
  if (hasHistorySurface(previousSurface[index])) {
    naiveValue = mix(currentValue, previousNaiveAccum[index].x, historyBlend());
  }
  naiveAccum[index] = vec4f(naiveValue, 0.0, 0.0, 0.0);

  var stabilizedValue = currentValue;
  var validHistory = false;
  var historyValue = currentValue;
  if (previousX >= 0 && previousX < i32(gridWidth())) {
    let previousIndex = i32(globalId.y) * i32(gridWidth()) + previousX;
    let previousSurfaceInfo = previousSurface[u32(previousIndex)];
    if (hasHistorySurface(previousSurfaceInfo)) {
      let depthDelta = abs(surface.x - previousSurfaceInfo.x);
      let ownerMatch = surface.z == previousSurfaceInfo.z || (surface.z < 0.0 && previousSurfaceInfo.z < 0.0);
      if (depthDelta <= 0.14 && ownerMatch) {
        validHistory = true;
        historyValue = previousStabilizedAccum[u32(previousIndex)].x;
      }
    }
  }

  if (validHistory) {
    var minValue = currentValue;
    var maxValue = currentValue;
    for (var offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (var offsetX = -1; offsetX <= 1; offsetX += 1) {
        let nx = i32(globalId.x) + offsetX;
        let ny = i32(globalId.y) + offsetY;
        if (nx < 0 || ny < 0 || nx >= i32(gridWidth()) || ny >= i32(gridHeight())) {
          continue;
        }
        let neighborIndex = u32(ny) * gridWidth() + u32(nx);
        let neighborSurface = currentSurface[neighborIndex];
        let depthCompatible = abs(surface.x - neighborSurface.x) <= 0.14;
        let modulationCompatible = abs(surface.y - neighborSurface.y) <= 0.18;
        let ownerCompatible = surface.z == neighborSurface.z || (surface.z < 0.0 && neighborSurface.z < 0.0);
        if (!(depthCompatible && modulationCompatible && ownerCompatible)) {
          continue;
        }
        minValue = min(minValue, currentValues[neighborIndex].x - clampStrength());
        maxValue = max(maxValue, currentValues[neighborIndex].x + clampStrength());
      }
    }
    let clampedHistory = clamp(historyValue, minValue, maxValue);
    stabilizedValue = mix(currentValue, clampedHistory, historyBlend());
  }
  stabilizedAccum[index] = vec4f(stabilizedValue, 0.0, 0.0, 0.0);
}
