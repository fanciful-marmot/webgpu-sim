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

struct BlitParams {
    species1Colour: vec4f,
    species2Colour: vec4f,
    species3Colour: vec4f,
};

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> params : BlitParams;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    var f = textureSample(fieldTexture, fieldSampler, in.uv).rgb;

    var c: vec3f = 
        f.r * params.species1Colour.rgb +
        f.g * params.species2Colour.rgb +
        f.b * params.species3Colour.rgb;

    return vec4(c, 1.0);
}
