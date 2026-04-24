import {
  addVectors,
  scaleVector,
  subtractVectors,
  type Vector3,
} from "@/lessons/path-tracing-common/math";
import type { CornellSceneBox } from "@/lessons/path-tracing-common/scene";

export type BvhBounds = {
  min: Vector3;
  max: Vector3;
};

export type BvhLeaf = {
  primitiveIndex: number;
  depth: number;
};

export type BvhNode = {
  bounds: BvhBounds;
  depth: number;
  left: BvhNode | null;
  right: BvhNode | null;
  primitiveIndices: number[];
};

export type FlatBvhNode = {
  min: Vector3;
  max: Vector3;
  leftIndex: number;
  rightIndex: number;
  primitiveStart: number;
  primitiveCount: number;
  depth: number;
};

export type FlatBvh = {
  nodes: FlatBvhNode[];
  primitiveOrder: number[];
  maxDepth: number;
};

export type TraceStats = {
  primitiveTests: number;
  nodeVisits: number;
  hitPrimitiveIndex: number | null;
};

type IntersectionRange = {
  near: number;
  far: number;
};

function boundsForBox(box: CornellSceneBox): BvhBounds {
  return {
    min: [...box.min] as Vector3,
    max: [...box.max] as Vector3,
  };
}

function unionBounds(left: BvhBounds, right: BvhBounds): BvhBounds {
  return {
    min: [
      Math.min(left.min[0], right.min[0]),
      Math.min(left.min[1], right.min[1]),
      Math.min(left.min[2], right.min[2]),
    ],
    max: [
      Math.max(left.max[0], right.max[0]),
      Math.max(left.max[1], right.max[1]),
      Math.max(left.max[2], right.max[2]),
    ],
  };
}

function centroid(box: CornellSceneBox): Vector3 {
  return addVectors(box.min, scaleVector(subtractVectors(box.max, box.min), 0.5));
}

function axisLength(bounds: BvhBounds, axis: 0 | 1 | 2): number {
  return bounds.max[axis] - bounds.min[axis];
}

function longestAxis(bounds: BvhBounds): 0 | 1 | 2 {
  const x = axisLength(bounds, 0);
  const y = axisLength(bounds, 1);
  const z = axisLength(bounds, 2);
  if (x >= y && x >= z) {
    return 0;
  }
  if (y >= z) {
    return 1;
  }
  return 2;
}

function boundsForIndices(boxes: CornellSceneBox[], indices: number[]): BvhBounds {
  let current = boundsForBox(boxes[indices[0]]);
  for (let index = 1; index < indices.length; index += 1) {
    current = unionBounds(current, boundsForBox(boxes[indices[index]]));
  }
  return current;
}

function buildNode(
  boxes: CornellSceneBox[],
  indices: number[],
  depth: number,
  leafSize: number
): BvhNode {
  const bounds = boundsForIndices(boxes, indices);
  if (indices.length <= leafSize) {
    return {
      bounds,
      depth,
      left: null,
      right: null,
      primitiveIndices: [...indices],
    };
  }

  const axis = longestAxis(bounds);
  const sorted = [...indices].sort((leftIndex, rightIndex) => {
    return centroid(boxes[leftIndex])[axis] - centroid(boxes[rightIndex])[axis];
  });
  const split = Math.max(1, Math.floor(sorted.length / 2));
  return {
    bounds,
    depth,
    left: buildNode(boxes, sorted.slice(0, split), depth + 1, leafSize),
    right: buildNode(boxes, sorted.slice(split), depth + 1, leafSize),
    primitiveIndices: [],
  };
}

export function buildFlatBvh(boxes: CornellSceneBox[], leafSize = 2): FlatBvh {
  const root = buildNode(
    boxes,
    boxes.map((_, index) => index),
    0,
    Math.max(1, leafSize)
  );

  const nodes: FlatBvhNode[] = [];
  const primitiveOrder: number[] = [];
  let maxDepth = 0;

  function flatten(node: BvhNode): number {
    const currentIndex = nodes.length;
    nodes.push({
      min: node.bounds.min,
      max: node.bounds.max,
      leftIndex: -1,
      rightIndex: -1,
      primitiveStart: primitiveOrder.length,
      primitiveCount: node.primitiveIndices.length,
      depth: node.depth,
    });
    maxDepth = Math.max(maxDepth, node.depth);

    if (node.primitiveIndices.length > 0) {
      primitiveOrder.push(...node.primitiveIndices);
    } else {
      const leftIndex = node.left ? flatten(node.left) : -1;
      const rightIndex = node.right ? flatten(node.right) : -1;
      nodes[currentIndex].leftIndex = leftIndex;
      nodes[currentIndex].rightIndex = rightIndex;
    }
    return currentIndex;
  }

  flatten(root);

  return {
    nodes,
    primitiveOrder,
    maxDepth,
  };
}

export function flattenBvhData(flatBvh: FlatBvh): Float32Array {
  const data = new Float32Array(flatBvh.nodes.length * 16);
  flatBvh.nodes.forEach((node, index) => {
    const offset = index * 16;
    data.set([...node.min, node.leftIndex], offset);
    data.set([...node.max, node.rightIndex], offset + 4);
    data.set([node.primitiveStart, node.primitiveCount, node.depth, 0], offset + 8);
  });
  return data;
}

