import { courseItems, lessons } from "@/studio/lessons";
import type {
  LessonDefinition,
  LessonSource,
  PreviewStatus,
  PreviewTone,
} from "@/studio/types";

const defaultStatus: PreviewStatus = {
  title: "等待预览",
  detail: "选择一个 lesson 后会在中间挂载运行结果。",
  tone: "info",
};

/**
 * 转义代码内容中的 HTML 字符，避免源码展示时被当成真实标签解析。
 * @param {string} content 原始代码字符串。
 * @returns {string} 可安全插入 HTML 的文本。
 */
function escapeHtml(content: string): string {
  return content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * 把源码语言标识转换成更适合界面展示的名称。
 * @param {string} language 源码语言标识。
 * @returns {string} 适合展示在代码头部的语言名称。
 */
function languageLabel(language: string): string {
  if (language === "ts") {
    return "TypeScript";
  }
  if (language === "wgsl") {
    return "WGSL";
  }
  return language.toUpperCase();
}

/**
 * 把数字索引转换成字母序列，用作代码高亮的临时占位符。
 * @param {number} index 占位符索引。
 * @returns {string} 对应的字母序列。
 */
function indexToLetters(index: number): string {
  let current = index;
  let output = "";

  do {
    output = String.fromCharCode(97 + (current % 26)) + output;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return output;
}

/**
 * 根据内联代码内容推断更合适的高亮类别。
 * @param {string} content 反引号中的原始内容。
 * @returns {string} 对应的样式类名。
 */
function inlineCodeClass(content: string): string {
  const value = content.trim();

  if (
    value.startsWith("@") ||
      /\b(vertex_index|instance_index|global_invocation_id|local_invocation_id|local_invocation_index|workgroup_id|num_workgroups|position|builtin|group|binding|uniform|storage|read_write|uv|normal|worldPosition|eyePosition|materialParams|shadowPosition|lightViewProjectionMatrix|lightOneViewProjectionMatrix|lightTwoViewProjectionMatrix|cameraViewProjectionMatrix|direction|lightOneDirection|lightTwoDirection|lightOneColor|lightTwoColor|shadowTextureOne|shadowTextureTwo|markerColor|translation|rotation|scale|cameraPosition|baseColor|metallic|roughness|normalTexture|metallicRoughnessTexture|baseColorFactor|JOINTS_0|WEIGHTS_0|inverseBindMatrices|jointMatrices|lightPosition|querySet|timestampWrites|occlusionQuerySet|volumeTexture|volumeSampler|volumeParams|animationParams|surfaceParams|sliceParams|localPosition|sliceDepth|densityGain|stepSpacing|counts|surface|metaballs|meshVertices|counters|clusterInfo|depthParams|positionRange|colorIntensity|clusterCounts|clusterLightIndices|viewDepth|lights|pixelInfo|depthBits|colorPacked|fragments|presentSampler|leftTexture|rightTexture)\b/.test(
      value
    )
  ) {
    return "inline-code inline-code--wgsl";
  }

  if (
      /\b(?:GPU[A-Z][A-Za-z0-9]*|HTML[A-Z][A-Za-z0-9]*|Float32Array|Uint16Array|Uint32Array|BigUint64Array|ImageBitmap|VideoFrame|Vector3|Quaternion|OrbitBasis|InstanceGrid|ParticleSeed|GameOfLifeSeed|BoidSeed|SortSeed|BlurParams|ComputeFoundationsSeed|ComputeFoundationsMetrics|ComputeFoundationsSampleRow|ComputeFoundationsHudRefs|PrefixSumSeed|PrefixSumSnapshot|PrefixSumMetrics|PrefixSumSampleRow|PrefixSumHudRefs|FrustumCullingSettings|FrustumCullingHudRefs|VisibilitySettings|VisibilityHudRefs|VisibleListSettings|VisibleListHudRefs|HiZOcclusionSettings|HiZOcclusionHudRefs|HiZLevel|HiZResources|GpuDrivenLodSettings|GpuDrivenLodHudRefs|LodBuffers|GpuDrivenInstance|GpuDrivenSceneData|GpuDrivenMeshGeometry|GpuDrivenSceneGeometry|AlphaBlendPanelMode|AlphaBlendPanelRect|AlphaBlendMetrics|AlphaBlendHudRefs|SpriteConfig|SpriteRenderObject|LoadedGlbScene|LoadedGlbDrawable|LoadedTexturedGlbScene|LoadedTexturedGlbDrawable|LoadedGlbMaterial|LoadedModelAsset|LoadedAnimatedGltfScene|LoadedAnimatedGltfNode|LoadedGltfAnimationClip|LoadedGltfAnimationChannel|RuntimeAnimatedNode|AnimationPath|LoadedPbrGlbScene|LoadedPbrGlbDrawable|LoadedPbrGlbMaterial|LoadedPbrGlbPrimitive|PbrRenderable|HdrToneMapper|HdrSettings|HdrHudRefs|SceneTargets|BloomSettings|BloomHudRefs|BloomTargets|BloomEmitter|EnvironmentCubemap|SsaoSettings|SsaoHudRefs|SsaoTargets|SsaoRenderObject|SsaoLessonGeometry|SsaoUniforms|BlurUniforms|LoadedSkinnedGltfScene|LoadedSkinnedGltfNode|LoadedSkinnedGltfPrimitive|LoadedGltfSkin|RuntimeSkinnedNode|RuntimeSkin|RuntimeRenderable|SkinUniforms|MaterialUniforms|LightState|SphereMesh|PointLightGeometry|SpotLightGeometry|SceneObject|LightData|DepthPrecisionSceneGeometry|RenderTargetBundle|QueryWebGpuCanvas|DepthTarget|QueryHudRefs|MetricState|Color4|SceneObjectConfig|RenderObject|CompressionRuntime|QueryReadback|HiDpiSizingRenderTarget|HiDpiSizingHudRefs|BundleDepthTarget|BundlePanelRect|BundleHudRefs|BundleMetricState|Texture3dSliceDensityData|Texture3dSliceLessonGeometry|Texture3dSliceAxis|Texture3dSliceLayoutMode|Texture3dSlicePanelRect|Texture3dSliceViewport|Texture3dSliceViewportKey|Texture3dSliceHudRefs|Texture3dSliceMetrics|MetaballFieldSettings|MetaballFieldMetrics|ImplicitFieldLessonGeometry|ImplicitFieldLayoutMode|ImplicitFieldPanelRect|ImplicitFieldViewport|ImplicitFieldViewportKey|ImplicitFieldHudRefs|ImplicitFieldMetricState|VolumeDensityData|VolumeLessonGeometry|VolumeViewport|VolumeHudRefs|VolumeMetricState|VolumeLayoutMode|VolumePanelRect|WorkerMessagingMetrics|WorkerMessagingHudRefs|MessageLogEntry|WorkerMessagingRenderer|WorkerMessagingLessonGeometry|WorkerPongMessage|WorkerHeartbeatMessage|MarchingSettings|MarchingMetrics|MarchingHudRefs|ClusteredSettings|ClusterMetrics|ClusterHudRefs|ClusterUniforms|ClusterBounds|ABufferSettings|ABufferStats|ABufferHudRefs|ABufferBuffers|ABufferLessonGeometry|TransparentPaneDefinition|ColorTarget|PanelRect|Light|ComputeUniforms|MeshVertex|DrawCounters|ObjectUniforms|SceneUniforms|RenderBundleLessonGeometry|vec[234]f|mat[234]x[234]f|texture_2d|texture_3d|texture_depth_2d|texture_external|sampler|sampler_comparison|f16|f32|u32)\b/.test(
        value
      ) ||
    /^[A-Z][A-Za-z0-9_]*$/.test(value)
  ) {
    return "inline-code inline-code--type";
  }

  if (/[A-Za-z0-9_.]+\(/.test(value) || value.includes(".")) {
    return "inline-code inline-code--api";
  }

  return "inline-code";
}

/**
 * 为内联代码片段做更细粒度的语法着色。
 * @param {string} content 反引号中的原始内容。
 * @returns {string} 带有内联高亮标签的 HTML 片段。
 */
function highlightInlineCodeContent(content: string): string {
  let text = escapeHtml(content);
  const placeholders: string[] = [];
  const inlineToken = (index: number) => `%%INLINE_TOKEN_${index}%%`;

  const stash = (regex: RegExp, className: string) => {
    text = text.replace(regex, (match) => {
      const token = inlineToken(placeholders.length);
      placeholders.push(`<span class="${className}">${match}</span>`);
      return token;
    });
  };

  const stashMarkup = (
    regex: RegExp,
    render: (match: string, captures: string[]) => string
  ) => {
    text = text.replace(regex, (...args) => {
      const match = args[0] as string;
      const captures = args.slice(1, -2) as string[];
      const token = inlineToken(placeholders.length);
      placeholders.push(render(match, captures));
      return token;
    });
  };

  stash(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "inline-token inline-token--string");
  stash(/\b\d+(?:\.\d+)?\b/g, "inline-token inline-token--number");
  stashMarkup(
    /\((\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*)\)/g,
    (_match, captures) => {
      const [leading, arg, trailing] = captures;
      return `(${leading}<span class="inline-token inline-token--arg">${arg}</span>${trailing})`;
    }
  );

  text = text.replace(
    /@[a-zA-Z_][a-zA-Z0-9_]*/g,
    '<span class="inline-token inline-token--wgsl">$&</span>'
  );
  text = text.replace(
      /\b(?:vertex_index|instance_index|global_invocation_id|local_invocation_id|local_invocation_index|workgroup_id|num_workgroups|position|builtin|group|binding|uniform|storage|read_write|uv|normal|worldPosition|eyePosition|materialParams|shadowPosition|lightViewProjectionMatrix|lightOneViewProjectionMatrix|lightTwoViewProjectionMatrix|cameraViewProjectionMatrix|skyboxViewProjectionMatrix|direction|sampleDirection|lightOneDirection|lightTwoDirection|lightOneColor|lightTwoColor|shadowTextureOne|shadowTextureTwo|markerColor|translation|rotation|scale|baseColorTexture|baseColorSampler|metallicRoughnessTexture|normalTexture|environmentTexture|environmentSampler|cameraPosition|baseColor|pickingColor|selectionState|metallic|roughness|baseColorFactor|reflectivity|JOINTS_0|WEIGHTS_0|inverseBindMatrices|jointMatrices|lightPosition|querySet|timestampWrites|occlusionQuerySet|volumeTexture|volumeSampler|volumeParams|animationParams|surfaceParams|sliceParams|localPosition|sliceDepth|densityGain|stepSpacing|counts|surface|metaballs|meshVertices|counters|clusterInfo|depthParams|positionRange|colorIntensity|clusterCounts|clusterLightIndices|viewDepth|lights|pixelInfo|depthBits|colorPacked|fragments|presentSampler|leftTexture|rightTexture)\b/g,
    '<span class="inline-token inline-token--wgsl">$&</span>'
  );
  text = text.replace(
      /\b(?:GPU[A-Z][A-Za-z0-9]*|HTML[A-Z][A-Za-z0-9]*|Promise|Error|ResizeObserver|Float32Array|Uint16Array|Uint32Array|BigUint64Array|ArrayBuffer|DataView|Uint8Array|ImageBitmap|VideoFrame|Blob|Worker|OffscreenCanvas|MessageEvent|TypeScript|WGSL|Vector3|Quaternion|InstanceGrid|ParticleSeed|GameOfLifeSeed|BoidSeed|SortSeed|BlurParams|ComputeFoundationsSeed|ComputeFoundationsMetrics|ComputeFoundationsSampleRow|ComputeFoundationsHudRefs|PrefixSumSeed|PrefixSumSnapshot|PrefixSumMetrics|PrefixSumSampleRow|PrefixSumHudRefs|FrustumCullingSettings|FrustumCullingHudRefs|VisibilitySettings|VisibilityHudRefs|VisibleListSettings|VisibleListHudRefs|HiZOcclusionSettings|HiZOcclusionHudRefs|HiZLevel|HiZResources|GpuDrivenLodSettings|GpuDrivenLodHudRefs|LodBuffers|GpuDrivenInstance|GpuDrivenSceneData|GpuDrivenMeshGeometry|GpuDrivenSceneGeometry|AlphaBlendPanelMode|AlphaBlendPanelRect|AlphaBlendMetrics|AlphaBlendHudRefs|SpriteConfig|SpriteRenderObject|LoadedGlbScene|LoadedGlbDrawable|LoadedTexturedGlbScene|LoadedTexturedGlbDrawable|LoadedGlbMaterial|LoadedModelAsset|LoadedAnimatedGltfScene|LoadedAnimatedGltfNode|LoadedGltfAnimationClip|LoadedGltfAnimationChannel|RuntimeAnimatedNode|AnimationPath|LoadedPbrGlbScene|LoadedPbrGlbDrawable|LoadedPbrGlbMaterial|LoadedPbrGlbPrimitive|PbrRenderable|HdrToneMapper|HdrSettings|HdrHudRefs|SceneTargets|BloomSettings|BloomHudRefs|BloomTargets|BloomEmitter|EnvironmentCubemap|SsaoSettings|SsaoHudRefs|SsaoTargets|SsaoRenderObject|SsaoLessonGeometry|SsaoUniforms|BlurUniforms|LoadedSkinnedGltfScene|LoadedSkinnedGltfNode|LoadedSkinnedGltfPrimitive|LoadedGltfSkin|RuntimeSkinnedNode|RuntimeSkin|RuntimeRenderable|SkinUniforms|MaterialUniforms|LightState|SphereMesh|PointLightGeometry|SpotLightGeometry|SceneObject|LightData|PickingSceneGeometry|DepthTarget|PickingTarget|Color4|SceneObjectConfig|RenderObject|RenderTargetBundle|QueryWebGpuCanvas|QueryHudRefs|MetricState|CompressionRuntime|QueryReadback|HiDpiSizingRenderTarget|HiDpiSizingHudRefs|BundleDepthTarget|BundlePanelRect|BundleHudRefs|BundleMetricState|Texture3dSliceDensityData|Texture3dSliceLessonGeometry|Texture3dSliceAxis|Texture3dSliceLayoutMode|Texture3dSlicePanelRect|Texture3dSliceViewport|Texture3dSliceViewportKey|Texture3dSliceHudRefs|Texture3dSliceMetrics|MetaballFieldSettings|MetaballFieldMetrics|ImplicitFieldLessonGeometry|ImplicitFieldLayoutMode|ImplicitFieldPanelRect|ImplicitFieldViewport|ImplicitFieldViewportKey|ImplicitFieldHudRefs|ImplicitFieldMetricState|VolumeDensityData|VolumeLessonGeometry|VolumeViewport|VolumeHudRefs|VolumeMetricState|VolumeLayoutMode|VolumePanelRect|WorkerThreadLessonGeometry|WorkerMessagingMetrics|WorkerMessagingHudRefs|MessageLogEntry|CanvasMeasurement|WorkerMessagingRenderer|WorkerMessagingLessonGeometry|SceneFrameData|SharedRenderSettings|WorkerReadyMessage|WorkerSyncMessage|WorkerMetricsMessage|WorkerPongMessage|WorkerHeartbeatMessage|WorkerErrorMessage|ThreadRenderer|MarchingSettings|MarchingMetrics|MarchingHudRefs|ClusteredSettings|ClusterMetrics|ClusterHudRefs|ClusterUniforms|ClusterBounds|ABufferSettings|ABufferStats|ABufferHudRefs|ABufferBuffers|ABufferLessonGeometry|TransparentPaneDefinition|ColorTarget|PanelRect|Light|ComputeUniforms|MeshVertex|DrawCounters|ObjectUniforms|SceneUniforms|DepthPrecisionSceneGeometry|RenderBundleLessonGeometry|vec[234]f|mat[234]x[234]f|texture_2d|texture_3d|texture_cube|texture_depth_2d|texture_external|sampler|sampler_comparison|f16|f32|u32)\b/g,
      '<span class="inline-token inline-token--type">$&</span>'
    );
  text = text.replace(
    /\.([A-Za-z_][A-Za-z0-9_]*)/g,
    '.<span class="inline-token inline-token--api">$1</span>'
  );
  text = text.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/g,
    '<span class="inline-token inline-token--api">$1</span>'
  );

  placeholders.forEach((placeholder, index) => {
    text = text.replaceAll(inlineToken(index), placeholder);
  });

  return text;
}

/**
 * 把文本中的反引号片段渲染成带样式的内联代码。
 * @param {string} content 原始文本内容。
 * @returns {string} 可直接插入 HTML 的富文本结果。
 */
function renderInlineCode(content: string): string {
  return escapeHtml(content).replace(
    /`([^`]+)`/g,
    (_match, code) =>
      `<code class="${inlineCodeClass(code)}">${highlightInlineCodeContent(code)}</code>`
  );
}

/**
 * 将知识点中的“关键词部分”和“解释部分”拆开，便于做更清晰的排版。
 * @param {string} note 原始知识点文本。
 * @returns {{ lead: string | null; body: string }} 拆分后的前导关键词和正文解释。
 */
function splitLessonNote(note: string): { lead: string | null; body: string } {
  const colonIndex = note.indexOf("：");

  if (colonIndex === -1) {
    return {
      lead: null,
      body: note.trim(),
    };
  }

  return {
    lead: note.slice(0, colonIndex).trim(),
    body: note.slice(colonIndex + 1).trim(),
  };
}

/**
 * 把知识点前导部分渲染成自然流式排版，避免换行后留下大块空白。
 * @param {string} content 前导关键词文本。
 * @returns {string} 适合插入标题区域的 HTML。
 */
function renderKnowledgeLead(content: string): string {
  return renderInlineCode(content);
}

/**
 * 把一条知识点渲染成“关键词 + 解释”的课程卡片结构。
 * @param {string} note 原始知识点文本。
 * @returns {string} 可直接插入列表的 HTML。
 */
function renderKnowledgeNote(note: string): string {
  const { lead, body } = splitLessonNote(note);

  if (!lead) {
    return `
      <li class="knowledge-note">
        <p class="knowledge-note__body">${renderInlineCode(body)}</p>
      </li>
    `;
  }

  return `
    <li class="knowledge-note">
      <div class="knowledge-note__headline">${renderKnowledgeLead(lead)}</div>
      <p class="knowledge-note__body">${renderInlineCode(body)}</p>
    </li>
  `;
}

/**
 * 为源码面板生成一份轻量的 HTML 高亮结果。
 * @param {string} line 单行源码内容。
 * @param {string} language 当前源码语言。
 * @returns {string} 带有高亮标签的 HTML 字符串。
 */
function highlightCodeLine(line: string, language: string): string {
  const trimmed = line.trim();
  let text = escapeHtml(line);
  const placeholders: string[] = [];
  const tokens: string[] = [];

  if (
    trimmed.startsWith("/**") ||
    trimmed.startsWith("*/") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("//")
  ) {
    return `<span class="code-comment">${text}</span>`;
  }

  const stash = (regex: RegExp, className: string) => {
    text = text.replace(regex, (match) => {
      const token = `__CODE_TOKEN_${indexToLetters(placeholders.length)}__`;
      placeholders.push(`<span class="${className}">${match}</span>`);
      tokens.push(token);
      return token;
    });
  };

  stash(/\/\*[\s\S]*?\*\//g, "code-comment");
  stash(/\/\/[^\n]*/g, "code-comment");
  stash(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
    "code-string"
  );

  if (language === "ts") {
    text = text.replace(
      /\b(?:import|from|export|async|await|const|let|type|return|if|throw|new|try|catch|void|as)\b/g,
      '<span class="code-keyword">$&</span>'
    );
    text = text.replace(
        /\b(?:HTMLElement|HTMLCanvasElement|HTMLDivElement|HTMLInputElement|PointerEvent|WheelEvent|Promise|Error|Float32Array|Uint16Array|Uint32Array|Uint8Array|BigUint64Array|ArrayBuffer|DataView|ImageBitmap|Blob|GPU[A-Z][A-Za-z0-9]*|ResizeObserver|Vector3|Quaternion|InstanceGrid|ParticleSeed|GameOfLifeSeed|BoidSeed|SortSeed|ComputeFoundationsSeed|ComputeFoundationsMetrics|ComputeFoundationsSampleRow|ComputeFoundationsHudRefs|PrefixSumSeed|PrefixSumSnapshot|PrefixSumMetrics|PrefixSumSampleRow|PrefixSumHudRefs|FrustumCullingSettings|FrustumCullingHudRefs|VisibilitySettings|VisibilityHudRefs|VisibleListSettings|VisibleListHudRefs|HiZOcclusionSettings|HiZOcclusionHudRefs|HiZLevel|HiZResources|GpuDrivenLodSettings|GpuDrivenLodHudRefs|LodBuffers|GpuDrivenInstance|GpuDrivenSceneData|GpuDrivenMeshGeometry|GpuDrivenSceneGeometry|MotionMode|MotionVectorSettings|MotionVectorHudRefs|MotionVectorTargets|TaaSettings|TaaHudRefs|SceneTargets|MotionBlurSettings|MotionBlurHudRefs|MotionBlurTargets|SsrSettings|SsrHudRefs|SsrTargets|DofSettings|DofHudRefs|DofTargets|BilateralSettings|BilateralHudRefs|BilateralTargets|TemporalSettings|TemporalHudRefs|TemporalTargets|SsgiSettings|SsgiHudRefs|SsgiTargets|ContactShadowSettings|ContactShadowHudRefs|ContactShadowTargets|TaauSettings|TaauHudRefs|TaauTargets|AlphaBlendPanelMode|AlphaBlendPanelRect|AlphaBlendMetrics|AlphaBlendHudRefs|SpriteConfig|SpriteRenderObject|LoadedGlbScene|LoadedGlbDrawable|LoadedTexturedGlbScene|LoadedTexturedGlbDrawable|LoadedGlbMaterial|LoadedModelAsset|LoadedAnimatedGltfScene|LoadedAnimatedGltfNode|LoadedGltfAnimationClip|LoadedGltfAnimationChannel|RuntimeAnimatedNode|AnimationPath|LoadedPbrGlbScene|LoadedPbrGlbDrawable|LoadedPbrGlbMaterial|LoadedPbrGlbPrimitive|PbrRenderable|LoadedSkinnedGltfScene|LoadedSkinnedGltfNode|LoadedSkinnedGltfPrimitive|LoadedGltfSkin|RuntimeSkinnedNode|RuntimeSkin|RuntimeRenderable|SkinUniforms|PointLightGeometry|SpotLightGeometry|QueryWebGpuCanvas|DepthTarget|QueryHudRefs|MetricState|Color4|SceneObjectConfig|RenderObject|SsaoSettings|SsaoHudRefs|SsaoTargets|SsaoRenderObject|SsaoLessonGeometry|HiDpiSizingRenderTarget|HiDpiSizingHudRefs|BundleDepthTarget|BundlePanelRect|BundleHudRefs|BundleMetricState|Texture3dSliceDensityData|Texture3dSliceLessonGeometry|Texture3dSliceAxis|Texture3dSliceLayoutMode|Texture3dSlicePanelRect|Texture3dSliceViewport|Texture3dSliceViewportKey|Texture3dSliceHudRefs|Texture3dSliceMetrics|MetaballFieldSettings|MetaballFieldMetrics|ImplicitFieldLessonGeometry|ImplicitFieldLayoutMode|ImplicitFieldPanelRect|ImplicitFieldViewport|ImplicitFieldViewportKey|ImplicitFieldHudRefs|ImplicitFieldMetricState|VolumeDensityData|VolumeLessonGeometry|VolumeViewport|VolumeHudRefs|VolumeMetricState|VolumeLayoutMode|VolumePanelRect|WorkerMessagingMetrics|WorkerMessagingHudRefs|MessageLogEntry|CanvasMeasurement|WorkerMessagingRenderer|WorkerMessagingLessonGeometry|MarchingSettings|MarchingMetrics|MarchingHudRefs|ClusterCullingSettings|ClusterCullingMetrics|SlicePanelRefs|ClusterCullingHudRefs|ClusteredSettings|ClusterMetrics|ClusterHudRefs|ClusterUniforms|ClusterBounds|OitMotivationSettings|OitMotivationMetrics|OitMotivationHudRefs|ABufferSettings|ABufferStats|ABufferHudRefs|ABufferBuffers|ABufferLessonGeometry|OitMotivationLessonGeometry|TransparentPaneDefinition|ColorTarget|PanelRect|Light|MultiCanvasLessonGeometry|MultiCanvasLessonDevice|MultiCanvasPanelState|MultiCanvasPanelRefs|MultiCanvasHudRefs|PanelDepthTarget|ComputeUniforms|MeshVertex|DrawCounters|RenderBundleLessonGeometry|ClusterCullingLessonGeometry|GPUColor)\b/g,
      '<span class="code-type">$&</span>'
    );
    text = text.replace(
      /\b(?:createWebGpuCanvas|requestAdapter|requestDevice|requiredFeatures|requiredLimits|getContext|getPreferredCanvasFormat|configure|createShaderModule|getCompilationInfo|createRenderPipeline|createComputePipeline|createCommandEncoder|createRenderBundleEncoder|createBuffer|createBindGroup|createBindGroupLayout|createPipelineLayout|createTexture|createSampler|createQuerySet|getBindGroupLayout|beginRenderPass|beginComputePass|pushDebugGroup|insertDebugMarker|popDebugGroup|setPipeline|setVertexBuffer|setIndexBuffer|setBindGroup|setViewport|setScissorRect|draw|drawIndexed|drawIndirect|drawIndexedIndirect|dispatchWorkgroups|dispatchWorkgroupsIndirect|writeBuffer|writeTexture|copyBufferToTexture|copyTextureToTexture|copyTextureToBuffer|clearBuffer|mapAsync|unmap|submit|executeBundles|getCurrentTexture|createView|copyExternalImageToTexture|importExternalTexture|createImageBitmap|destroy|finish|queue|querySelector|observe|disconnect|requestAnimationFrame|cancelAnimationFrame|transferControlToOffscreen|postMessage|terminate|fetch|blob|arrayBuffer|json|parseGlbFile|accessorNumComponents|componentTypeByteSize|readFloat32Accessor|readIndexAccessor|readJointAccessor|createGpuBuffer|readBufferViewBytes|createSamplerFromGlb|createSolidTexture|createTextureFromGlbImage|readNodeLocalMatrix|readNodeBaseTransform|flattenSceneDrawables|loadGlbScene|loadTexturedGlbScene|loadAnimatedGltfScene|loadPbrGlbScene|loadSkinnedGltfScene|createModelAsset|createModelSceneNode|createLookAtViewMatrix|createOrbitCameraPosition|createOrbitEyePosition|createPerspectiveMatrix|createReversedZPerspectiveMatrix|createOrthographicMatrix|createIdentityMatrix|createRotationXMatrix|createRotationYMatrix|createRotationZMatrix|createTranslationMatrix|createScaleMatrix|createQuaternionMatrix|composeNodeMatrix|invertMatrix|rotateVectorAroundAxis|normalizeVector|normalizeQuaternion|crossVectors|orthonormalizeBasis|lerpVector3|slerpQuaternion|createSceneNode|appendChild|updateWorldMatrix|drawSceneNode|findKeyframeInterval|sampleAnimationChannel|applyAnimationValue|updateAnimationState|updateAnimatedWorldMatrix|drawAnimatedNode|createSkinUniformData|createInstancedCubeGeometry|createInstanceGrid|createInstancingUniformData|createComputeFoundationsSeedData|createPrefixSumSeedData|createScanStepUniformData|createParticleSeedData|createGameOfLifeSeed|createBoidSeedData|createBitonicSortSeedData|createSimulationParamsData|createSortUniformData|advanceBitonicStage|createPostProcessCubeGeometry|createPingPongCubeGeometry|createBlendingBoxGeometry|createPointLightGeometry|createSpotLightGeometry|createStencilLessonGeometry|createDepthPrecisionSceneGeometry|createQueryLessonGeometry|createQueryWebGpuCanvas|createRenderBundleLessonGeometry|createHiDpiSizingLessonGeometry|chooseDemoPixelRatio|createHiDpiSceneConfigs|destroyRenderTarget|ensureSceneTarget|createMultiCanvasLessonGeometry|createTexture3dSliceLessonGeometry|createTexture3dSliceDensityTextureData|createTexture3dSliceSceneConfigs|createTexture3dSlicePanelRects|createContextSliceModelMatrix|createImplicitFieldLessonGeometry|createMetaballFieldData|evaluateMetaballFieldAtPoint|sampleMetaballFieldMetrics|createImplicitFieldSceneConfigs|createImplicitFieldPanelRects|createFieldUniformData|createMeshBuffers|createVolumeLessonGeometry|createVolumeDensityTextureData|createMarchingCubesLessonGeometry|createClusterCullingLessonGeometry|createClusteredShadingLessonGeometry|createABufferLessonGeometry|createOitMotivationLessonGeometry|createComputeUniformData|createClusterUniformData|createLightData|createHiDpiAndMultiCanvasSceneConfigs|createMultiCanvasLessonDevice|createGpuDrivenStreetScene|createGpuDrivenInstanceData|buildVisibleInstances|createGpuDrivenSceneGeometry|createGpuDrivenMeshBuffers|createOcclusionUniformData|createLodUniformData|writeLodUniforms|ensureHiZResources|createPanelRects|extractFrustumPlanes|sphereIntersectsFrustum|createSpriteUniformData|chooseLayoutMode|createPanelState|resizePanelCanvas|ensurePanelDepthTarget|createRenderBundleSceneConfigs|recordSceneCommands|rebuildRenderBundle|createDefaultSharedSettings|createWorkerMessagingSceneConfigs|createWorkerOffMainThreadSceneConfigs|createThreadRenderer|renderMessageLog|appendMessageLog|sendWorkerMessage|createSceneFrameData|createAnimatedModelMatrix|createAnimatedCamera|createSceneUniformData|createTransparentConfigs|sortTransparentIndices|createLegendCopy|updateHud|createSampleRows|drawStorageBufferView|drawPrefixSumChart|pickChartIndex|updateSlicePanels|createSlicePanelsMarkup|ensureABufferBuffers|scheduleStatsReadback|createBlurDirectionData|createFrameUniformData|createMaterialUniformData|createObjectUniformData|createNodeUniformData|createRuntimeNodes|nodeColor|createSceneObject|ensureRenderTargets|ensureDepthTarget|createTaaUniformData|createTaauUniformData|createRawUniformData|createPlainUniformData|createEdgeUniformData|createTemporalUniformData|createSsgiUniformData|createShadowUniformData|applyProjectionJitter|createSsrUniformData|createCocUniformData|createTraceUniformData|createAccumulateUniformData|createPresentUniformData|createCornellSceneStorageData|createCornellRasterObjects|generateWhiteNoisePoints|generateStratifiedJitterPoints|generateBlueNoiseLikePoints|generateUniformHemisphereSamples|generateHammersleyHemisphereSamples|sampleUniformHemisphere|sampleGgxReflection|ggxDistribution|resolveQuerySet|beginOcclusionQuery|endOcclusionQuery|renderFullscreenPass|copyBufferToBuffer|addEventListener|removeEventListener|preventDefault|setPointerCapture|releasePointerCapture|hasPointerCapture|setStencilReference|pack4x8unorm|unpack4x8unorm)\b/g,
      '<span class="code-api">$&</span>'
    );
    text = text.replace(
      /\b(?:label|pushErrorScope|popErrorScope|GPUValidationError|GPUUncapturedErrorEvent|GPUCompilationInfo|GPUCompilationMessage|minUniformBufferOffsetAlignment|hasDynamicOffset|createRenderPipelineAsync|createComputePipelineAsync|pipelineLayout|frameGraph|resourceLifetime|STORAGE_BINDING|TEXTURE_BINDING|RENDER_ATTACHMENT|COPY_SRC|COPY_DST|MAP_READ|MAP_WRITE|UNIFORM|STORAGE|onSubmittedWorkDone|framesInFlight|ringBuffer|resourcePool|transientResource|bytesPerRow|rowsPerImage|minBindingSize|GPUBindGroupLayoutEntry|GPUBufferBindingType|firstVertex|firstInstance|baseVertex|writeMask|GPUColorWrite|addressModeU|addressModeV|lodMinClamp|lodMaxClamp|maxAnisotropy|WGSL alignment|padding|array stride|arrayStride|shaderLocation|stepMode|loadOp|storeOp|shader-f16|f16|texture-compression-bc|requiredFeatures|visibility feedback|override|constants|depthBias|depthBiasSlopeScale|depthBiasClamp|primitive|topology|cullMode|frontFace|sampleCount|resolveTarget|multisampled|arrayLayerCount|baseArrayLayer|dimension: "cube"|depth24plus-stencil8|stencilFront|stencilBack|stencilReadMask|stencilWriteMask|alphaMode|GPUTextureAspect|GPUCommandBuffer|GPUQuerySet|colorSpace|presentation format|depth-only|stencil-only|timestamp-query|unorm8x4|snorm16x2|normalized attribute|bind group reuse|rebind|read_write|arrayLength|runtime-sized array|global_invocation_id|local_invocation_id|workgroup_id|maxComputeWorkgroupSizeX|baseMipLevel|mipLevelCount|viewDimension|sampleType|filterable|unfilterable-float|mappedAtCreation|buffer binding range|clearValue|shader module reuse|pipeline cache|pass boundary|submit boundary|implicit synchronization|layout: "auto"|wgslLanguageFeatures|readback ring|query availability|indirect dispatch|dispatch args)\b/g,
      '<span class="code-api">$&</span>'
    );
    text = text.replace(
      /\b(?:device\.lost|queue\.submit|queue\.onSubmittedWorkDone)\b|destroy\(\)/g,
      '<span class="code-api">$&</span>'
    );
  }

  if (language === "wgsl") {
    text = text.replace(
      /@[a-zA-Z_][a-zA-Z0-9_]*/g,
      '<span class="code-annotation">$&</span>'
    );
    text = text.replace(
      /\b(?:requires|struct|fn|let|var|override|return|if|else|for|loop|break|continue|switch|case|default|discard)\b/g,
      '<span class="code-keyword">$&</span>'
    );
    text = text.replace(
      /\b(?:vec2f|vec3f|vec4f|vec2u|vec3u|vec4u|vec2i|vec3i|vec4i|mat2x2f|mat3x3f|mat4x4f|texture_2d|texture_2d_array|texture_cube|texture_3d|texture_depth_2d|texture_storage_2d|texture_external|sampler|sampler_comparison|f16|f32|u32|i32|bool|array|ptr|atomic|storage|read|write|read_write|workgroup|private|function|global_invocation_id|local_invocation_id|local_invocation_index|workgroup_id|num_workgroups|Uniforms|ShadowUniforms|SceneUniforms|FieldUniforms|LightMarkerUniforms|SphereMesh|BlurParams|SimParams|Particle|FullscreenOutput|FullscreenInput|FrameUniforms|NodeUniforms|ObjectUniforms|MaterialUniforms|SkinUniforms|LightData|Light|ClusterUniforms|ClusterBounds|ComputeUniforms|ComputeCell|SpriteUniforms|BackdropVertexOutput|SpriteVertexOutput|VertexInput|MeshVertex|DrawCounters|StaticVertexInput|MeshVertexInput|ObjectVertexInput|MarkerOutput|MarkerInput|VertexOutput|FragmentInput|VelocityOutput|LayoutProbe|Params|Feedback|PipelineVariant|ShadowTarget|Targets|TaaUniforms|TaauUniforms|RawUniforms|BlurUniforms|EdgeUniforms|TemporalUniforms|SsgiUniforms|SsrUniforms|CocUniforms|PresentUniforms|TraceParams|AccumulateParams|HitInfo|BoxData|BvhNode|FlatBvhNode|Reservoir|position|vertexIndex|instanceIndex|globalId|localId|workgroupId|cellIndex|particleIndex|sampleIndex|nodeIndex|input|output|particles|params|counts|surface|metaballs|meshVertices|counters|clusterInfo|depthParams|positionRange|colorIntensity|clusterCounts|clusterLightIndices|viewDepth|lights|uniforms|cells|blurParams|cameraViewProjectionMatrix|previousViewProjectionMatrix|lightViewProjectionMatrix|lightOneViewProjectionMatrix|lightTwoViewProjectionMatrix|modelViewProjectionMatrix|viewProjectionMatrix|viewMatrix|modelMatrix|worldPosition|worldNormal|shadowPosition|shadowPositionOne|shadowPositionTwo|eyePosition|cameraPosition|materialParams|surfaceParams|fieldUniforms|gradient|safeGradient|volumeTexture|volumeSampler|volumeParams|animationParams|shadowTexture|shadowTextureOne|shadowTextureTwo|shadowSampler|shadowUv|shadowDepth|shadowClip|visibility|visibilityOne|visibilityTwo|uv|normal|joints|weights|jointMatrices|direction|lightOneDirection|lightTwoDirection|lightOneColor|lightTwoColor|markerColor|cone|coneParams|spotCos|spotFactor|instanceOffset|instanceColor|textureSampler|textureData|sampled|baseColor|baseColorFactor|baseColorTexture|baseColorSampler|metallic|roughness|metallicRoughnessTexture|normalTexture|velocityTexture|historyTexture|historySampler|historyNaiveTexture|historyAwareTexture|rejectionThreshold|disocclusionBias|renderScale|historyValid|lowColorTexture|lowVelocityTexture|cocTexture|cocSampler|cocUniforms|reprojectedUv|jitterOffset|focusDistance|aperture|maxBlurRadius|reflectionStrength|indirectStrength|thickness|rayLength|stepScale|lightDirection|viewDirection|reflectDirection|lambert|lambertOne|lambertTwo|ambient|diffuse|specular|shininess|specularStrength|color|colorAndSize|localUv|localPosition|centeredUv|radius|bands|lightingMode|sliceDepth|densityGain|stepSpacing|deltaTime|particleCount|bounds|sceneTextureSampler|sampledSceneTexture|sceneColor|luminance|grayscale|vignette|processed|clipPosition|blurSampler|blurSource|originalSceneTexture|blurredSceneTexture|original|blurred|lightVector|lightDistance|attenuation|halfVector|throughput|pdf|targetPdf|hemisphere|accumulation|denoise|stratified|lightPosition|lightPdf|brdfPdf|powerHeuristic|MIS|BVH|AABB|reprojection|historyClamp|RussianRoulette|ReSTIR|LIGHT_COUNT|MAX_JOINTS|MAX_RAY_STEPS)\b/g,
      '<span class="code-type">$&</span>'
    );
    text = text.replace(
      /\b(?:textureSample|textureSampleLevel|textureSampleCompare|textureSampleBaseClampToEdge|textureStore|workgroupBarrier|storageBarrier|normalize|dot|max|min|reflect|pow|smoothstep|length|mix|clamp|abs|fract|fwidth|dpdx|dpdy|exp|atomicAdd|atomicMax|atomicLoad|cross|transpose|inverse|select)\b/g,
      '<span class="code-api">$&</span>'
    );
  }

  text = text.replace(
    /\b\d+(?:\.\d+)?\b/g,
    '<span class="code-number">$&</span>'
  );

  tokens.forEach((token, index) => {
    text = text.replaceAll(token, placeholders[index]);
  });

  return text;
}

/**
 * 判断某一行源码是否值得整行强调。
 * @param {string} line 原始单行源码。
 * @param {string} language 当前源码语言。
 * @returns {string} 对应的整行样式类名；如果不需要强调，则返回空字符串。
 */
function emphasizedLineClass(line: string, language: string): string {
  const trimmed = line.trim();

  if (!trimmed) {
    return "";
  }

  const focusPatterns = [
    /createRenderPipeline\(/,
      /createComputePipeline\(/,
      /beginRenderPass\(/,
      /beginComputePass\(/,
    /baseMipLevel/,
    /mipLevelCount/,
    /baseArrayLayer/,
    /arrayLayerCount/,
    /viewDimension/,
    /sampleType/,
    /mappedAtCreation/,
    /resource:\s*\{\s*buffer/,
    /layout:\s*"auto"/,
    /createPipelineLayout\(/,
    /wgslLanguageFeatures/,
    /linear_indexing/,
    /global_invocation_index/,
    /workgroup_index/,
    /read_write/,
    /readback ring/i,
    /query availability/i,
    /offset:/,
    /size:/,
    /clearValue:/,
    /pipeline cache/i,
    /pass boundary/i,
    /submit boundary/i,
    /onSubmittedWorkDone\(/,
    /createComputeFoundationsSeedData\(/,
    /createPrefixSumSeedData\(/,
    /createScanStepUniformData\(/,
    /createGpuDrivenStreetScene\(/,
    /createGpuDrivenInstanceData\(/,
    /createGpuDrivenSceneGeometry\(/,
    /createGpuDrivenMeshBuffers\(/,
    /createOcclusionUniformData\(/,
    /createLodUniformData\(/,
    /writeLodUniforms\(/,
    /ensureHiZResources\(/,
    /createAnimatedCamera\(/,
    /createTaaUniformData\(/,
    /createTaauUniformData\(/,
    /createRawUniformData\(/,
    /createPlainUniformData\(/,
    /createEdgeUniformData\(/,
    /createTemporalUniformData\(/,
    /createSsgiUniformData\(/,
    /createShadowUniformData\(/,
    /applyProjectionJitter\(/,
    /createSsrUniformData\(/,
    /createCocUniformData\(/,
    /createTraceUniformData\(/,
    /createAccumulateUniformData\(/,
    /createPresentUniformData\(/,
    /createCornellSceneStorageData\(/,
    /createCornellRasterObjects\(/,
    /generateBlueNoiseLikePoints\(/,
    /generateUniformHemisphereSamples\(/,
    /sampleGgxReflection\(/,
    /extractFrustumPlanes\(/,
    /sphereIntersectsFrustum\(/,
    /drawPrefixSumChart\(/,
    /createSpriteUniformData\(/,
      /createGameOfLifeSeed\(/,
      /createBoidSeedData\(/,
    /createBitonicSortSeedData\(/,
    /createDepthPrecisionSceneGeometry\(/,
    /createDeferredSceneGeometry\(/,
    /createDeferredTransparentSceneGeometry\(/,
    /createSsaoLessonGeometry\(/,
    /createQueryLessonGeometry\(/,
    /createRenderBundleLessonGeometry\(/,
    /createWorkerMessagingLessonGeometry\(/,
    /createMultiCanvasLessonGeometry\(/,
    /createExtractUniformData\(/,
    /createEmitterUniformData\(/,
    /createSsaoUniformData\(/,
    /createSsaoBlurUniformData\(/,
    /createSsaoPresentUniformData\(/,
    /createTexture3dSliceLessonGeometry\(/,
    /createTexture3dSliceDensityTextureData\(/,
    /createTexture3dSlicePanelRects\(/,
    /createImplicitFieldLessonGeometry\(/,
    /createClusterCullingLessonGeometry\(/,
    /createMetaballFieldData\(/,
    /sampleMetaballFieldMetrics\(/,
    /createImplicitFieldPanelRects\(/,
    /createVolumeLessonGeometry\(/,
    /createVolumeDensityTextureData\(/,
    /createMarchingCubesLessonGeometry\(/,
    /createComputeUniformData\(/,
    /createPanelRects\(/,
    /createSampleRows\(/,
    /drawStorageBufferView\(/,
    /createClusteredShadingLessonGeometry\(/,
    /createABufferLessonGeometry\(/,
    /createOitMotivationLessonGeometry\(/,
    /createClusterUniformData\(/,
    /ensureABufferBuffers\(/,
    /createWorkerMessagingSceneConfigs\(/,
    /createWorkerOffMainThreadSceneConfigs\(/,
    /createThreadRenderer\(/,
    /parseGlbFile\(/,
      /loadGlbScene\(/,
    /loadTexturedGlbScene\(/,
    /loadAnimatedGltfScene\(/,
    /loadPbrGlbScene\(/,
    /loadSkinnedGltfScene\(/,
    /createEnvironmentCubemap\(/,
    /createPresentUniformData\(/,
    /createSkyboxViewMatrix\(/,
    /createModelSceneNode\(/,
    /sampleAnimationChannel\(/,
    /updateAnimationState\(/,
    /updateAnimatedWorldMatrix\(/,
    /drawAnimatedNode\(/,
    /createSkinUniformData\(/,
    /createMaterialUniformData\(/,
    /createFrameUniformData\(/,
    /createObjectUniformData\(/,
    /createSceneObject\(/,
    /flattenSceneDrawables\(/,
    /stepMode:\s*"instance"/,
    /pushDebugGroup\(/,
    /insertDebugMarker\(/,
    /popDebugGroup\(/,
    /unorm8x4/,
    /snorm16x2/,
    /\.setPipeline\(/,
    /\.setBindGroup\(/,
    /\.setVertexBuffer\(/,
    /\.setIndexBuffer\(/,
    /\.draw(?:Indexed)?\(/,
    /\.drawIndirect\(/,
    /\.drawIndexedIndirect\(/,
    /dispatchWorkgroups\(/,
    /\.submit\(/,
    /createSortUniformData\(/,
    /advanceBitonicStage\(/,
    /createQuerySet\(/,
    /createReversedZPerspectiveMatrix\(/,
    /setStencilReference\(/,
    /beginOcclusionQuery\(/,
    /copyExternalImageToTexture\(/,
    /importExternalTexture\(/,
    /copyBufferToTexture\(/,
    /bytesPerRow:/,
    /rowsPerImage:/,
    /minBindingSize:/,
    /arrayLength\(/,
    /read_write/,
    /global_invocation_id/,
    /local_invocation_id/,
    /workgroup_id/,
    /firstVertex/,
    /firstInstance/,
    /baseVertex/,
    /textureSampleBaseClampToEdge\(/,
    /texture-compression-bc/,
    /createRenderBundleEncoder\(/,
    /executeBundles\(/,
    /resolveQuerySet\(/,
    /timestampWrites:/,
    /occlusionQuerySet:/,
    /alphaMode:/,
    /aspect:\s*"depth-only"/,
    /aspect:\s*"stencil-only"/,
    /GPUCommandBuffer/,
    /GPUQuerySet/,
    /colorSpace:/,
    /presentation format/i,
    /textureLoad\(/,
    /textureSampleLevel\(/,
    /previousViewProjectionMatrix/,
    /historyBlend/,
    /historyValid/,
    /jitterEnabled/,
    /reprojectedUv/,
    /velocityClampPx/,
    /maxSteps/,
    /thickness/,
    /focusDistance/,
    /aperture/,
    /maxBlurRadius/,
    /focusDebug/,
    /throughput/,
    /sampleIndex/,
    /denoiseStrength/,
    /accumulationFrames/,
    /blue noise/i,
    /stratified/i,
    /GGX/,
    /BVH/,
    /AABB/,
    /nodeIndex/,
    /shadow ray/i,
    /light pdf/i,
    /MIS/,
    /power heuristic/i,
    /Russian roulette/i,
    /path depth/i,
    /history clamp/i,
    /reprojection/i,
    /Reservoir/,
    /targetPdf/,
    /temporal reuse/i,
    /spatial reuse/i,
    /ReSTIR/,
    /lightPositions\[/,
    /updateWorldMatrix\(/,
    /drawSceneNode\(/,
    /textureSampleCompare\(/,
    /blend:/,
    /writeMask:/,
    /addressModeU:/,
    /addressModeV:/,
    /lodMinClamp:/,
    /lodMaxClamp:/,
    /maxAnisotropy:/,
    /mipmapFilter:/,
    /lodMaxClamp:/,
    /alphaToCoverageEnabled:/,
    /format:\s*"rgba16float"/,
    /stencilFront:/,
    /stencilBack:/,
    /passOp:\s*"replace"/,
    /compare:\s*"not-equal"/,
    /format:\s*"depth24plus-stencil8"/,
    /resolveTarget:/,
    /depthCompare:\s*"greater"/,
    /sampleCount:/,
    /sortedTransparentObjects/,
    /copyTextureToBuffer\(/,
    /copyTextureToTexture\(/,
    /copyBufferToBuffer\(/,
    /mapAsync\(/,
    /getMappedRange\(/,
    /getCompilationInfo\(/,
    /setViewport\(/,
    /setScissorRect\(/,
    /clearBuffer\(/,
    /dispatchWorkgroupsIndirect\(/,
    /devicePixelRatio/,
    /dimension:\s*"3d"/,
    /viewDimension:\s*"3d"/,
    /createPanelState\(/,
    /resizePanelCanvas\(/,
    /transferControlToOffscreen\(/,
    /postMessage\(/,
    /atomicAdd\(/,
    /atomicMax\(/,
    /pack4x8unorm\(/,
    /unpack4x8unorm\(/,
  ];

  if (focusPatterns.some((pattern) => pattern.test(trimmed))) {
    return "code-line-row--focus";
  }

  const importantPatterns =
    language === "wgsl"
      ? [
          /@(vertex|fragment|compute|workgroup_size|group|binding|location|builtin)\b/,
          /var<uniform>/,
          /var<storage/,
          /read_write/,
          /global_invocation_id|local_invocation_id|workgroup_id/,
          /textureSample\(/,
          /textureSampleLevel\(/,
          /output\.clipPosition/,
        ]
        : [
            /createBindGroup\(/,
            /createBuffer\(/,
            /createTexture\(/,
            /copyExternalImageToTexture\(/,
            /importExternalTexture\(/,
            /createImageBitmap\(/,
            /read(Float32|Index)Accessor\(/,
            /createSolidTexture\(/,
            /createLookAtViewMatrix\(/,
            /multiplyMatrices\(/,
            /composeNodeMatrix\(/,
            /invertMatrix\(/,
            /slerpQuaternion\(/,
            /lerpVector3\(/,
            /createPointLightGeometry\(/,
            /createSpotLightGeometry\(/,
            /createStencilLessonGeometry\(/,
            /createDeferredSceneGeometry\(/,
            /createDeferredTransparentSceneGeometry\(/,
            /createSsaoLessonGeometry\(/,
            /createQueryLessonGeometry\(/,
             /createRenderBundleLessonGeometry\(/,
             /createWorkerMessagingLessonGeometry\(/,
            /createHiDpiSizingLessonGeometry\(/,
            /chooseDemoPixelRatio\(/,
            /ensureSceneTarget\(/,
            /createPresentUniformData\(/,
            /createExtractUniformData\(/,
            /createEmitterUniformData\(/,
            /createSsaoUniformData\(/,
            /createSsaoBlurUniformData\(/,
            /createSsaoPresentUniformData\(/,
            /createSkyboxViewMatrix\(/,
            /createMultiCanvasLessonGeometry\(/,
            /createTexture3dSliceLessonGeometry\(/,
            /createTexture3dSliceDensityTextureData\(/,
            /createTexture3dSliceSceneConfigs\(/,
            /createTexture3dSlicePanelRects\(/,
            /createContextSliceModelMatrix\(/,
            /createImplicitFieldLessonGeometry\(/,
            /createClusterCullingLessonGeometry\(/,
            /createMetaballFieldData\(/,
            /sampleMetaballFieldMetrics\(/,
            /createImplicitFieldSceneConfigs\(/,
            /createImplicitFieldPanelRects\(/,
            /createFieldUniformData\(/,
            /createVolumeLessonGeometry\(/,
            /createVolumeDensityTextureData\(/,
            /createMarchingCubesLessonGeometry\(/,
            /createComputeUniformData\(/,
            /createPrefixSumSeedData\(/,
            /createScanStepUniformData\(/,
            /drawPrefixSumChart\(/,
            /createAnimatedCamera\(/,
            /createTaaUniformData\(/,
            /createTaauUniformData\(/,
            /createRawUniformData\(/,
            /createPlainUniformData\(/,
            /createEdgeUniformData\(/,
            /createTemporalUniformData\(/,
            /createSsgiUniformData\(/,
            /createShadowUniformData\(/,
            /applyProjectionJitter\(/,
            /createSsrUniformData\(/,
            /createCocUniformData\(/,
            /createTraceUniformData\(/,
            /createAccumulateUniformData\(/,
            /createPresentUniformData\(/,
            /createCornellSceneStorageData\(/,
            /createCornellRasterObjects\(/,
            /generateBlueNoiseLikePoints\(/,
            /generateUniformHemisphereSamples\(/,
            /sampleGgxReflection\(/,
             /createClusteredShadingLessonGeometry\(/,
             /createOitMotivationLessonGeometry\(/,
             /createClusterUniformData\(/,
             /createWorkerMessagingSceneConfigs\(/,
             /createWorkerOffMainThreadSceneConfigs\(/,
             /createThreadRenderer\(/,
            /createBlendingBoxGeometry\(/,
            /createSamplerDemoGeometry\(/,
            /createMsaaSceneGeometry\(/,
            /createCubemapLessonGeometry\(/,
            /createPickingSceneGeometry\(/,
            /createSceneNode\(/,
            /createModelSceneNode\(/,
            /createRuntimeNodes\(/,
            /readJointAccessor\(/,
            /appendChild\(/,
            /writeTexture\(/,
            /copyTextureToTexture\(/,
            /copyTextureToBuffer\(/,
            /getCompilationInfo\(/,
            /setViewport\(/,
            /setScissorRect\(/,
            /clearBuffer\(/,
            /dispatchWorkgroupsIndirect\(/,
            /drawScenePass\(/,
            /devicePixelRatio/,
            /dimension:\s*"3d"/,
            /viewDimension:\s*"3d"/,
            /OffscreenCanvas/,
            /transferControlToOffscreen\(/,
            /postMessage\(/,
            /terminate\(/,
            /addressMode[UV]:/,
            /GPUBufferUsage\.STORAGE/,
            /GPUBufferUsage\.INDIRECT/,
            /GPUBufferUsage\.QUERY_RESOLVE/,
            /GPUTextureUsage\.TEXTURE_BINDING/,
            /baseMipLevel/,
            /mipLevelCount/,
            /baseArrayLayer/,
            /arrayLayerCount/,
            /viewDimension/,
            /sampleType/,
            /mappedAtCreation/,
            /resource:\s*\{\s*buffer/,
            /layout:\s*"auto"/,
            /createPipelineLayout\(/,
            /wgslLanguageFeatures/,
            /readback ring/i,
            /query availability/i,
            /clearValue:/,
            /pipeline cache/i,
            /pass boundary/i,
            /submit boundary/i,
            /implicit synchronization/i,
            /onSubmittedWorkDone\(/,
            /textureSampleCompare\(/,
            /texture-compression-bc/,
            /previousViewProjectionMatrix/,
            /historyBlend/,
            /historyValid/,
            /jitterEnabled/,
            /reprojectedUv/,
            /velocityClampPx/,
            /maxSteps/,
            /thickness/,
            /focusDistance/,
            /aperture/,
            /maxBlurRadius/,
            /focusDebug/,
            /throughput/,
            /sampleIndex/,
            /denoiseStrength/,
            /accumulationFrames/,
            /blue noise/i,
            /stratified/i,
            /GGX/,
            /BVH/,
            /AABB/,
            /nodeIndex/,
            /shadow ray/i,
            /light pdf/i,
            /MIS/,
            /power heuristic/i,
            /Russian roulette/i,
            /path depth/i,
            /history clamp/i,
            /reprojection/i,
            /Reservoir/,
            /targetPdf/,
            /temporal reuse/i,
            /spatial reuse/i,
            /ReSTIR/,
        ];

  if (importantPatterns.some((pattern) => pattern.test(trimmed))) {
    return "code-line-row--important";
  }

  return "";
}

/**
 * 把一段源码渲染成带高亮的代码块。
 * @param {string} content 原始源码内容。
 * @param {string} language 当前源码语言。
 * @param {string} [extraClassName] 额外样式类名。
 * @returns {string} 对应的源码块 HTML。
 */
function renderCodeSegment(
  content: string,
  language: string,
  startLine = 1,
  lineDigits = 3,
  extraClassName = ""
): string {
  const className = extraClassName
    ? `code-segment ${extraClassName}`
    : "code-segment";
  const rows = content.split("\n").map((line, index) => {
    const lineNumber = startLine + index;
    const lineClass = emphasizedLineClass(line, language);
    const rowClass = lineClass
      ? `code-line-row ${lineClass}`
      : "code-line-row";
    const lineContent = line.length > 0 ? highlightCodeLine(line, language) : "&nbsp;";

    return `
      <div class="${rowClass}">
        <span class="code-line-row__gutter" aria-hidden="true">${lineNumber}</span>
        <span class="code-line-row__content"><code>${lineContent}</code></span>
      </div>
    `;
  });

  return `
    <div class="${className}" style="--code-line-digits: ${lineDigits};">
      ${rows.join("")}
    </div>
  `;
}

/**
 * 把源码对象渲染成“展开代码 + 折叠代码”的面板内容。
 * @param {LessonSource} source 当前激活的源码对象。
 * @returns {string} 可直接插入源码面板的 HTML。
 */
function renderSourceContent(source: LessonSource): string {
  const lineDigits = String(source.content.split("\n").length).length;

  if (!source.displaySegments || source.displaySegments.length === 0) {
    return renderCodeSegment(source.content, source.language, 1, lineDigits);
  }

  return source.displaySegments
    .map((segment) => {
      if (segment.type === "fold") {
        return `
          <section
            class="code-fold"
            data-code-fold
            style="--code-line-digits: ${lineDigits};"
          >
            <div class="code-fold__row">
              <div class="code-fold__gutter" aria-hidden="true"></div>
              <button
                class="code-fold__toggle"
                type="button"
                aria-expanded="false"
                aria-label="展开第 ${segment.startLine}-${segment.endLine} 行"
                title="展开第 ${segment.startLine}-${segment.endLine} 行"
              >
                <span class="code-fold__icon" aria-hidden="true">▸</span>
                <span class="code-fold__line" aria-hidden="true"></span>
              </button>
            </div>
            <div class="code-fold__body" hidden>
              ${renderCodeSegment(
                segment.content,
                source.language,
                segment.startLine,
                lineDigits,
                "code-segment--folded"
              )}
            </div>
          </section>
        `;
      }

      return renderCodeSegment(
        segment.content,
        source.language,
        segment.startLine,
        lineDigits
      );
    })
    .join("");
}

/**
 * 根据 hash 取得当前要显示的 lesson；如果没有 hash，就回到默认 lesson。
 * @param {string | null} id 地址栏中的 lesson 标识。
 * @returns {LessonDefinition} 当前应该展示的 lesson 定义。
 */
function getLessonById(id: string | null): LessonDefinition {
  const defaultLesson = lessons.find((lesson) => lesson.id === "01-triangle");

  if (!id) {
    return defaultLesson ?? lessons[0];
  }

  return (
    courseItems.find((lesson) => lesson.id === id) ??
    defaultLesson ??
    lessons[0]
  );
}

/**
 * 根据状态语气返回对应的状态样式类名。
 * @param {PreviewTone} tone 状态语气。
 * @returns {string} 状态样式类名。
 */
function statusClassName(tone: PreviewTone): string {
  return `status-pill status-pill--${tone}`;
}

/**
 * 把 lesson 状态转换为更短的中文标签。
 * @param {LessonDefinition["status"]} status lesson 状态。
 * @returns {string} 界面展示用状态文案。
 */
function lessonStatusLabel(status: LessonDefinition["status"]): string {
  return status === "ready" ? "已就绪" : "计划中";
}

/**
 * 启动整个课程工作台 UI，并负责 lesson 切换、源码面板与预览挂载。
 * @param {HTMLElement} root 应用根节点。
 * @returns {void} 负责初始化工作台界面与事件绑定，不返回额外结果。
 */
export function bootApp(root: HTMLElement) {
  root.innerHTML = `
    <div class="studio-shell">
      <aside class="studio-sidebar">
        <div class="brand-block">
          <p class="eyebrow">WebGPU Study 2026</p>
          <h1>课程工作台</h1>
          <p class="brand-copy">
            从零重学 WebGPU。左侧按章节推进，中间看效果，右侧直接读真实源码。
          </p>
        </div>
        <nav>
          <ol class="lesson-list" id="lesson-list"></ol>
        </nav>
      </aside>

      <main class="studio-main">
        <section class="preview-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">预览</p>
              <h2 id="lesson-title"></h2>
            </div>
            <div id="preview-status"></div>
          </div>
          <p class="lesson-summary" id="lesson-summary"></p>
          <div class="preview-stage" id="preview-stage"></div>
          <section class="lesson-guide" id="lesson-guide" aria-label="本课知识点">
            <p class="lesson-guide__title">本课知识点</p>
            <p class="goal-copy" id="lesson-goal"></p>
            <ul class="note-list" id="lesson-notes"></ul>
          </section>
        </section>
      </main>

      <aside class="studio-inspector">
        <section class="inspector-section inspector-section--code">
          <div class="section-heading section-heading--stacked">
            <p class="eyebrow">核心源码</p>
          </div>
          <div class="source-tabs" id="source-tabs"></div>
          <div class="code-frame">
            <div class="code-frame__meta" id="code-meta"></div>
            <div class="code-block" id="code-block"></div>
          </div>
        </section>
      </aside>
    </div>
  `;

  const lessonList = root.querySelector<HTMLOListElement>("#lesson-list")!;
  const lessonTitle = root.querySelector<HTMLElement>("#lesson-title")!;
  const lessonSummary = root.querySelector<HTMLElement>("#lesson-summary")!;
  const lessonGuide = root.querySelector<HTMLElement>("#lesson-guide")!;
  const lessonGoal = root.querySelector<HTMLElement>("#lesson-goal")!;
  const lessonNotes = root.querySelector<HTMLElement>("#lesson-notes")!;
  const previewStage = root.querySelector<HTMLElement>("#preview-stage")!;
  const previewHeading = root.querySelector<HTMLElement>(
    ".preview-panel > .section-heading"
  )!;
  const previewStatus = root.querySelector<HTMLElement>("#preview-status")!;
  const sourceTabs = root.querySelector<HTMLElement>("#source-tabs")!;
  const codeMeta = root.querySelector<HTMLElement>("#code-meta")!;
  const codeBlock = root.querySelector<HTMLElement>("#code-block")!;
  const sidebarNav = lessonList.closest("nav");

  let cleanup: (() => void) | null = null;
  let activeSourceId = "";
  let mountVersion = 0;
  let currentStatus = defaultStatus;
  let pendingLessonScrollFrame = 0;

  const renderStatus = () => {
    const shouldShowStatus = currentStatus.tone === "warn";

    previewHeading.classList.toggle(
      "section-heading--status-visible",
      shouldShowStatus
    );

    if (!shouldShowStatus) {
      previewStatus.hidden = true;
      previewStatus.innerHTML = "";
      return;
    }

    previewStatus.hidden = false;
    previewStatus.innerHTML = `
      <div class="${statusClassName(currentStatus.tone)}">
        <strong>${currentStatus.title}</strong>
        <span>${currentStatus.detail}</span>
      </div>
    `;
  };

  const setStatus = (status: PreviewStatus) => {
    currentStatus = status;
    renderStatus();
  };

  const renderSources = (lesson: LessonDefinition) => {
    const sources = lesson.sources;

    if (sources.length === 0) {
      sourceTabs.innerHTML = "";
      codeMeta.textContent = "这一课暂时还没有挂载源码。";
      codeBlock.innerHTML = renderCodeSegment(
        "// 这一课真正开始实现后，源码会显示在这里。",
        "ts",
        1
      );
      codeBlock.scrollTop = 0;
      codeBlock.scrollLeft = 0;
      return;
    }

    const activeSource =
      sources.find((source) => source.id === activeSourceId) ??
      sources.find((source) => source.featured) ??
      sources[0];

    activeSourceId = activeSource.id;

    // 源码标签页始终展示通过 ?raw 导入的真实 lesson 文件，
    // 这样右侧代码面板才会和当前运行的内容保持一致。
    sourceTabs.innerHTML = sources
      .map(
        (source) => `
          <button
            class="source-tab ${
              source.id === activeSource.id ? "source-tab--active" : ""
            }"
            data-source-id="${source.id}"
            type="button"
          >
            ${source.filename}
          </button>
        `
      )
      .join("");

    sourceTabs.querySelectorAll<HTMLButtonElement>("[data-source-id]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          activeSourceId = button.dataset.sourceId || "";
          renderSources(lesson);
        });
      }
    );

    codeMeta.textContent = `${activeSource.filename} · ${languageLabel(
      activeSource.language
    )}${activeSource.displaySegments ? " · 核心片段" : ""}`;
    codeBlock.innerHTML = renderSourceContent(activeSource);
    codeBlock.querySelectorAll<HTMLElement>("[data-code-fold]").forEach((fold) => {
      const toggle = fold.querySelector<HTMLButtonElement>(".code-fold__toggle");
      const body = fold.querySelector<HTMLElement>(".code-fold__body");
      const icon = fold.querySelector<HTMLElement>(".code-fold__icon");
      if (!toggle || !body || !icon) {
        return;
      }

      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
        body.hidden = expanded;
        icon.textContent = expanded ? "▸" : "▾";
        toggle.setAttribute(
          "aria-label",
          expanded ? "展开这段辅助代码" : "收起这段辅助代码"
        );
        toggle.title = expanded
          ? "展开这段辅助代码"
          : "收起这段辅助代码";
      });
    });
    codeBlock.scrollTop = 0;
    codeBlock.scrollLeft = 0;
  };

  const renderLessonList = (activeLessonId: string) => {
    const sections = [
      {
        label: "课程主线",
        items: [...lessons].sort((left, right) => left.order - right.order),
      },
      {
        label: "Chrome WebGPU 更新",
        items: courseItems
          .filter((lesson) => lesson.section === "updates")
          .sort((left, right) => left.order - right.order),
      },
    ].filter((section) => section.items.length > 0);

    lessonList.innerHTML = sections
      .map(
        (section) => `
          <li class="lesson-list__section" aria-hidden="true">${section.label}</li>
          ${section.items
            .map(
              (lesson) => `
          <li>
            <button
              class="lesson-link ${
                lesson.id === activeLessonId ? "lesson-link--active" : ""
              } ${lesson.section === "updates" ? "lesson-link--update" : ""}"
              data-lesson-id="${lesson.id}"
              aria-current="${lesson.id === activeLessonId ? "true" : "false"}"
              type="button"
            >
              <span class="lesson-link__order">${
                lesson.displayOrder ?? lesson.order.toString().padStart(2, "0")
              }</span>
              <span class="lesson-link__body">
                <strong>${lesson.title}</strong>
                <span>${lesson.tagline}</span>
              </span>
              <span class="lesson-link__status lesson-link__status--${
                lesson.status
              }">${lessonStatusLabel(lesson.status)}</span>
            </button>
          </li>
        `
            )
            .join("")}
        `
      )
      .join("");

    lessonList.querySelectorAll<HTMLButtonElement>("[data-lesson-id]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          const lessonId = button.dataset.lessonId;
          if (lessonId) {
            location.hash = lessonId;
          }
        });
      }
    );

    if (pendingLessonScrollFrame !== 0) {
      window.cancelAnimationFrame(pendingLessonScrollFrame);
    }

    pendingLessonScrollFrame = window.requestAnimationFrame(() => {
      if (!sidebarNav) {
        pendingLessonScrollFrame = 0;
        return;
      }

      const activeButton = lessonList.querySelector<HTMLButtonElement>(
        `[data-lesson-id="${activeLessonId}"]`
      );

      if (!activeButton) {
        pendingLessonScrollFrame = 0;
        return;
      }

      const navRect = sidebarNav.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const padding = 18;
      const isAboveViewport = buttonRect.top < navRect.top + padding;
      const isBelowViewport = buttonRect.bottom > navRect.bottom - padding;

      if (isAboveViewport || isBelowViewport) {
        activeButton.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto",
        });
      }

      pendingLessonScrollFrame = 0;
    });
  };

  const mountLesson = async (lesson: LessonDefinition) => {
    mountVersion += 1;
    const version = mountVersion;

    // 在挂载下一个 lesson 之前先清理上一个，
    // 避免 resize 监听和 WebGPU 资源在切换过程中残留。
    cleanup?.();
    cleanup = null;

    previewStage.innerHTML = "";

    if (!lesson.mount) {
      const isPlannedLesson = lesson.status === "planned";
      setStatus(
        isPlannedLesson
          ? {
              title: "课程规划中",
              detail: "这一课还没开始实现，当前先展示学习目标和知识清单。",
              tone: "info",
            }
          : {
              title: "预览暂未接入",
              detail: "这一课的源码和预览入口之后会继续补上。",
              tone: "info",
            }
      );
      previewStage.innerHTML = `
        <div class="preview-empty">
          <h3>${lesson.title}</h3>
          <p>${lesson.summary}</p>
        </div>
      `;
      return;
    }

    const host = document.createElement("div");
    host.className = "preview-host";
    previewStage.appendChild(host);

    setStatus(defaultStatus);

    try {
      const result = await lesson.mount(host, setStatus);

      // 如果用户在当前 lesson 还没挂载完时就切走了，
      // 这里要忽略这次过期的异步结果。
      if (version !== mountVersion) {
        if (typeof result === "function") {
          result();
        }
        return;
      }

      cleanup = typeof result === "function" ? result : null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知的 lesson 挂载错误。";

      previewStage.innerHTML = `
        <div class="preview-empty">
          <h3>lesson 挂载失败</h3>
          <p>${message}</p>
        </div>
      `;

      setStatus({
        title: "挂载失败",
        detail: message,
        tone: "warn",
      });
    }
  };

  const renderLesson = async () => {
    const lesson = getLessonById(location.hash.replace("#", "") || null);

    renderLessonList(lesson.id);

    lessonTitle.textContent = lesson.title;
    lessonSummary.innerHTML = renderInlineCode(lesson.summary);
    lessonGuide.hidden = !lesson.goal && lesson.notes.length === 0;
    lessonGoal.innerHTML = renderInlineCode(lesson.goal);
    lessonNotes.innerHTML = lesson.notes.map(renderKnowledgeNote).join("");

    renderSources(lesson);
    await mountLesson(lesson);
  };

  renderStatus();
  void renderLesson();

  window.addEventListener("hashchange", () => {
    void renderLesson();
  });
}
