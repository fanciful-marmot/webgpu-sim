struct VertexInput {
    @location(0) pos: vec3f,
    @location(1) uv: vec2f,
}

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
 };

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    out.pos = vec4f(in.pos, 1);
    out.uv = in.uv;

    return out;
}

struct SimParams {
    randomSeed: f32,
    deltaT: f32,
};

@group(0) @binding(0) var<uniform> params : SimParams;

@group(1) @binding(0) var fieldSampler: sampler;
@group(1) @binding(1) var fieldTexture: texture_2d<f32>;

const DECAY_RATE = 0.1; // units/second

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    var pixelStep = vec2(1.0) / vec2f(textureDimensions(fieldTexture));

    var color_out = vec4f();

    // Diffusion 3x3 blur
    var sum = vec4f();
    for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
            sum += textureSample(fieldTexture, fieldSampler, in.uv + pixelStep * vec2f(f32(i), f32(j)));
        }
    }
    // TODO: This should somehow be factored by time
    color_out += sum / 9.0;

    // Decay
    color_out = clamp(color_out - vec4(DECAY_RATE) * params.deltaT, vec4(), vec4(1.0));

    return color_out;
}
