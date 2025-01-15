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
    agentSpeed: f32,
    turnSpeed: f32,
    decayRate: f32,
    randomSeed: f32,
    deltaT: f32,
};

@group(0) @binding(0) var<uniform> params : SimParams;

@group(1) @binding(0) var fieldSampler: sampler;
@group(1) @binding(1) var fieldTexture: texture_2d<f32>;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    var pixelStep = vec2(1.0) / vec2f(textureDimensions(fieldTexture));

    var sum = vec4f();
    var original_color = textureSample(fieldTexture, fieldSampler, in.uv);

    // Diffusion 3x3 blur
    for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
            sum += textureSample(fieldTexture, fieldSampler, in.uv + pixelStep * vec2f(f32(i), f32(j)));
        }
    }

    var blurred_color = sum / 9.0;

    var diffused_color = mix(original_color, blurred_color, 100.0 * params.deltaT);
    var diffuse_weight = 2.0 / 9.0;
    // var diffuse_weight = saturate(vec4(DECAY_RATE) * params.deltaT) * 50;
    blurred_color = mix(original_color, blurred_color, diffuse_weight);

    // Decay
    var color_out = max(vec4f(), blurred_color - vec4(params.decayRate) * params.deltaT);

    return color_out;
}
