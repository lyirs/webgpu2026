# WebGPU Study 2026

一个  WebGPU 学习集

## 技术栈

- Vite 8
- TypeScript 6
- Raw WebGPU

## 常用命令

```bash
pnpm install
pnpm dev
pnpm build
```

### 01-39：WebGPU API 与管线基础

| # | 课程 | 路由 id | 核心知识点 |
|---:|---|---|---|
| 01 | 你好，三角形 | `01-triangle` | render pipeline / clip-space 顶点 / vertex-fragment shader |
| 02 | Adapter、Device、Features 与 Limits | `02-adapter-device-features-and-limits` | `requestAdapter` / `requestDevice` / features / limits / required limits |
| 03 | Canvas Context、configure 与 Alpha Mode | `03-canvas-context-configure-and-alpha-mode` | `getContext("webgpu")` / preferred canvas format / `context.configure` / `alphaMode` |
| 04 | Error Scope、Validation 与 Device Lost | `04-error-scopes-validation-and-device-lost` | `pushErrorScope` / `popErrorScope` / validation error / `uncapturederror` / `device.lost` |
| 05 | Labels、Debug Groups 与错误诊断 | `05-labels-debug-groups-and-error-diagnostics` | resource `label` / debug group / debug marker / 带标签错误定位 |
| 06 | Shader Compilation Info 与 WGSL Diagnostics | `06-shader-compilation-info-and-wgsl-diagnostics` | `getCompilationInfo` / `GPUCompilationMessage` / WGSL 行列诊断 |
| 07 | 顶点缓冲 | `07-vertex-buffers` | vertex buffer / attribute location / `GPUBufferUsage.VERTEX` |
| 08 | Buffer Usage、Mapping 与 Copy | `08-buffer-usage-mapping-and-copy` | buffer usage flags / `mapAsync` staging / GPU copy / readback |
| 09 | Index Buffer、drawIndexed 与 Index Format | `09-index-buffer-drawindexed-and-index-format` | index buffer / `setIndexBuffer` / `drawIndexed` / `uint16` 与 `uint32` |
| 10 | Vertex Buffer Layout、Attributes 与 Step Mode | `10-vertex-buffer-layout-attributes-and-step-mode` | `GPUVertexBufferLayout` / `arrayStride` / attribute format / `stepMode: "instance"` |
| 11 | Packed Vertex Format、Normalized Attribute 与 Stride | `11-packed-vertex-formats-normalized-attributes-and-stride` | `unorm8x4` / `snorm16x2` / packed attributes / stride 与 offset |
| 12 | Uniform 与时间 | `12-uniforms` | uniform buffer / `queue.writeBuffer` / 时间参数上传 / WGSL uniform 读取 |
| 13 | 立方体与深度 | `13-cube-depth` | MVP 矩阵 / depth texture / depth test / 3D 几何绘制 |
| 14 | 纹理与采样器 | `14-textures` | texture creation / texture view / sampler / WGSL texture sampling |
| 15 | Texture Format、View 与 Copy | `15-texture-formats-views-and-copy` | texture format / texture usage / texture view / copy path |
| 16 | External Image、Video Texture 与 Copy | `16-external-image-video-texture-and-copy` | `copyExternalImageToTexture` / `ImageBitmap` / external texture fallback |
| 17 | Texture Copy Layout、bytesPerRow 与 rowsPerImage | `17-texture-copy-layout-bytes-per-row-and-rows-per-image` | `copyBufferToTexture` / `bytesPerRow` 256 对齐 / `rowsPerImage` |
| 18 | Texture Copy、Texture Readback 与截图路径 | `18-texture-to-texture-buffer-copy-and-readback` | `copyTextureToTexture` / `copyTextureToBuffer` / padded readback / checksum |
| 19 | Texture View Aspect 与 Depth/Stencil View | `19-texture-view-aspect-and-depth-stencil-views` | `GPUTextureAspect` / depth-only view / stencil-only view / depth-stencil texture |
| 20 | Texture View Mip Level 与 Array Layer Range | `20-texture-view-mip-level-array-layer-range` | `baseMipLevel` / `mipLevelCount` / `baseArrayLayer` / `arrayLayerCount` |
| 21 | Texture View Dimension 与 Sample Type 兼容性 | `21-texture-view-dimension-and-sample-type-compatibility` | `viewDimension` / `sampleType` / filterable / unfilterable texture compatibility |
| 22 | 贴图立方体 | `22-textured-cube` | cube texture sampling / MVP / sampler binding / textured 3D object |
| 23 | Bind Group Layout 与 Pipeline Layout | `23-bind-group-layouts-and-pipeline-layouts` | explicit bind group layout / pipeline layout / WGSL binding 对齐 |
| 24 | Bind Group Entry Types、minBindingSize 与兼容性 | `24-bind-group-entry-types-minbindingsize-and-compatibility` | `GPUBindGroupLayoutEntry` / `minBindingSize` / resource type compatibility |
| 25 | Bind Group 复用、资源生命周期与 Rebinding | `25-bind-group-reuse-resource-lifetime-and-rebinding` | bind group immutable binding / buffer 内容更新 / texture view rebind |
| 26 | Buffer Binding Offset、Size 与 Range | `26-buffer-binding-offset-size-and-range` | buffer binding `offset` / `size` / binding range / alignment 限制 |
| 27 | Buffer Map 生命周期与 Staging Patterns | `27-buffer-map-lifecycle-and-staging-patterns` | `mappedAtCreation` / `mapAsync` / `unmap` / MAP_WRITE staging / MAP_READ readback |
| 28 | Command Encoder、Pass 与 Queue Submit | `28-command-encoders-passes-and-queue-submit` | command encoder / compute pass / render pass / `queue.submit` |
| 29 | Command Buffer 生命周期与一次性提交 | `29-command-buffer-lifecycle-and-one-shot-submit` | `finish()` / `GPUCommandBuffer` one-shot submit / 复用失败捕获 |
| 30 | Render Pass LoadOp、StoreOp 与 Attachment Lifecycle | `30-render-pass-load-store-ops-and-attachment-lifecycle` | `loadOp` / `storeOp` / render attachment 生命周期 / transient target |
| 31 | Render Pass Clear/Load 调试与 Attachment 状态 | `31-render-pass-clear-load-debugging-and-attachment-state` | `clearValue` 调试色 / `loadOp: "load"` / 多 pass attachment 状态 |
| 32 | Viewport、Scissor 与 Render Pass 动态状态 | `32-viewport-scissor-and-render-pass-dynamic-state` | `setViewport` / `setScissorRect` / pass 内动态状态 |
| 33 | Dynamic Offsets 与 Buffer 对齐 | `33-dynamic-offsets-and-buffer-alignment` | `hasDynamicOffset` / dynamic offset / `minUniformBufferOffsetAlignment` |
| 34 | Async Pipeline 与 Pipeline Layout 复用 | `34-async-pipelines-and-pipeline-layout-reuse` | `createRenderPipelineAsync` / `createComputePipelineAsync` / shared pipeline layout |
| 35 | Shader Module 复用与 Pipeline Cache 思维 | `35-shader-module-reuse-and-pipeline-cache-mindset` | shader module reuse / pipeline layout reuse / pipeline cache mindset |
| 36 | Pipeline Layout: Auto vs Explicit 兼容性 | `36-pipeline-layout-auto-vs-explicit-compatibility` | `layout: "auto"` / `getBindGroupLayout` / explicit pipeline layout compatibility |
| 37 | WGSL Memory Layout、Padding 与 Struct 对齐 | `37-wgsl-memory-layout-padding-and-struct-alignment` | WGSL alignment / padding / struct packing / array stride |
| 38 | shader-f16、Optional Features 与 Precision Tradeoff | `38-shader-f16-optional-features-and-precision-tradeoff` | `shader-f16` feature gate / f16 shader / f32 fallback / precision tradeoff |
| 39 | Shader Override Constants 与 Pipeline Specialization | `39-shader-override-constants-and-pipeline-specialization` | WGSL `override` / pipeline constants / pipeline specialization |

