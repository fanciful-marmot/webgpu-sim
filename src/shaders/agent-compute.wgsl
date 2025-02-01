// Compute shader

struct Agent {
    pos: vec2<f32>,
    angle: f32,
    species: f32,
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
@group(1) @binding(3) var fieldDst : texture_storage_2d<rgba16float, write>;

const PI: f32 = 3.14159274;
const TWO_PI: f32 = 6.28318548;
const SENSOR_ANGLE: f32 = PI / 180 * 45; // Radians
const SENSOR_LENGTH: f32 = 10; // field units
const SENSOR_SIZE: i32 = 1; // field units

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
    var species: u32 = u32(agent.species);

    var sum = 0.0;
    for (var i = -SENSOR_SIZE; i <= SENSOR_SIZE; i++) {
        for (var j = -SENSOR_SIZE; j <= SENSOR_SIZE; j++) {
            var pos = sensor_center + vec2f(f32(i), f32(j));

            var src = textureLoad(fieldSrc, vec2<u32>(pos), 0).rgb;
            if (species == 0) {
                sum += src.r;
            } else if (species == 1) {
                sum += src.g;
            } else {
                sum += src.b;
            }
            
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

    let FIELD_MIN: vec2<f32> = vec2(0.0);
    let FIELD_MAX = vec2<f32>(textureDimensions(fieldDst).xy);

    var agent = agentsSrc[index];
    var pos = agent.pos;
    var angle = agent.angle;
    var rand_seed = angle + pos.x + pos.y + f32(in.global_invocation_id.x);
    var species: u32 = u32(agent.species);

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
    if pos.x < 0 || pos.x > FIELD_MAX.x || pos.y < 0 || pos.y > FIELD_MAX.y {
        pos = clamp(pos, FIELD_MIN, FIELD_MAX); // Reset position and pick a new angle

        // Random bounce angle
        angle = random_angle(rand_seed);
    }

    // Update agent
    agentsDst[index] = Agent(pos, angle, agent.species);

    // Write data to field
    // TODO: There's a bit of a race condition here if 2 particles try to write to the same
    // field cell from different species on the same tick
    var dst = textureLoad(fieldSrc, vec2<u32>(pos), 0).rgb;
    if (species == 0) {
        dst.r = 1.0;
    } else if (species == 1) {
        dst.g = 1.0;
    } else {
        dst.b = 1.0;
    }
    textureStore(fieldDst, vec2<i32>(pos), vec4(dst, 1.0));
    // textureStore(fieldDst, vec2<i32>(pos), vec4(saturate(vec3f(1.0, leftWeight, rightWeight)), 1.0));
}
