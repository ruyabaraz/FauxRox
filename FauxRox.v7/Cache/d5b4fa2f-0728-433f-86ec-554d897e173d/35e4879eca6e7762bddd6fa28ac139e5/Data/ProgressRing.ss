// ============================================================================
// ProgressRing.ss — Circular Progress Ring Shader
// Lens Studio · Spectacles
// ============================================================================
// Creates a circular arc that fills based on 'progress' parameter (0-1)
// Arc starts at top (12 o'clock) and fills clockwise
// ============================================================================

//-----------------------------------------------------------------------
// Inputs
//-----------------------------------------------------------------------
//@input float progress = 0.5 {"min":0.0, "max":1.0, "label":"Progress"}
//@input float ringWidth = 0.15 {"min":0.01, "max":0.5, "label":"Ring Width"}
//@input float smoothness = 0.02 {"min":0.001, "max":0.1, "label":"Edge Smoothness"}
//@input vec4 ringColor = {0.8, 1.0, 0.8, 1.0} {"label":"Ring Color"}
//@input vec4 bgColor = {0.2, 0.2, 0.2, 0.3} {"label":"Background Color"}
//@input bool showBackground = true {"label":"Show Background"}

//-----------------------------------------------------------------------
// Main Fragment Shader
//-----------------------------------------------------------------------
void main() {
    // UV koordinatlarını -1 to 1 aralığına çevir (merkez 0,0)
    vec2 uv = fragCoord * 2.0 - 1.0;

    // Mesafe ve açı hesapla
    float dist = length(uv);
    float angle = atan(uv.x, uv.y); // atan(x,y) -> top = 0, clockwise positive

    // Açıyı 0-1 aralığına normalize et (top = 0, clockwise)
    float normalizedAngle = (angle + PI) / (2.0 * PI);
    // Top'tan başlaması için kaydır
    normalizedAngle = fract(normalizedAngle + 0.5);

    // Ring mask (iç ve dış yarıçap)
    float outerRadius = 1.0;
    float innerRadius = 1.0 - ringWidth;

    float ringMask = smoothstep(innerRadius - smoothness, innerRadius + smoothness, dist)
                   * smoothstep(outerRadius + smoothness, outerRadius - smoothness, dist);

    // Progress mask
    float progressMask = smoothstep(progress + smoothness, progress - smoothness, normalizedAngle);

    // Final color
    vec4 finalColor = vec4(0.0);

    // Background ring (full circle)
    if (showBackground) {
        finalColor = bgColor * ringMask;
    }

    // Progress ring (partial arc)
    vec4 progressColor = ringColor * ringMask * progressMask;
    finalColor = mix(finalColor, ringColor, ringMask * progressMask);
    finalColor.a = ringMask * (showBackground ? max(bgColor.a, progressMask * ringColor.a) : progressMask * ringColor.a);

    fragColor = finalColor;
}
