import blitShaderCode from './shaders/blit.wgsl';
import decayShaderCode from './shaders/decay.wgsl';
import agentComputeShaderCode from './shaders/agent-compute.wgsl';
import { randomPoint } from './utils';

const unitSquareData = {
    vertices: new Float32Array([
        1.0, -1.0, 0.0,  // BR
        -1.0, -1.0, 0.0, // BL
        -1.0, 1.0, 0.0,  // TL
        1.0, 1.0, 0.0,   // TR
    ]),
    uvs: new Float32Array([
        1.0, 1.0, // BR
        0.0, 1.0, // BL
        0.0, 0.0, // TL
        1.0, 0.0, // TR
    ]),
    indices: new Uint16Array([0, 1, 2, 2, 3, 0]),
};

const createBuffer = (
    device: GPUDevice,
    arr: Float32Array | Uint16Array,
    usage: number
) => {
    // 📏 Align to 4 bytes (thanks @chrimsonite)
    let desc = {
        size: (arr.byteLength + 3) & ~3,
        usage,
        mappedAtCreation: true
    };
    let buffer = device.createBuffer(desc);
    const writeArray =
        arr instanceof Uint16Array
            ? new Uint16Array(buffer.getMappedRange())
            : new Float32Array(buffer.getMappedRange());
    writeArray.set(arr);
    buffer.unmap();
    return buffer;
};

const AGENTS_PER_GROUP = 64;

export type SimParam = {
    agentSpeed: number;
    turnSpeed: number;
    decayRate: number;
};

export type InitialConditions = {
    numAgents: number,
    fieldSize: number,
};

export default class Renderer {
    canvas: HTMLCanvasElement;
    previousFrameTimestamp: DOMHighResTimeStamp = 0;

    // API Data Structures
    adapter: GPUAdapter;
    device: GPUDevice;
    queue: GPUQueue;

    // Frame backings
    context: GPUCanvasContext;

    // Blit resources
    unitSquare: {
        positionBuffer: GPUBuffer;
        uvBuffer: GPUBuffer;
        indexBuffer: GPUBuffer;
    };
    blitModule: GPUShaderModule;
    pipeline: GPURenderPipeline;

    // Sim
    simParams: SimParam = {
        agentSpeed: 100,
        turnSpeed: 13,
        decayRate: 0.25,
    };
    simParamsUniformLayout: GPUBindGroupLayout;
    simParamBindGroup: GPUBindGroup;
    simParamValues: Float32Array;
    simParamBuffer: GPUBuffer;

    // Initial conditions
    initialConditions: InitialConditions;

    // Agent resources
    agentFieldTextures: Array<{
        texture: GPUTexture;
        view: GPUTextureView;
        bindGroup: GPUBindGroup;
    }>;
    agentBuffers: Array<{
        buffer: GPUBuffer;
    }>;
    agentBindGroups: Array<{
        bindGroup: GPUBindGroup;
    }>;
    agentFieldPipeline: GPURenderPipeline;
    agentComputePipeline: GPUComputePipeline;

    pingpong: 0 | 1 = 0;
    paused: boolean = false;

    constructor(canvas) {
        this.canvas = canvas;

        this.initialConditions = {
            numAgents: 10_000,
            fieldSize: Math.min(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height) * window.devicePixelRatio,
        }
    }

    // Cleanup all resources except device and queue
    cleanup() {
        this.unitSquare.positionBuffer.destroy();
        this.unitSquare.uvBuffer.destroy();
        this.unitSquare.indexBuffer.destroy();

        this.simParamBuffer.destroy();

        this.agentFieldTextures.forEach(({ texture }) => {
            texture.destroy();
        });
    }

    reset() {
        this.cleanup();
        this.initializeSimParams();
        this.initializeBlitResources();
        this.initializeAgentResources();
    }

    // Start the rendering engine
    async start() {
        if (await this.initializeAPI()) {
            this.resizeBackings();
            this.initializeSimParams();
            this.initializeBlitResources();
            this.initializeAgentResources();
            this.render();
        }
    }

    // Initialize WebGPU
    async initializeAPI(): Promise<boolean> {
        try {
            // 🏭 Entry to WebGPU
            const entry: GPU = navigator.gpu;
            if (!entry) {
                return false;
            }

            // 🔌 Physical Device Adapter
            this.adapter = await entry.requestAdapter();

            // 💻 Logical Device
            this.device = await this.adapter.requestDevice({
                requiredFeatures: [
                    'float32-filterable',
                ] as any,
            });

            // 📦 Queue
            this.queue = this.device.queue;
        } catch (e) {
            console.error(e);
            return false;
        }

        return true;
    }

