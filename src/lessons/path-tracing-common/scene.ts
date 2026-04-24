import {
  addVectors,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  scaleVector,
  type Vector3,
} from "@/lessons/path-tracing-common/math";

export type CornellSceneBox = {
  min: Vector3;
  max: Vector3;
  albedo: Vector3;
  emission: Vector3;
  roughness?: number;
};

export type PathTracingSceneLight = {
  center: Vector3;
  halfSize: Vector3;
  color: Vector3;
};

export type PathTracingScenePreset = {
  cameraEye: Vector3;
  cameraTarget: Vector3;
  boxes: CornellSceneBox[];
  light: PathTracingSceneLight;
};

export type ManyLightsRoomLight = {
  position: [number, number];
  color: Vector3;
  intensity: number;
  radius: number;
};

export type ManyLightsRoomOccluder = {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  roughness: number;
};

export type ManyLightsRoomPreset = {
  width: number;
  height: number;
  lights: ManyLightsRoomLight[];
  occluders: ManyLightsRoomOccluder[];
  receiverY: number;
  receiverRange: [number, number];
};

export type CornellRasterObject = {
  modelMatrix: Float32Array;
  albedo: [number, number, number, number];
  emission: [number, number, number, number];
};

export const CORNELL_CAMERA = {
  eye: [0, 1.0, 4.9] as Vector3,
  target: [0, 1.05, 0] as Vector3,
};

const CORNELL_BOXES: CornellSceneBox[] = [
  { min: [-1.6, -0.02, -1.6], max: [1.6, 0.0, 1.6], albedo: [0.76, 0.76, 0.76], emission: [0, 0, 0] },
  { min: [-1.6, 2.4, -1.6], max: [1.6, 2.42, 1.6], albedo: [0.76, 0.76, 0.76], emission: [0, 0, 0] },
  { min: [-1.6, 0.0, -1.62], max: [1.6, 2.4, -1.6], albedo: [0.76, 0.76, 0.76], emission: [0, 0, 0] },
  { min: [-1.62, 0.0, -1.6], max: [-1.6, 2.4, 1.6], albedo: [0.78, 0.22, 0.18], emission: [0, 0, 0] },
  { min: [1.6, 0.0, -1.6], max: [1.62, 2.4, 1.6], albedo: [0.2, 0.68, 0.24], emission: [0, 0, 0] },
  { min: [-1.0, 2.39, -0.5], max: [1.0, 2.41, 0.55], albedo: [1.0, 0.95, 0.82], emission: [9.5, 8.7, 7.6] },
  { min: [-0.95, 0.0, -0.65], max: [-0.1, 1.0, 0.15], albedo: [0.72, 0.72, 0.78], emission: [0, 0, 0] },
  { min: [0.28, 0.0, -1.0], max: [1.02, 1.65, -0.18], albedo: [0.82, 0.72, 0.58], emission: [0, 0, 0] },
];

function createDenseRoomBoxes(count: number): CornellSceneBox[] {
  const boxes = createCornellSceneBoxes();
  const clampedCount = Math.max(8, Math.min(count, 96));
  const columns = Math.ceil(Math.sqrt(clampedCount));
  const rows = Math.ceil(clampedCount / columns);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (index >= clampedCount) {
        break;
      }
      const centerX = -1.15 + (column / Math.max(columns - 1, 1)) * 2.3;
      const centerZ = -1.12 + (row / Math.max(rows - 1, 1)) * 2.15;
      const height = 0.35 + ((index * 23) % 11) * 0.08;
      const width = 0.12 + ((index * 17) % 7) * 0.025;
      const depth = 0.12 + ((index * 29) % 5) * 0.03;
      const tint = ((index * 19) % 13) / 12;
      boxes.push({
        min: [centerX - width, 0.0, centerZ - depth],
        max: [centerX + width, height, centerZ + depth],
        albedo: [0.22 + tint * 0.38, 0.28 + tint * 0.22, 0.46 + tint * 0.26],
        emission: [0, 0, 0],
        roughness: 0.72,
      });
    }
  }
  return boxes;
}

function createNeeRoomBoxes(lightWidth: number): { boxes: CornellSceneBox[]; light: PathTracingSceneLight } {
  const boxes = createCornellSceneBoxes();
  boxes.push({
    min: [-0.2, 0.0, -0.32],
    max: [0.24, 1.45, 0.34],
    albedo: [0.74, 0.72, 0.76],
    emission: [0, 0, 0],
    roughness: 1,
  });
  return {
    boxes,
    light: {
      center: [0, 2.39, -0.06],
      halfSize: [lightWidth * 0.5, 0.01, 0.34],
      color: [10.5, 9.8, 8.8],
    },
  };
}

function createGlossyRoomBoxes(): { boxes: CornellSceneBox[]; light: PathTracingSceneLight } {
  const boxes = createCornellSceneBoxes();
  boxes.push({
    min: [-0.92, 0.0, -0.52],
    max: [-0.18, 0.76, 0.22],
    albedo: [0.84, 0.84, 0.88],
    emission: [0, 0, 0],
    roughness: 0.14,
  });
  boxes.push({
    min: [0.18, 0.0, -0.98],
    max: [1.02, 1.18, -0.14],
    albedo: [0.82, 0.72, 0.58],
    emission: [0, 0, 0],
    roughness: 0.62,
  });
  return {
    boxes,
    light: {
      center: [0, 2.39, -0.12],
      halfSize: [0.34, 0.01, 0.22],
      color: [11.0, 10.0, 8.9],
    },
  };
}

