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

fn channelLinearRgbToSrgb(c: f32) -> f32 {
	if ( c < 0.0031308 ) {
        return c * 12.92;
    } else {
        return 1.055 * ( pow( c, 0.41666 ) ) - 0.055;
    }
}
fn linearRgbToSrgb(c: vec3f) -> vec3f {
    return vec3f(
        channelLinearRgbToSrgb(c.r),
        channelLinearRgbToSrgb(c.g),
        channelLinearRgbToSrgb(c.b),
    );
}

fn channelSrgbToLinear(c: f32) -> f32 {
    if ( c < 0.04045 ) {
        return c * 0.0773993808;
    } else {
        return pow( c * 0.9478672986 + 0.0521327014, 2.4 );
    }
}
fn srgbToLinearRgb(c: vec3f) -> vec3f {
    return vec3f(
        channelSrgbToLinear(c.r),
        channelSrgbToLinear(c.g),
        channelSrgbToLinear(c.b),
    );
}

// Gamma curves are the same as srgb so can reuse the
// transfer functions
fn displayP3ToLinearP3(c: vec3f) -> vec3f {
    return srgbToLinearRgb(c);
}

fn linearP3ToDisplayP3(c: vec3f) -> vec3f {
    return linearRgbToSrgb(c);
}

// TODO: Is this right?
fn linearRgbToLinearP3(c: vec3f) -> vec3f {
    // From https://www.colour-science.org/apps/
    const m: mat3x3f = mat3x3f(
        0.8224619687,  0.1775380313, -0.0000000000,
        0.0331941989,  0.9668058011,  0.0000000000,
        0.0170826307,  0.0723974407,  0.9105199286,
    );

    return m * c;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    var f = textureSample(fieldTexture, fieldSampler, in.uv).rgb;

    // Convert colours to linear before doing math with them
    var c: vec3f = 
        f.r * srgbToLinearRgb(params.species1Colour.rgb) +
        f.g * srgbToLinearRgb(params.species2Colour.rgb) +
        f.b * srgbToLinearRgb(params.species3Colour.rgb);

    // TODO: This doesn't seem to work as expected
    // c = linearRgbToLinearP3(c);

    // Gamma correction
    c = linearRgbToSrgb(c);

    return vec4(c, 1.0);
}
