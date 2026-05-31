// ============================================================================
// ProgressRingShader.glsl — Circular Progress Ring
// Lens Studio · Spectacles · Fragment Shader
// ============================================================================
// Use with Unlit material, copy this code into the Fragment Shader section
// ============================================================================

// Parameters (set these as material parameters in Lens Studio)
uniform float progress;      // 0.0 - 1.0
uniform float ringWidth;     // 0.1 - 0.3 typical
uniform float smoothness;    // 0.01 - 0.05
uniform vec4 ringColor;      // RGBA
uniform vec4 bgColor;        // RGBA for background ring

#define PI 3.14159265359

void main() {
    // Center UV at origin, scale to -1 to 1
    vec2 uv = (fragCoord - 0.5) * 2.0;

    // Calculate distance from center and angle
    float dist = length(uv);

    // Angle: atan2(x, y) puts 0 at top, positive clockwise
    float angle = atan(uv.x, uv.y);

    // Normalize angle to 0-1 range, starting from top going clockwise
    float normAngle = (angle + PI) / (2.0 * PI);
    normAngle = fract(normAngle + 0.5);

    // Ring boundaries
    float outer = 1.0;
    float inner = 1.0 - ringWidth;

    // Soft ring mask
    float ring = smoothstep(inner - smoothness, inner, dist)
               * (1.0 - smoothstep(outer, outer + smoothness, dist));

    // Progress arc mask
    float arc = 1.0 - smoothstep(progress - smoothness, progress + smoothness, normAngle);

    // Background (full ring)
    vec4 bg = bgColor * ring;

    // Foreground (progress arc)
    vec4 fg = ringColor * ring * arc;

    // Composite: background + foreground
    vec4 result = bg * (1.0 - fg.a) + fg;
    result.a = ring * max(bgColor.a, arc * ringColor.a);

    fragColor = result;
}