export function computeLeafDepths(flatBvh: FlatBvh): number[] {
  const output = new Array(flatBvh.primitiveOrder.length).fill(0);
  flatBvh.nodes.forEach((node) => {
    if (node.primitiveCount <= 0) {
      return;
    }
    for (let index = 0; index < node.primitiveCount; index += 1) {
      output[flatBvh.primitiveOrder[node.primitiveStart + index]] = node.depth;
    }
  });
  return output;
}

function intersectBounds(
  origin: Vector3,
  direction: Vector3,
  bounds: BvhBounds
): IntersectionRange | null {
  const invDirection: Vector3 = [
    1 / Math.max(Math.abs(direction[0]), 1e-6) * Math.sign(direction[0] || 1),
    1 / Math.max(Math.abs(direction[1]), 1e-6) * Math.sign(direction[1] || 1),
    1 / Math.max(Math.abs(direction[2]), 1e-6) * Math.sign(direction[2] || 1),
  ];
  const t0 = [
    (bounds.min[0] - origin[0]) * invDirection[0],
    (bounds.min[1] - origin[1]) * invDirection[1],
    (bounds.min[2] - origin[2]) * invDirection[2],
  ] as Vector3;
  const t1 = [
    (bounds.max[0] - origin[0]) * invDirection[0],
    (bounds.max[1] - origin[1]) * invDirection[1],
    (bounds.max[2] - origin[2]) * invDirection[2],
  ] as Vector3;
  const near = [
    Math.min(t0[0], t1[0]),
    Math.min(t0[1], t1[1]),
    Math.min(t0[2], t1[2]),
  ] as Vector3;
  const far = [
    Math.max(t0[0], t1[0]),
    Math.max(t0[1], t1[1]),
    Math.max(t0[2], t1[2]),
  ] as Vector3;
  const tNear = Math.max(Math.max(near[0], near[1]), near[2]);
  const tFar = Math.min(Math.min(far[0], far[1]), far[2]);
  if (tFar < Math.max(tNear, 0)) {
    return null;
  }
  return {
    near: Math.max(tNear, 0),
    far: tFar,
  };
}

function intersectBox(origin: Vector3, direction: Vector3, box: CornellSceneBox): IntersectionRange | null {
  return intersectBounds(origin, direction, boundsForBox(box));
}

export function traceBruteForce(
  boxes: CornellSceneBox[],
  origin: Vector3,
  direction: Vector3
): TraceStats {
  let hitPrimitiveIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let primitiveTests = 0;
  for (let index = 0; index < boxes.length; index += 1) {
    primitiveTests += 1;
    const hit = intersectBox(origin, direction, boxes[index]);
    if (hit && hit.near < nearestDistance) {
      nearestDistance = hit.near;
      hitPrimitiveIndex = index;
    }
  }
  return {
    primitiveTests,
    nodeVisits: 0,
    hitPrimitiveIndex,
  };
}

export function traceBvh(
  boxes: CornellSceneBox[],
  flatBvh: FlatBvh,
  origin: Vector3,
  direction: Vector3
): TraceStats {
  const stack: Array<{ nodeIndex: number; near: number }> = [{ nodeIndex: 0, near: 0 }];
  let primitiveTests = 0;
  let nodeVisits = 0;
  let hitPrimitiveIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  while (stack.length > 0) {
    const { nodeIndex, near } = stack.pop()!;
    if (near > nearestDistance) {
      continue;
    }
    const node = flatBvh.nodes[nodeIndex];
    nodeVisits += 1;
    const hitNode = intersectBounds(origin, direction, { min: node.min, max: node.max });
    if (!hitNode) {
      continue;
    }
    if (hitNode.near > nearestDistance) {
      continue;
    }
    if (node.primitiveCount > 0) {
      for (let index = 0; index < node.primitiveCount; index += 1) {
        const primitiveIndex = flatBvh.primitiveOrder[node.primitiveStart + index];
        primitiveTests += 1;
        const hit = intersectBox(origin, direction, boxes[primitiveIndex]);
        if (hit && hit.near < nearestDistance) {
          nearestDistance = hit.near;
          hitPrimitiveIndex = primitiveIndex;
        }
      }
      continue;
    }
    const children: Array<{ nodeIndex: number; near: number }> = [];
    if (node.leftIndex >= 0) {
      const leftNode = flatBvh.nodes[node.leftIndex];
      const leftHit = intersectBounds(origin, direction, { min: leftNode.min, max: leftNode.max });
      if (leftHit) {
        children.push({ nodeIndex: node.leftIndex, near: leftHit.near });
      }
    }
    if (node.rightIndex >= 0) {
      const rightNode = flatBvh.nodes[node.rightIndex];
      const rightHit = intersectBounds(origin, direction, { min: rightNode.min, max: rightNode.max });
      if (rightHit) {
        children.push({ nodeIndex: node.rightIndex, near: rightHit.near });
      }
    }
    children.sort((left, right) => right.near - left.near);
    for (const child of children) {
      stack.push(child);
    }
  }

  return {
    primitiveTests,
    nodeVisits,
    hitPrimitiveIndex,
  };
}