### 40-84：光照、阴影、纹理、glTF 与材质

| # | 课程 | 路由 id | 核心知识点 |
|---:|---|---|---|
| 40 | 方向光与法线 | `40-lighting` | normal transform / Lambert lighting / diffuse shading |
| 41 | 环境光与点光源 | `41-point-lights` | ambient light / point light attenuation / multi-light uniform |
| 42 | 聚光灯 | `42-spot-light` | spotlight cone / smooth falloff / light-space parameters |
| 43 | 受限轨道相机 | `43-camera-controls` | orbit camera / view matrix / projection matrix / mouse interaction |
| 44 | 自由轨道相机 | `44-free-orbit-camera` | free orbit camera / camera target / uniform update |
| 45 | 高光与材质 | `45-specular-materials` | specular highlight / Blinn-Phong / material parameters |
| 46 | Comparison Sampler 与 Depth Texture Sampling | `46-comparison-samplers-and-depth-texture-sampling` | `sampler_comparison` / `textureSampleCompare` / depth sampling / PCF 前置 |
| 47 | Depth Bias、Slope Scale 与 Shadow Acne | `47-depth-bias-slope-scale-and-shadow-acne` | `depthBias` / `depthBiasSlopeScale` / shadow acne / peter-panning |
| 48 | 阴影基础 | `48-shadow-mapping` | shadow map pass / light view projection / comparison sampler / PCF |
| 49 | 单光源下的多物体阴影 | `49-multi-object-shadows` | shadow map 多物体渲染 / depth pass / scene pass |
| 50 | 多光源阴影 | `50-multi-light-shadows` | multiple shadow maps / multi-light shadow sampling |
| 51 | 多物体与场景树 | `51-scene-graph` | scene graph / transform hierarchy / matrix composition |
| 52 | 实例化与批量绘制 | `52-instancing` | instance buffer / per-instance attributes / batch draw |
| 53 | Primitive Topology、Cull Mode 与 Front Face | `53-primitive-topology-cull-mode-and-front-face` | primitive topology / `frontFace` / `cullMode` / winding 可视化 |
| 54 | Draw 参数、Base Vertex、First Instance 与 Indirect Buffer | `54-draw-parameters-base-vertex-first-instance-and-indirect-buffer` | `firstVertex` / `firstInstance` / `baseVertex` / draw indirect args |
| 55 | Compute 基础与 Storage Buffer | `55-compute-foundations` | compute pipeline / storage buffer / `dispatchWorkgroups` |
| 56 | Storage Buffer 读写与 Runtime-sized Array | `56-storage-buffer-read-write-and-runtime-sized-arrays` | `var<storage, read_write>` / runtime-sized array / `arrayLength` |
| 57 | clearBuffer、Counter Reset 与 Append Patterns | `57-clear-buffer-counter-reset-and-append-patterns` | `clearBuffer` / append counter / counter reset / readback validation |
| 58 | dispatchWorkgroups、Invocation IDs 与 Compute Limits | `58-dispatch-workgroups-invocation-ids-and-compute-limits` | `global_invocation_id` / `local_invocation_id` / workgroup grid / compute limits |
| 59 | dispatchWorkgroupsIndirect 与 GPU 写入 Dispatch Args | `59-dispatch-workgroups-indirect-and-gpu-written-dispatch-args` | GPU-written dispatch args / `dispatchWorkgroupsIndirect` |
| 60 | Compute-to-Render 同步边界 | `60-compute-to-render-synchronization-boundaries` | compute pass writes / render pass reads / implicit pass boundary synchronization |
| 61 | Storage Texture 与 Compute 写纹理 | `61-storage-textures-and-compute-writeback` | `GPUTextureUsage.STORAGE_BINDING` / `texture_storage_2d` / `textureStore` |
| 62 | Storage Texture Format、Access Mode 与 Read/Write | `62-storage-texture-formats-access-modes-and-readwrite` | storage texture format / access mode / read-write feature gate |
| 63 | Workgroup Memory 与 Barrier | `63-workgroup-memory-and-barriers` | `var<workgroup>` / tiled memory / `workgroupBarrier` |
| 64 | Atomics 与 Parallel Reduction | `64-atomics-and-parallel-reduction` | `atomicAdd` / `atomicMax` / histogram / parallel reduction |
| 65 | Compute 粒子与 Render Interop | `65-compute-particles` | compute simulation / storage buffer interop / render pass particle draw |
| 66 | 后处理与全屏 Pass | `66-post-processing` | offscreen render target / fullscreen triangle / post-process sampling |
| 67 | 多 Pass Blur | `67-ping-pong-blur` | ping-pong render targets / separable blur / fullscreen pass chain |
| 68 | Color Target State、Blend 与 Write Mask | `68-color-target-state-blend-and-write-mask` | blend state / additive blend / premultiplied alpha / `writeMask` |
| 69 | 颜色混合与 Alpha 表示 | `69-alpha-and-blending-basics` | alpha blending / straight alpha / premultiplied alpha |
| 70 | 透明排序与透明画布 | `70-blending-and-transparency` | transparent object sorting / canvas alpha / blending artifacts |
| 71 | Sampler Addressing、Filtering、LOD Clamp 与 Anisotropy | `71-sampler-addressing-filtering-lod-clamp-and-anisotropy` | address modes / min-mag-mipmap filter / LOD clamp / anisotropy fallback |
| 72 | Mipmap 与采样参数 | `72-mipmaps-and-sampler-parameters` | mipmap generation / sampler filtering / LOD selection |
| 73 | Multisampled Texture、Resolve Target 与 Sample Count | `73-multisampled-texture-resolve-target-and-sample-count` | multisampled color target / `resolveTarget` / sample count consistency |
| 74 | MSAA 与 Alpha-to-Coverage | `74-msaa-and-alpha-to-coverage` | MSAA / alpha-to-coverage / sample mask intuition |
| 75 | Texture Array、Array Layer View 与 Cube View | `75-texture-array-layer-view-and-cube-view` | `2d-array` view / selected array layer / cube view faces |
| 76 | Cubemap 与天空盒 | `76-cubemap-and-skybox` | cube texture / skybox sampling / view direction lookup |
| 77 | glTF 基础加载 | `77-gltf-basic` | glTF buffer / accessor / mesh primitive / WebGPU vertex binding |
| 78 | glTF 材质与贴图 | `78-gltf-textures` | glTF image / sampler / material texture binding |
| 79 | Texture Compression 与 Format Feature Gating | `79-texture-compression-and-format-feature-gating` | compressed texture features / BC fallback / required feature gate |
| 80 | glTF 场景整合 | `80-gltf-scene-integration` | glTF scene graph / nodes / transforms / multi-mesh draw |
| 81 | Picking 与对象选择 | `81-primitive-picking` | object-id render target / readback picking / mouse coordinate mapping |
| 82 | glTF 动画基础 | `82-gltf-animation-basic` | glTF animation channel / sampler interpolation / animated node transform |
| 83 | PBR 基础 | `83-gltf-pbr-basic` | metallic-roughness BRDF / normal mapping basics / PBR material |
| 84 | IBL 与环境贴图照明 | `84-ibl-and-image-based-lighting` | environment map sampling / diffuse IBL / specular IBL / sky lighting |

