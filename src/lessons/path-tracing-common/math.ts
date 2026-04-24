export type Vector2 = [number, number];
export type Vector3 = [number, number, number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function addVectors(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function subtractVectors(left: Vector3, right: Vector3): Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function scaleVector(vector: Vector3, scale: number): Vector3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

export function dotVectors(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export function crossVectors(left: Vector3, right: Vector3): Vector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

export function lengthOfVector(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = lengthOfVector(vector);
  if (length < 0.000001) {
    return [0, 0, 0];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function reflectVector(vector: Vector3, normal: Vector3): Vector3 {
  const scale = 2 * dotVectors(vector, normal);
  return subtractVectors(vector, scaleVector(normal, scale));
}

export function createIdentityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

export function createTranslationMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

export function createScaleMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]);
}

export function createRotationYMatrix(angleRad: number): Float32Array {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);
  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ]);
}

export function multiplyMatrices(left: Float32Array, right: Float32Array): Float32Array {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        left[row] * right[column * 4] +
        left[4 + row] * right[column * 4 + 1] +
        left[8 + row] * right[column * 4 + 2] +
        left[12 + row] * right[column * 4 + 3];
    }
  }
  return result;
}

export function createLookAtViewMatrix(
  eye: Vector3,
  target: Vector3,
  up: Vector3
): Float32Array {
  const back = normalizeVector(subtractVectors(eye, target));
  const right = normalizeVector(crossVectors(up, back));
  const cameraUp = crossVectors(back, right);
  return new Float32Array([
    right[0], cameraUp[0], back[0], 0,
    right[1], cameraUp[1], back[1], 0,
    right[2], cameraUp[2], back[2], 0,
    -dotVectors(right, eye), -dotVectors(cameraUp, eye), -dotVectors(back, eye), 1,
  ]);
}

export function createPerspectiveMatrix(
  fieldOfViewRad: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(fieldOfViewRad * 0.5);
  const rangeInv = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * rangeInv, -1,
    0, 0, near * far * rangeInv, 0,
  ]);
}

export function createBasisFromNormal(normal: Vector3): {
  tangent: Vector3;
  bitangent: Vector3;
  normal: Vector3;
} {
  const n = normalizeVector(normal);
  const helper = Math.abs(n[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0];
  const tangent = normalizeVector(crossVectors(helper as Vector3, n));
  const bitangent = crossVectors(n, tangent);
  return { tangent, bitangent, normal: n };
}

export function toWorldDirection(localDirection: Vector3, normal: Vector3): Vector3 {
  const basis = createBasisFromNormal(normal);
  return normalizeVector([
    basis.tangent[0] * localDirection[0] +
      basis.normal[0] * localDirection[1] +
      basis.bitangent[0] * localDirection[2],
    basis.tangent[1] * localDirection[0] +
      basis.normal[1] * localDirection[1] +
      basis.bitangent[1] * localDirection[2],
    basis.tangent[2] * localDirection[0] +
      basis.normal[2] * localDirection[1] +
      basis.bitangent[2] * localDirection[2],
  ]);
}

export function projectHemisphereDirection(direction: Vector3): Vector2 {
  return [direction[0], -direction[2]];
}

export function radialDistanceSquared(left: Vector2, right: Vector2): number {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  return dx * dx + dy * dy;
}