function createDirectLightingRoomBoxes(): { boxes: CornellSceneBox[]; light: PathTracingSceneLight } {
  const boxes = createCornellSceneBoxes();
  boxes.push({
    min: [-0.88, 0.0, -0.32],
    max: [-0.1, 1.12, 0.28],
    albedo: [0.78, 0.78, 0.82],
    emission: [0, 0, 0],
    roughness: 0.16,
  });
  boxes.push({
    min: [0.26, 0.0, -1.0],
    max: [1.06, 1.62, -0.16],
    albedo: [0.82, 0.72, 0.58],
    emission: [0, 0, 0],
    roughness: 0.72,
  });
  return {
    boxes,
    light: {
      center: [0, 2.39, -0.08],
      halfSize: [0.42, 0.01, 0.24],
      color: [12.4, 11.2, 10.0],
    },
  };
}

export function createCornellSceneBoxes(): CornellSceneBox[] {
  return CORNELL_BOXES.map((box) => ({
    min: [...box.min] as Vector3,
    max: [...box.max] as Vector3,
    albedo: [...box.albedo] as Vector3,
    emission: [...box.emission] as Vector3,
  }));
}

export function createPathTracingScenePreset(
  kind: "dense" | "nee" | "glossy" | "direct-lighting",
  detail = 56,
  lightScale = 1
): PathTracingScenePreset {
  if (kind === "dense") {
    return {
      cameraEye: [0, 1.0, 5.2],
      cameraTarget: [0, 1.02, 0],
      boxes: createDenseRoomBoxes(detail),
      light: {
        center: [0, 2.39, -0.06],
        halfSize: [0.48, 0.01, 0.26],
        color: [10.8, 10.0, 8.9],
      },
    };
  }

  if (kind === "nee") {
    const result = createNeeRoomBoxes(0.42 * lightScale);
    return {
      cameraEye: [0, 1.0, 4.9],
      cameraTarget: [0, 1.05, 0],
      boxes: result.boxes,
      light: result.light,
    };
  }

  if (kind === "glossy") {
    const result = createGlossyRoomBoxes();
    return {
      cameraEye: [0.05, 1.02, 4.8],
      cameraTarget: [0.05, 1.0, 0],
      boxes: result.boxes,
      light: result.light,
    };
  }

  const result = createDirectLightingRoomBoxes();
  return {
    cameraEye: [0, 1.02, 4.85],
    cameraTarget: [0.02, 1.05, 0],
    boxes: result.boxes,
    light: result.light,
  };
}

export function createManyLightsRoomPreset(lightCount: number): ManyLightsRoomPreset {
  const clampedLights = Math.max(16, Math.min(lightCount, 128));
  const lights: ManyLightsRoomLight[] = [];
  const columns = Math.ceil(clampedLights / 2);
  for (let index = 0; index < clampedLights; index += 1) {
    const row = index % 2;
    const column = Math.floor(index / 2);
    const t = column / Math.max(columns - 1, 1);
    lights.push({
      position: [0.1 + t * 0.8, row === 0 ? 0.1 : 0.18],
      color: [
        0.8 + ((index * 17) % 9) * 0.03,
        0.56 + ((index * 29) % 7) * 0.04,
        0.42 + ((index * 11) % 11) * 0.03,
      ],
      intensity: 2.8 + ((index * 23) % 8) * 0.22,
      radius: row === 0 ? 0.038 : 0.028,
    });
  }

  return {
    width: 1,
    height: 1,
    lights,
    occluders: [
      { x: 0.17, y: 0.28, width: 0.12, height: 0.34, depth: 0.42, roughness: 0.16 },
      { x: 0.42, y: 0.18, width: 0.14, height: 0.5, depth: 0.5, roughness: 0.38 },
      { x: 0.7, y: 0.4, width: 0.18, height: 0.22, depth: 0.35, roughness: 0.72 },
    ],
    receiverY: 0.88,
    receiverRange: [0.08, 0.92],
  };
}

export function createCornellSceneStorageData(): Float32Array {
  const data = new Float32Array(CORNELL_BOXES.length * 16);
  CORNELL_BOXES.forEach((box, index) => {
    const offset = index * 16;
    data.set([...box.min, 0], offset);
    data.set([...box.max, 0], offset + 4);
    data.set([...box.albedo, 0], offset + 8);
    data.set([...box.emission, 0], offset + 12);
  });
  return data;
}

export function createCornellRasterObjects(): CornellRasterObject[] {
  return CORNELL_BOXES.map((box) => {
    const size = [
      box.max[0] - box.min[0],
      box.max[1] - box.min[1],
      box.max[2] - box.min[2],
    ] as Vector3;
    const center = addVectors(box.min, scaleVector(size, 0.5));
    const modelMatrix = multiplyMatrices(
      createTranslationMatrix(center[0], center[1], center[2]),
      createScaleMatrix(size[0], size[1], size[2])
    );
    return {
      modelMatrix,
      albedo: [box.albedo[0], box.albedo[1], box.albedo[2], 1],
      emission: [box.emission[0], box.emission[1], box.emission[2], 1],
    };
  });
}

export function getCornellLightPosition(): Vector3 {
  return [0, 2.32, 0.02];
}

export function getCornellLightColor(): Vector3 {
  return [11.0, 10.2, 9.0];
}
