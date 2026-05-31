// ============================================================================
// ProgressRing.ss — Circular Progress Ring Shader
// Lens Studio 5.x · Spectacles
// ============================================================================
// Arc progress ring - starts from top, fills clockwise
// ============================================================================

// Output
output_vec4 fragColor;

// Input parameters (controlled from TypeScript)
input_float progress;    // 0.0 - 1.0
input_float ringWidth;   // 0.05 - 0.2
input_vec4 ringColor;    // Foreground color
input_vec4 bgColor;      // Background ring color

#define PI 3.14159265358979
#define blur 0.008
#define glow 0.02

void main()
{
    // UV centered at origin (-0.5 to 0.5)
    vec2 uv = system.getSurfaceUVCoord0() - vec2(0.5, 0.5);

    // Distance squared from center
    float r = uv.x * uv.x + uv.y * uv.y;

    // Ring radii
    float minRadius = 0.20 - ringWidth * 0.5;
    float maxRadius = 0.20 + ringWidth * 0.5;

    // Ring mask with smooth edges
    float ring = (1.0 - smoothstep(maxRadius, maxRadius + blur, r))
               * smoothstep(minRadius, minRadius + blur, r);

    // Glow effect
    float gl = (1.0 - smoothstep(minRadius, maxRadius + glow, r))
             * smoothstep(minRadius - glow, maxRadius, r);

    // Angle: 0 at top, clockwise 0-1
    float a = (PI + atan(uv.y, uv.x)) / (PI * 2.0);
    a = mod(a + 0.25, 1.0);  // Rotate so 0 is at top

    // Progress mask
    float p = 1.0 - progress;
    float arc = smoothstep(p, p + blur, a);
    float glowArc = smoothstep(p - glow * 0.5, p + glow * 0.5, a);

    // Background ring (full circle, dimmer)
    vec4 bg = bgColor * ring;

    // Foreground progress arc
    vec4 fg = ringColor * (ring * arc + gl * glowArc * 0.3);

    // Composite
    vec3 finalColor = mix(bg.rgb, fg.rgb, arc);
    float finalAlpha = ring * max(bgColor.a, arc * ringColor.a + glowArc * 0.2);

    fragColor = vec4(finalColor, finalAlpha);
}
