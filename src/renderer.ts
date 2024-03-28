import blitShaderCode from './shaders/blit.wgsl';

const unitSquareData = {
    vertices: new Float32Array([
        1.0, -1.0, 0.0,  // BR
        -1.0, -1.0, 0.0, // BL
        -1.0, 1.0, 0.0,  // TL
        1.0, 1.0, 0.0,   // TR
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

export default class Renderer {
    canvas: HTMLCanvasElement;

    // API Data Structures
    adapter: GPUAdapter;
    device: GPUDevice;
    queue: GPUQueue;

    // Frame Backings
    context: GPUCanvasContext;

    // Resources
    positionBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    blitModule: GPUShaderModule;
    pipeline: GPURenderPipeline;

    commandEncoder: GPUCommandEncoder;
    passEncoder: GPURenderPassEncoder;

    constructor(canvas) {
        this.canvas = canvas;
    }

    // 🏎️ Start the rendering engine
    async start() {
        if (await this.initializeAPI()) {
            this.resizeBackings();
            await this.initializeResources();
            this.render();
        }
    }

    // 🌟 Initialize WebGPU
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
            this.device = await this.adapter.requestDevice();

            // 📦 Queue
            this.queue = this.device.queue;
        } catch (e) {
            console.error(e);
            return false;
        }

        return true;
    }

    // 🍱 Initialize resources to render triangle (buffers, shaders, pipeline)
    async initializeResources() {
        this.positionBuffer = createBuffer(this.device, unitSquareData.vertices, GPUBufferUsage.VERTEX);
        this.indexBuffer = createBuffer(this.device, unitSquareData.indices, GPUBufferUsage.INDEX);

        // Shaders
        this.blitModule = this.device.createShaderModule({
            code: blitShaderCode,
        });

        // ⚗️ Graphics Pipeline

        // 🔣 Input Assembly
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

        // 🦄 Uniform Data
        const pipelineLayoutDesc = { bindGroupLayouts: [] };
        const layout = this.device.createPipelineLayout(pipelineLayoutDesc);

        // 🎭 Shader Stages
        const vertex: GPUVertexState = {
            module: this.blitModule,
            entryPoint: 'vs_main',
            buffers: [positionBufferDesc]
        };

        // 🌀 Color/Blend State
        const colorState: GPUColorTargetState = {
            format: navigator.gpu.getPreferredCanvasFormat(),
        };

        const fragment: GPUFragmentState = {
            module: this.blitModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        };

        // 🟨 Rasterization
        const primitive: GPUPrimitiveState = {
            frontFace: 'cw',
            cullMode: 'none',
            topology: 'triangle-list'
        };

        const pipelineDesc: GPURenderPipelineDescriptor = {
            layout,

            vertex,
            fragment,

            primitive,
        };
        this.pipeline = this.device.createRenderPipeline(pipelineDesc);
    }

    // ↙️ Resize swapchain, frame buffer attachments
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

    // ✍️ Write commands to send to the GPU
    encodeCommands() {
        let colorAttachment: GPURenderPassColorAttachment = {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [colorAttachment],
        };

        this.commandEncoder = this.device.createCommandEncoder();

        // 🖌️ Encode drawing commands
        this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDesc);
        this.passEncoder.setPipeline(this.pipeline);
        this.passEncoder.setViewport(
            0,
            0,
            this.canvas.width,
            this.canvas.height,
            0,
            1
        );
        this.passEncoder.setScissorRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
        this.passEncoder.setVertexBuffer(0, this.positionBuffer);
        this.passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
        this.passEncoder.drawIndexed(6, 1);
        this.passEncoder.end();

        this.queue.submit([this.commandEncoder.finish()]);
    }

    render = () => {
        // Write and submit commands to queue
        this.encodeCommands();

        // Refresh canvas
        requestAnimationFrame(this.render);
    };
}
