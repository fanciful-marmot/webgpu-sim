// Compute shader

struct Agent {
    pos: vec2<f32>,
    angle: f32,
    t: f32,
};

struct SimParams {
    agentSpeed: f32,
    turnSpeed: f32,
    decayRate: f32,
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

const PI: f32 = 3.14159274;
const TWO_PI: f32 = 6.28318548;
const AGENT_FIELD_SIZE: f32 = 1240;
const SENSOR_ANGLE: f32 = PI / 180 * 45; // Radians
const SENSOR_LENGTH: f32 = 10; // field units
const SENSOR_SIZE: i32 = 1; // field units
const FIELD_MIN: vec2<f32> = vec2(0.0);
const FIELD_MAX: vec2<f32> = vec2(AGENT_FIELD_SIZE);

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
fn rand(n: f32) -> f32 {
    return fract(sin(n + params.randomSeed) * 43758.5453123);
}

fn random_angle(in: f32) -> f32 {
    return rand(in) * TWO_PI;
}

fn velocity_from_angle(angle: f32) -> vec2<f32> {
    return vec2<f32>(
        cos(angle),
        sin(angle),
    ) * params.agentSpeed;
}

fn sense(agent: Agent, angle_offset: f32) -> f32 {
    var angle = agent.angle + angle_offset;
    var direction = vec2f(cos(angle), sin(angle));
    var sensor_center = agent.pos + direction * SENSOR_LENGTH;

    var sum = 0.0;
    for (var i = -SENSOR_SIZE; i <= SENSOR_SIZE; i++) {
        for (var j = -SENSOR_SIZE; j <= SENSOR_SIZE; j++) {
            var pos = sensor_center + vec2f(f32(i), f32(j));

            sum += textureLoad(fieldSrc, vec2<u32>(pos), 0).r;
        }
    }

    return sum;
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

    var agent = agentsSrc[index];
    var pos = agent.pos;
    var angle = agent.angle;
    var rand_seed = angle + pos.x + pos.y + f32(in.global_invocation_id.x);

    // Sense trails
    var forwardWeight = sense(agent, 0);
    var leftWeight = sense(agent, SENSOR_ANGLE);
    var rightWeight = sense(agent, -SENSOR_ANGLE);

    var steeringStrength = rand(rand_seed);

    if forwardWeight > leftWeight && forwardWeight > rightWeight {
        // Do nothing
    } else if forwardWeight < leftWeight && forwardWeight > rightWeight {
        // Turn randomly
        angle += (steeringStrength - 0.5) * 2 * params.turnSpeed * params.deltaT;
    } else if rightWeight > leftWeight {
        // Turn right
        angle -= steeringStrength * params.turnSpeed * params.deltaT;
    } else if leftWeight > rightWeight {
        // Turn left
        angle += steeringStrength * params.turnSpeed * params.deltaT;
    }

    // Move agent
    pos += velocity_from_angle(angle) * params.deltaT;

    // Keep particles in bounds
    if pos.x < 0 || pos.x > AGENT_FIELD_SIZE || pos.y < 0 || pos.y > AGENT_FIELD_SIZE {
        pos = clamp(pos, FIELD_MIN, FIELD_MAX); // Reset position and pick a new angle

        // Random bounce angle
        angle = random_angle(rand_seed);
    }

    // Update agent
    agentsDst[index] = Agent(pos, angle, 0);

    // Write data to field
    // textureStore(fieldDst, vec2<u32>(12, 12), vec4<f32>(1.0));
    textureStore(fieldDst, vec2<i32>(pos), vec4(vec3f(1.0), 1.0));
    // textureStore(fieldDst, vec2<i32>(pos), vec4(saturate(vec3f(1.0, leftWeight, rightWeight)), 1.0));
}
