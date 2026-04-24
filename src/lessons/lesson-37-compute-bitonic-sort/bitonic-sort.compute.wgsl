struct SortUniforms {
  paramsU32: vec4u,
  paramsF32: vec4f,
};

struct SortItem {
  payload: vec4f,
};

@group(0) @binding(0) var<uniform> sortUniforms: SortUniforms;
@group(0) @binding(1) var<storage, read> currentItems: array<SortItem>;
@group(0) @binding(2) var<storage, read_write> nextItems: array<SortItem>;

fn pickLower(left: SortItem, right: SortItem) -> SortItem {
  if (left.payload.x <= right.payload.x) {
    return left;
  }
  return right;
}

fn pickHigher(left: SortItem, right: SortItem) -> SortItem {
  if (left.payload.x <= right.payload.x) {
    return right;
  }
  return left;
}

@compute @workgroup_size(64, 1, 1)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let itemCount = sortUniforms.paramsU32.x;
  if (globalId.x >= itemCount) {
    return;
  }

  let compareDistance = sortUniforms.paramsU32.y;
  let sequenceSize = sortUniforms.paramsU32.z;
  let partnerIndex = globalId.x ^ compareDistance;

  let currentItem = currentItems[globalId.x];
  let partnerItem = currentItems[partnerIndex];
  let lowerItem = pickLower(currentItem, partnerItem);
  let higherItem = pickHigher(currentItem, partnerItem);

  let ascending = (globalId.x & sequenceSize) == 0u;
  let lowerHalf = (globalId.x & compareDistance) == 0u;
  let shouldTakeLower = (ascending && lowerHalf) || (!ascending && !lowerHalf);

  if (shouldTakeLower) {
    nextItems[globalId.x] = lowerItem;
  } else {
    nextItems[globalId.x] = higherItem;
  }
}
