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

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    return textureSample(fieldTexture, fieldSampler, in.uv) * 0.99;
}
