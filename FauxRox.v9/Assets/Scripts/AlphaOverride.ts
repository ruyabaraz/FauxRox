// ============================================================================
// AlphaOverride.ts — Per-mesh max alpha override
// Add this component to any mesh that needs a different max alpha during fade
// ============================================================================

@component
export class AlphaOverride extends BaseScriptComponent {
  @input
  @hint("Maximum alpha for this mesh (0.0 - 1.0)")
  maxAlpha: number = 1.0;
}
