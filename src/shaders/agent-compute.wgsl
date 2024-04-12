// Compute shader

struct Agent {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

struct SimParams {
    randomSeed: f32,
    deltaT: f32,
};

struct ComputeIn {
    @builtin(global_invocation_id) global_invocation_id: vec3<u32>,
};

@group(0) @binding(0) var<uniform> params : SimParams;
@group(1) @binding(0) var<storage, read> agentsSrc : array<Agent>;
@group(1) @binding(1) var<storage, read_write> agentsDst : array<Agent>;
@group(1) @binding(2) var fieldSrc : texture_2d<f32>;
@group(1) @binding(3) var fieldDst : texture_storage_2d<rgba32float, write>;

// const PI: f32 = 3.14159274;
const TWO_PI: f32 = 6.28318548;
const AGENT_FIELD_SIZE: f32 = 512.0;
const AGENT_SPEED: f32 = AGENT_FIELD_SIZE / 10.0; // field units/second
const FIELD_MIN: vec2<f32> = vec2(0.0);
const FIELD_MAX: vec2<f32> = vec2(AGENT_FIELD_SIZE);

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
fn rand(n: f32) -> f32 {
    return fract(sin(n + params.randomSeed) * 43758.5453123);
}

fn random_angle(in: f32) -> vec2<f32> {
    let angle = rand(in) * TWO_PI;

    return vec2<f32>(
        cos(angle),
        sin(angle),
    ) * AGENT_SPEED;
}

@compute
@workgroup_size(64)
fn compute_main(in: ComputeIn) {
    let total = arrayLength(&agentsSrc);
    let index = in.global_invocation_id.x;
    // TODO: What is this guarding against?
    if index >= total {
        return;
    }

    var vel = agentsSrc[index].vel;
    var pos = agentsSrc[index].pos + vel * params.deltaT;

    // // Keep particles in bounds
    if pos.x < 0 || pos.x > AGENT_FIELD_SIZE || pos.y < 0 || pos.y > AGENT_FIELD_SIZE {
        pos = clamp(pos, FIELD_MIN, FIELD_MAX); // Reset position and pick a new angle

        // Random bounce angle
        vel = random_angle(vel.x + vel.y + f32(in.global_invocation_id.x));
        // vel = -vel;
    }


    // // Update agent
    agentsDst[index] = Agent(pos, vel);

    // Write data to field
    // textureStore(fieldDst, vec2<u32>(12, 12), vec4<f32>(1.0));
    textureStore(fieldDst, vec2<i32>(pos), vec4(1.0));
}
