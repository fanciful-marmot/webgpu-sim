import blitShaderCode from './shaders/blit.wgsl';
import decayShaderCode from './shaders/decay.wgsl';

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

const AGENT_FIELD_SIZE = 128;
const NUM_AGENTS = 64;

export default class Renderer {
    canvas: HTMLCanvasElement;

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

    // Agent resources
    agentFieldTextures: Array<{
        texture: GPUTexture;
        view: GPUTextureView;
        bindGroup: GPUBindGroup;
    }>;
    agentBuffers: Array<{
        buffer: GPUBuffer;
    }>;
    agentFieldPipeline: GPURenderPipeline;

    pingpong: 0 | 1 = 0;

    constructor(canvas) {
        this.canvas = canvas;
    }

    // Start the rendering engine
    async start() {
        if (await this.initializeAPI()) {
            this.resizeBackings();
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
            this.device = await this.adapter.requestDevice({ requiredFeatures: ['float32-filterable'] as any });

            // 📦 Queue
            this.queue = this.device.queue;
        } catch (e) {
            console.error(e);
            return false;
        }

        return true;
    }

    initializeAgentResources() {
        // Create the agent buffers
        const floatsPerAgent = 4;
        const agentData = new Float32Array(NUM_AGENTS * floatsPerAgent);
        for (let i = 0; i < NUM_AGENTS; i += floatsPerAgent) {
            agentData[i + 0] = 0; // pos.x
            agentData[i + 1] = 0; // pos.y
            agentData[i + 2] = 0; // vel.x
            agentData[i + 3] = 0; // vel.y
        }
        this.agentBuffers = [
            { buffer: createBuffer(this.device, agentData, GPUBufferUsage.VERTEX) },
            { buffer: createBuffer(this.device, agentData, GPUBufferUsage.VERTEX) },
        ];

        // Shaders
        const decayModule = this.device.createShaderModule({
            code: decayShaderCode,
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
        const pipelineLayoutDesc = { bindGroupLayouts: [bindGroupLayout] };
        const pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDesc);

        // Create field textures
        const baseFieldData = new Float32Array(AGENT_FIELD_SIZE * AGENT_FIELD_SIZE * 4);
        baseFieldData.fill(1.0);

        const fieldDescriptor: GPUTextureDescriptor = {
            label: 'AgentFieldTexture',
            size: [AGENT_FIELD_SIZE, AGENT_FIELD_SIZE, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
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

            this.device.queue.writeTexture({ texture }, baseFieldData, { bytesPerRow: AGENT_FIELD_SIZE * 4 * 4 }, { width: AGENT_FIELD_SIZE, height: AGENT_FIELD_SIZE });

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

    // Encode commands for final screen draw
    encodeBlitCommands() {
        let colorAttachment: GPURenderPassColorAttachment = {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [colorAttachment],
        };

        const commandEncoder = this.device.createCommandEncoder();

        // Encode drawing commands
        const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
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

        this.queue.submit([commandEncoder.finish()]);
    }

    render = () => {
        // Write and submit commands to queue
        this.encodeBlitCommands();

        // Refresh canvas
        requestAnimationFrame(this.render);
    };
}