### 85-124：Compute 架构、查询、资源生命周期与 GPU-driven

| # | 课程 | 路由 id | 核心知识点 |
|---:|---|---|---|
| 85 | glTF 骨骼动画基础 | `85-gltf-skinning-basic` | skinning matrices / joint weights / skeleton animation |
| 86 | Compute：Game of Life | `86-compute-game-of-life` | cellular automata / ping-pong storage buffer / compute update |
| 87 | Compute：Boids 群集 | `87-compute-boids` | neighbor force / compute simulation / particle steering |
| 88 | Compute：Bitonic Sort | `88-compute-bitonic-sort` | bitonic sort network / compare-swap / parallel ordering |
| 89 | Reversed-Z 与深度精度 | `89-reversed-z-and-depth-precision` | reversed-Z projection / depth precision / depth compare |
| 90 | Depth/Stencil Attachment State 与 Stencil Ops | `90-depth-stencil-attachment-state-and-stencil-ops` | `depth24plus-stencil8` / stencil compare / read-write mask / stencil reference |
| 91 | Stencil 蒙版与描边 | `91-stencil-mask-and-outline` | stencil mask pass / outline pass / stencil compare op |
| 92 | Frame Graph 与 Pass 资源生命周期 | `92-frame-graph-and-pass-resource-lifetimes` | frame graph / pass dependency / resource read-write lifetime |
| 93 | Deferred Rendering 基础 | `93-deferred-rendering` | G-buffer / deferred lighting pass / material buffers |
| 94 | Deferred 与透明物体 | `94-deferred-transparent-objects` | deferred opaque pass / forward transparent pass / blending order |
| 95 | GPU Query 与性能测量 | `95-gpu-queries-and-profiling` | query set / query resolve / readback latency / profiling mindset |
| 96 | Timestamp QuerySet、Resolve Buffer 与 GPU Timing | `96-timestamp-queryset-resolve-buffer-and-gpu-timing` | `timestamp-query` feature / timestamp query set / GPU timing readback |
| 97 | Occlusion Query 与 Visibility Feedback | `97-occlusion-query-and-visibility-feedback` | occlusion query / delayed visibility feedback / previous-frame decision |
| 98 | Query Result Availability 与 Readback Ring | `98-query-result-availability-and-readback-rings` | query result availability / readback ring / frame-age delayed consumption |
| 99 | Queue 同步、Readback 与帧延迟 | `99-queue-sync-readback-and-frame-latency` | `queue.onSubmittedWorkDone` / async map / readback frame latency |
| 100 | Render Bundles | `100-render-bundles` | render bundle encoder / pre-recorded draw calls / `executeBundles` |
| 101 | Resize、资源生命周期与 Target 重建 | `101-resize-resource-lifecycle-and-target-rebuild` | resize / DPR / render scale / target destroy and rebuild |
| 102 | 资源池、Ring Buffer 与临时资源 | `102-resource-pooling-ring-buffers-and-transient-resources` | frames in flight / ring buffer / transient target pool |
| 103 | 高 DPI 画布与像素尺寸 | `103-hidpi-canvas-sizing` | CSS size vs drawing buffer size / DPR / canvas resize |
| 104 | 多画布与共享 Device | `104-hidpi-and-multiple-canvases` | shared GPUDevice / multiple canvas contexts / per-canvas configuration |
| 105 | Worker、消息传递与 OffscreenCanvas | `105-worker-messaging-and-offscreencanvas` | worker message / OffscreenCanvas / off-main-thread rendering |
| 106 | 离主线程渲染与状态同步 | `106-worker-and-off-main-thread` | worker render loop / state sync / main-thread UI bridge |
| 107 | 3D Texture 与体数据切片 | `107-texture3d-and-volume-slices` | 3D texture creation / volume slice sampling / layer visualization |
| 108 | 体渲染与 Ray Marching | `108-volume-rendering-and-texture3d` | volume ray marching / transfer function / 3D texture sampling |
| 109 | Metaballs 与隐式场 | `109-metaballs-and-implicit-fields` | implicit field / metaball density / field visualization |
| 110 | Marching Cubes 与 GPU 网格提取 | `110-marching-cubes-and-metaballs` | marching cubes / generated mesh / surface extraction |
| 111 | Cluster 构建与 Light Culling | `111-cluster-build-and-light-culling` | cluster grid / compute light culling / light list build |
| 112 | Clustered Shading | `112-clustered-shading` | clustered lighting / per-cluster light list / forward shading |
| 113 | 透明顺序问题与 OIT 动机 | `113-oit-motivation` | transparency order problem / OIT motivation / depth-sorted comparison |
| 114 | A-Buffer 与顺序无关透明 | `114-a-buffer-and-oit` | A-buffer / per-pixel fragment list / order-independent transparency |
| 115 | Canvas Format、Color Space 与 Presentation Tone Mapping | `115-canvas-format-color-space-and-presentation-tone-mapping` | presentation format / color space / tone mapping boundary |
| 116 | HDR、曝光与 Tone Mapping | `116-hdr-exposure-and-tone-mapping` | HDR render target / exposure / tone mapping curve |
| 117 | Bloom 与 HDR 后处理链 | `117-bloom-and-hdr-post-chain` | bright pass / blur chain / bloom composite / HDR pipeline |
| 118 | SSAO 与屏幕空间环境光遮蔽 | `118-ssao-and-screen-space-occlusion` | depth-normal G-buffer / SSAO sampling / blur and present |
| 119 | Compute：Prefix Sum 与 Stream Compaction | `119-prefix-sum-and-stream-compaction` | parallel scan / prefix sum / stream compaction / visible list foundation |
| 120 | 包围体与视锥裁剪 | `120-bounding-volumes-and-frustum-culling` | bounding sphere / frustum planes / CPU culling reference |
| 121 | Compute：Frustum Culling 与可见性标记 | `121-compute-frustum-culling-and-visibility-flags` | compute frustum test / visibility flags / CPU-GPU result compare |
| 122 | Visible List、Stream Compaction 与 Indirect Draw | `122-visible-list-and-indirect-draw` | flags -> scan -> compact visible list -> indirect draw |
| 123 | Hi-Z 与 Occlusion Culling | `123-hiz-and-occlusion-culling` | depth pyramid / Hi-Z test / screen-space occlusion culling |
| 124 | GPU-driven LOD 与实例调度 | `124-gpu-driven-lod-and-instance-scheduling` | GPU culling / LOD classification / multi-list indirect scheduling |

