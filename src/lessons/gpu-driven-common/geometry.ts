export type GpuDrivenMeshGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

export type GpuDrivenSceneGeometry = {
  lod0: GpuDrivenMeshGeometry;
  lod1: GpuDrivenMeshGeometry;
  lod2: GpuDrivenMeshGeometry;
  sphere: GpuDrivenMeshGeometry;
};

type BoxPart = {
  translation: [number, number, number];
  scale: [number, number, number];
};

const BOX_FACE_VERTICES = [
  // front
  [-0.5, 0.5, 0.5, 0, 0, 1],
  [-0.5, -0.5, 0.5, 0, 0, 1],
  [0.5, -0.5, 0.5, 0, 0, 1],
  [0.5, 0.5, 0.5, 0, 0, 1],
  // right
  [0.5, 0.5, 0.5, 1, 0, 0],
  [0.5, -0.5, 0.5, 1, 0, 0],
  [0.5, -0.5, -0.5, 1, 0, 0],
  [0.5, 0.5, -0.5, 1, 0, 0],
  // back
  [0.5, 0.5, -0.5, 0, 0, -1],
  [0.5, -0.5, -0.5, 0, 0, -1],
  [-0.5, -0.5, -0.5, 0, 0, -1],
  [-0.5, 0.5, -0.5, 0, 0, -1],
  // left
  [-0.5, 0.5, -0.5, -1, 0, 0],
  [-0.5, -0.5, -0.5, -1, 0, 0],
  [-0.5, -0.5, 0.5, -1, 0, 0],
  [-0.5, 0.5, 0.5, -1, 0, 0],
  // top
  [-0.5, 0.5, -0.5, 0, 1, 0],
  [-0.5, 0.5, 0.5, 0, 1, 0],
  [0.5, 0.5, 0.5, 0, 1, 0],
  [0.5, 0.5, -0.5, 0, 1, 0],
  // bottom
  [-0.5, -0.5, 0.5, 0, -1, 0],
  [-0.5, -0.5, -0.5, 0, -1, 0],
  [0.5, -0.5, -0.5, 0, -1, 0],
  [0.5, -0.5, 0.5, 0, -1, 0],
] as const;

const BOX_INDICES = [
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23,
] as const;

function appendBox(
  vertexData: number[],
  indexData: number[],
  baseIndex: number,
  part: BoxPart
): number {
  BOX_FACE_VERTICES.forEach((vertex) => {
    vertexData.push(
      vertex[0] * part.scale[0] + part.translation[0],
      vertex[1] * part.scale[1] + part.translation[1],
      vertex[2] * part.scale[2] + part.translation[2],
      vertex[3],
      vertex[4],
      vertex[5]
    );
  });

  BOX_INDICES.forEach((index) => {
    indexData.push(baseIndex + index);
  });

  return baseIndex + 24;
}

function createMeshFromBoxes(parts: BoxPart[]): GpuDrivenMeshGeometry {
  const vertexData: number[] = [];
  const indexData: number[] = [];
  let baseIndex = 0;

  parts.forEach((part) => {
    baseIndex = appendBox(vertexData, indexData, baseIndex, part);
  });

  return {
    vertexData: new Float32Array(vertexData),
    indexData: new Uint16Array(indexData),
    indexCount: indexData.length,
  };
}

function createSphereGeometry(
  latitudeSegments = 8,
  longitudeSegments = 12
): GpuDrivenMeshGeometry {
  const vertexData: number[] = [];
  const indexData: number[] = [];

  for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
    const v = latitude / latitudeSegments;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let longitude = 0; longitude <= longitudeSegments; longitude += 1) {
      const u = longitude / longitudeSegments;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const x = sinTheta * cosPhi;
      const y = cosTheta;
      const z = sinTheta * sinPhi;

      vertexData.push(x, y, z, x, y, z);
    }
  }

  for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const rowStride = longitudeSegments + 1;
      const topLeft = latitude * rowStride + longitude;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowStride;
      const bottomRight = bottomLeft + 1;

      indexData.push(topLeft, bottomLeft, topRight);
      indexData.push(topRight, bottomLeft, bottomRight);
    }
  }

  return {
    vertexData: new Float32Array(vertexData),
    indexData: new Uint16Array(indexData),
    indexCount: indexData.length,
  };
}

/**
 * 创建 60-64 课共用的三档 LOD 和包围球网格。
 * @returns {GpuDrivenSceneGeometry} 对应的 LOD mesh 与低面数球体网格。
 */
export function createGpuDrivenSceneGeometry(): GpuDrivenSceneGeometry {
  const lod0 = createMeshFromBoxes([
    { translation: [0, 0.42, 0], scale: [0.62, 0.84, 0.62] },
    { translation: [0, -0.12, 0], scale: [0.92, 0.26, 0.92] },
    { translation: [-0.42, 0.08, 0], scale: [0.18, 0.48, 0.18] },
    { translation: [0.42, 0.08, 0], scale: [0.18, 0.48, 0.18] },
    { translation: [0, 0.92, 0], scale: [0.38, 0.18, 0.38] },
  ]);

  const lod1 = createMeshFromBoxes([
    { translation: [0, 0.35, 0], scale: [0.66, 0.7, 0.66] },
    { translation: [0, -0.14, 0], scale: [0.9, 0.28, 0.9] },
    { translation: [0, 0.86, 0], scale: [0.26, 0.14, 0.26] },
  ]);

  const lod2 = createMeshFromBoxes([
    { translation: [0, 0.3, 0], scale: [0.62, 0.6, 0.62] },
  ]);

  return {
    lod0,
    lod1,
    lod2,
    sphere: createSphereGeometry(),
  };
}