    initializeSimParams() {
        // SimParams uniforms
        this.simParamValues = new Float32Array([
            this.simParams.agentSpeed,
            this.simParams.turnSpeed,
            this.simParams.decayRate,
            Math.random(), // randomSeed
            16.6 / 1000, // deltaT
        ]);
        this.simParamBuffer = createBuffer(this.device, this.simParamValues, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.simParamsUniformLayout = this.device.createBindGroupLayout({
            label: 'AgentSimParams',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: this.simParamValues.buffer.byteLength,
                    },
                },
            ]
        });
        this.simParamBindGroup = this.device.createBindGroup({
            label: `SimParamUniforms`,
            layout: this.simParamsUniformLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.simParamBuffer },
                },
            ]
        });
    }

    initializeAgentResources() {
        // Create the agent buffers
        const floatsPerAgent = 4;
        const agentData = new Float32Array(this.initialConditions.numAgents * floatsPerAgent);
        for (let i = 0; i < this.initialConditions.numAgents * floatsPerAgent; i += floatsPerAgent) {
            const { x, y } = randomPoint();
            const angle = Math.atan2(y, x);
            agentData[i + 0] = x * this.initialConditions.fieldSize * 0.5 + this.initialConditions.fieldSize * 0.5; // pos.x
            agentData[i + 1] = y * this.initialConditions.fieldSize * 0.5 + this.initialConditions.fieldSize * 0.5; // pos.y
            agentData[i + 2] = angle + Math.PI; // angle
            agentData[i + 3] = 0; // Alignment
        }
        this.agentBuffers = [
            { buffer: createBuffer(this.device, agentData, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) },
            { buffer: createBuffer(this.device, agentData, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) },
        ];

        // Shaders
        const decayModule = this.device.createShaderModule({
            code: decayShaderCode,
        });
        const computeModule = this.device.createShaderModule({
            code: agentComputeShaderCode,
        });

        // Graphics Pipeline

        // Input Assembly
        const positionAttribDesc: GPUVertexAttribute = {
            shaderLocation: 0, // [[location(0)]]
            offset: 0,
            format: 'float32x3'
        };
        const positionBufferDesc: GPUVertexBufferLayout = {
            attributes: [positionAttribDesc],
            arrayStride: 4 * 3, // sizeof(float) * 3
            stepMode: 'vertex'
        };
        const uvAttribDesc: GPUVertexAttribute = {
            shaderLocation: 1, // [[location(1)]]
            offset: 0,
            format: 'float32x2'
        };
        const uvBufferDesc: GPUVertexBufferLayout = {
            attributes: [uvAttribDesc],
            arrayStride: 4 * 2, // sizeof(float) * 2
            stepMode: 'vertex'
        };

        // Uniform Data
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'AgentFieldBindGroup',
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            ],
        });
        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.simParamsUniformLayout, bindGroupLayout] });

        // Create field textures
        const baseFieldData = new Float32Array(this.initialConditions.fieldSize * this.initialConditions.fieldSize * 4);
        baseFieldData.fill(0);

        const fieldDescriptor: GPUTextureDescriptor = {
            label: 'AgentFieldTexture',
            size: [this.initialConditions.fieldSize, this.initialConditions.fieldSize, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
            format: 'rgba32float',
        };
        const sampler = this.device.createSampler();
        const createField = () => {
            const texture = this.device.createTexture(fieldDescriptor);
            const view = texture.createView();
            const bindGroup = this.device.createBindGroup({
                label: 'AgentFieldBindGroup',
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: view },
                ],
            });

            this.device.queue.writeTexture({ texture }, baseFieldData, { bytesPerRow: this.initialConditions.fieldSize * 4 * 4 }, { width: this.initialConditions.fieldSize, height: this.initialConditions.fieldSize });

            return {
                texture,
                view,
                bindGroup,
            }
        };
        this.agentFieldTextures = [
            createField(),
            createField(),
        ];

        // Decay pipeline
        // Shader Stages
        const vertex: GPUVertexState = {
            module: decayModule,
            entryPoint: 'vs_main',
            buffers: [positionBufferDesc, uvBufferDesc]
        };

        const colorState: GPUColorTargetState = {
            format: 'rgba32float',
        };

        const fragment: GPUFragmentState = {
            module: decayModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        };

        // Rasterization
        const primitive: GPUPrimitiveState = {
            frontFace: 'cw',
            cullMode: 'none',
            topology: 'triangle-list'
        };

        const pipelineDesc: GPURenderPipelineDescriptor = {
            label: 'DecayPipeline',

            layout: pipelineLayout,

            vertex,
            fragment,

            primitive,
        };
        this.agentFieldPipeline = this.device.createRenderPipeline(pipelineDesc);

        // Agent update pipeline
        const computeBindGroupLayout = this.device.createBindGroupLayout({
            label: 'AgentUpdate',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'read-only-storage',
                        minBindingSize: this.initialConditions.numAgents * floatsPerAgent * 4,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: this.initialConditions.numAgents * floatsPerAgent * 4,
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'write-only',
                        format: 'rgba32float',
                        viewDimension: '2d',
                    },
                },
            ]
        });

        this.agentBindGroups = (new Array(2).fill(0)).map((_, i) => {
            const textureData = this.agentFieldTextures[i];
            const nextTextureData = this.agentFieldTextures[(i + 1) % 2];
            const agentData = this.agentBuffers[i];
            const nextAgentData = this.agentBuffers[(i + 1) % 2];

            return {
                bindGroup: this.device.createBindGroup({
                    label: `AgentCompute${i}`,
                    layout: computeBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: { buffer: agentData.buffer },
                        },
                        {
                            binding: 1,
                            resource: { buffer: nextAgentData.buffer },
                        },
                        {
                            binding: 2,
                            resource: textureData.view,
                        },
                        {
                            binding: 3,
                            resource: nextTextureData.view,
                        },
                    ],
                }),
            }
        });

        this.agentComputePipeline = this.device.createComputePipeline({
            label: 'AgentCompute',
            compute: {
                module: computeModule,
                entryPoint: 'compute_main',
            },
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.simParamsUniformLayout, computeBindGroupLayout] }),
        });
    }

    // Initialize resources to the final blit
    initializeBlitResources() {
        this.unitSquare = {
            positionBuffer: createBuffer(this.device, unitSquareData.vertices, GPUBufferUsage.VERTEX),
            uvBuffer: createBuffer(this.device, unitSquareData.uvs, GPUBufferUsage.VERTEX),
            indexBuffer: createBuffer(this.device, unitSquareData.indices, GPUBufferUsage.INDEX),
        };

        // Shaders
        this.blitModule = this.device.createShaderModule({
            code: blitShaderCode,
        });

        // Graphics Pipeline

        // Input Assembly
        const positionAttribDesc: GPUVertexAttribute = {
            shaderLocation: 0, // [[location(0)]]
            offset: 0,
            format: 'float32x3'
        };
        const positionBufferDesc: GPUVertexBufferLayout = {
            attributes: [positionAttribDesc],
            arrayStride: 4 * 3, // sizeof(float) * 3
            stepMode: 'vertex'
        };
        const uvAttribDesc: GPUVertexAttribute = {
            shaderLocation: 1, // [[location(1)]]
            offset: 0,
            format: 'float32x2'
        };
        const uvBufferDesc: GPUVertexBufferLayout = {
            attributes: [uvAttribDesc],
            arrayStride: 4 * 2, // sizeof(float) * 2
            stepMode: 'vertex'
        };

        // Uniform Data
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'BlitBindGroupLayout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            ],
        });
        const pipelineLayoutDesc = { bindGroupLayouts: [bindGroupLayout] };
        const pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDesc);

        // Shader Stages
        const vertex: GPUVertexState = {
            module: this.blitModule,
            entryPoint: 'vs_main',
            buffers: [positionBufferDesc, uvBufferDesc]
        };

        // Color/Blend State
        const colorState: GPUColorTargetState = {
            format: navigator.gpu.getPreferredCanvasFormat(),
        };

        const fragment: GPUFragmentState = {
            module: this.blitModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        };

        // Rasterization
        const primitive: GPUPrimitiveState = {
            frontFace: 'cw',
            cullMode: 'none',
            topology: 'triangle-list'
        };

        const pipelineDesc: GPURenderPipelineDescriptor = {
            label: 'BlitPipeline',

            layout: pipelineLayout,

            vertex,
            fragment,

            primitive,
        };
        this.pipeline = this.device.createRenderPipeline(pipelineDesc);
    }

    // Resize swapchain, frame buffer attachments
    resizeBackings() {
        // ⛓️ Swapchain
        if (!this.context) {
            this.context = this.canvas.getContext('webgpu');
            const canvasConfig: GPUCanvasConfiguration = {
                device: this.device,
                format: navigator.gpu.getPreferredCanvasFormat(),
                usage:
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_SRC,
                alphaMode: 'opaque'
            };
            this.context.configure(canvasConfig);
        }
    }

    encodeAgentComputeCommands(encoder: GPUCommandEncoder) {
        const pass = encoder.beginComputePass({ label: 'AgentCompute' });
        pass.setPipeline(this.agentComputePipeline);
        pass.setBindGroup(0, this.simParamBindGroup);
        pass.setBindGroup(1, this.agentBindGroups[this.pingpong].bindGroup);
        pass.dispatchWorkgroups(Math.ceil(this.initialConditions.numAgents / AGENTS_PER_GROUP), 1, 1);
        pass.end();
    }

    // Encodes commands to fade out the agent field
    encodeDecayCommands(encoder: GPUCommandEncoder) {
        // Encode drawing commands
        const pass = encoder.beginRenderPass({
            label: 'DecayPass',
            colorAttachments: [
                {
                    view: this.agentFieldTextures[(this.pingpong + 1) % 2].view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ],
        });
        pass.setPipeline(this.agentFieldPipeline);
        pass.setViewport(
            0,
            0,
            this.initialConditions.fieldSize,
            this.initialConditions.fieldSize,
            0,
            1
        );
        pass.setScissorRect(
            0,
            0,
            this.initialConditions.fieldSize,
            this.initialConditions.fieldSize
        );
        pass.setBindGroup(0, this.simParamBindGroup);
        pass.setBindGroup(1, this.agentFieldTextures[this.pingpong].bindGroup);
        pass.setVertexBuffer(0, this.unitSquare.positionBuffer);
        pass.setVertexBuffer(1, this.unitSquare.uvBuffer);
        pass.setIndexBuffer(this.unitSquare.indexBuffer, 'uint16');
        pass.drawIndexed(6, 1);
        pass.end();
    }

    // Encode commands for final screen draw
    encodeBlitCommands(encoder: GPUCommandEncoder) {
        let colorAttachment: GPURenderPassColorAttachment = {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            label: 'BlitPass',
            colorAttachments: [colorAttachment],
        };

        // Encode drawing commands
        const passEncoder = encoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setViewport(
            0,
            0,
            this.canvas.width,
            this.canvas.height,
            0,
            1
        );
        passEncoder.setScissorRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
        passEncoder.setBindGroup(0, this.agentFieldTextures[this.pingpong].bindGroup);
        passEncoder.setVertexBuffer(0, this.unitSquare.positionBuffer);
        passEncoder.setVertexBuffer(1, this.unitSquare.uvBuffer);
        passEncoder.setIndexBuffer(this.unitSquare.indexBuffer, 'uint16');
        passEncoder.drawIndexed(6, 1);
        passEncoder.end();
    }

    render = (time: DOMHighResTimeStamp = 0) => {
        // Clamp deltaT at 17ms. Avoids huge jump if tab loses focus and then returns
        const deltaT = Math.min(17, (time - this.previousFrameTimestamp)) / 1000; // In seconds
        this.previousFrameTimestamp = time;

        if (this.paused) {
            return;
        }

        // Update uniforms
        this.simParamValues.set([
            this.simParams.agentSpeed,
            this.simParams.turnSpeed,
            this.simParams.decayRate,
            Math.random(), // randomSeed
            deltaT, // deltaT
        ]);
        this.device.queue.writeBuffer(this.simParamBuffer, 0, this.simParamValues);

        // Write and submit commands to queue
        // TODO: Use a single encoder?
        // this.queue.submit([this.encodeDecayCommands(), this.encodeAgentComputeCommands(deltaT), this.encodeBlitCommands()]);
        const commandEncoder = this.device.createCommandEncoder();

        this.encodeDecayCommands(commandEncoder);
        this.encodeAgentComputeCommands(commandEncoder);
        this.encodeBlitCommands(commandEncoder);

        this.device.queue.submit([commandEncoder.finish()]);

        this.pingpong = this.pingpong ? 0 : 1;

        // Refresh canvas
        requestAnimationFrame(this.render);
    };

    getSimParam(paramName: keyof SimParam): number {
        return this.simParams[paramName];
    }

    setSimParam(paramName: keyof SimParam, value: number) {
        this.simParams[paramName] = value;
    }

    getInitialCondition(paramName: keyof InitialConditions): number {
        return this.initialConditions[paramName];
    }

    setInitialCondition(paramName: keyof InitialConditions, value: number) {
        this.initialConditions[paramName] = value;
    }
}