### 125-149：屏幕空间、路径追踪与 ReSTIR

| # | 课程 | 路由 id | 核心知识点 |
|---:|---|---|---|
| 125 | Motion Vectors 与 Velocity Buffer | `125-motion-vectors-and-velocity-buffer` | current/previous clip position / velocity buffer / motion visualization |
| 126 | TAA 与历史重投影 | `126-taa-and-history-reprojection` | jittered projection / history texture / velocity reprojection / neighborhood clamp |
| 127 | Motion Blur 与快门积分 | `127-motion-blur-and-shutter-integration` | velocity-guided blur / shutter scale / sample clamp |
| 128 | SSR 与屏幕空间反射 | `128-ssr-and-screen-space-reflections` | screen-space ray march / depth hit test / reflection fallback |
| 129 | 景深与 Circle of Confusion | `129-depth-of-field-and-circle-of-confusion` | CoC / near-far blur / focus distance / depth-guided composite |
| 130 | 双边滤波与 Edge-aware Blur | `130-bilateral-filtering-and-edge-aware-blur` | bilateral filter / depth sigma / normal sigma / edge-aware denoise |
| 131 | Temporal Accumulation 与 Disocclusion | `131-temporal-accumulation-and-disocclusion` | temporal accumulation / history rejection / disocclusion validation |
| 132 | SSGI 与屏幕空间间接光 | `132-ssgi-and-screen-space-indirect-light` | screen-space ray march / indirect diffuse estimate / hit fallback |
| 133 | Contact Shadows 与屏幕空间阴影 | `133-contact-shadows-and-screen-space-shadows` | screen-space shadow ray / thickness / contact shadow fade |
| 134 | TAAU 与 Dynamic Resolution | `134-taau-and-dynamic-resolution` | low-res render / temporal upsample / dynamic resolution / sharpen |
| 135 | Blue Noise 与采样模式 | `135-blue-noise-and-sampling-patterns` | white noise / stratified jitter / blue-noise-like sampling / integral variance |
| 136 | Monte Carlo 积分与半球采样 | `136-monte-carlo-integration-and-hemisphere-sampling` | Monte Carlo estimator / hemisphere sampling / running average convergence |
| 137 | BRDF Importance Sampling | `137-brdf-importance-sampling` | GGX importance sampling / BRDF pdf / roughness lobe / variance reduction |
| 138 | Compute Path Tracing 基础 | `138-compute-path-tracing-foundations` | ray generation / hit test / diffuse bounce / emissive contribution |
| 139 | Progressive Accumulation 与去噪入口 | `139-progressive-accumulation-and-denoising-entry` | progressive accumulation / sample counter / cross-bilateral denoise |
| 140 | BVH 与路径追踪加速结构 | `140-bvh-and-path-tracing-acceleration-structures` | CPU BVH build / flattened nodes / BVH traversal vs brute force |
| 141 | Next Event Estimation 与显式采样光源 | `141-next-event-estimation-and-explicit-light-sampling` | explicit light sampling / shadow ray / light pdf / direct-light variance |
| 142 | Multiple Importance Sampling | `142-multiple-importance-sampling` | light sampling / BRDF sampling / power heuristic / MIS weight |
| 143 | Russian Roulette 与路径吞吐管理 | `143-russian-roulette-and-throughput-management` | path throughput / survival probability / compensated termination |
| 144 | 实时路径追踪直射光与时域稳定化 | `144-real-time-path-traced-direct-lighting-and-temporal-stabilization` | 1 spp direct lighting / reprojection / history clamp / temporal stability |
| 145 | Reservoir Sampling 与 ReSTIR DI 基础 | `145-reservoir-sampling-and-restir-di-foundations` | weighted reservoir update / target pdf / many-light candidate sampling |
| 146 | Temporal Reservoir Reuse 与历史验证 | `146-temporal-reservoir-reuse-and-history-validation` | temporal reservoir merge / history validation / disocclusion rejection |
| 147 | Spatial Reservoir Reuse 与邻域重采样 | `147-spatial-reservoir-reuse-and-neighborhood-resampling` | spatial reservoir reuse / neighbor compatibility / boundary-safe reuse |
| 148 | ReSTIR DI 与多光源直射光 | `148-restir-di-and-many-lights-direct-lighting` | current candidates / temporal reuse / spatial reuse / many-light direct illumination |
| 149 | ReSTIR DI 的时域稳定化与入口级降噪 | `149-restir-di-temporal-stabilization-and-entry-denoising` | ReSTIR DI output / reprojected accumulation / history clamp / light animation stability |

### Chrome WebGPU 更新

| 更新编号 | 课程 | 路由 id | 核心知识点 |
|---:|---|---|---|
| U147-148 | Chrome 147-148 WebGPU Update Lab | `u147-148-chrome-webgpu-update-lab` | `linear_indexing` feature gate / `global_invocation_index` / `workgroup_index` / builtin index 与手写 flatten 对照 |

## 工程说明

- 课程注册入口：`src/studio/lessons.ts`
- 分段课程元数据：`src/studio/lesson-registry/`
- Chrome WebGPU 更新元数据：`src/studio/update-registry/`
- 课程 runtime：`src/lessons/lesson-XX-*`
- 更新实验 runtime：`src/updates/update-u*-*`
- 样式入口：`src/style.css`
