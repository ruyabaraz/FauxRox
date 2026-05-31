// ============================================================================
// CoachToggleButton.ts — Toggle button for AI Coach
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Works with SpectaclesUIKit RoundButton
// Add this script to the same object that has RoundButton
// ============================================================================

import { AICoach } from './AICoach';

@component
export class CoachToggleButton extends BaseScriptComponent {

  @input aiCoach: AICoach;

  // Single image that will swap textures
  @input @allowUndefined micIcon: Image;
  @input @allowUndefined micOnTexture: Texture;   // Green mic texture
  @input @allowUndefined micOffTexture: Texture;  // Grey mic texture

  private roundButton: any = null;
  private initialized: boolean = false;

  onAwake(): void {
    // Find RoundButton on the same object
    const components = this.getSceneObject().getComponents('ScriptComponent');

    for (let i = 0; i < components.length; i++) {
      const comp = components[i] as any;
      // Check if it's a RoundButton (has onTriggerUp event)
      if (comp.onTriggerUp && comp !== this) {
        this.roundButton = comp;
        break;
      }
    }

    if (this.roundButton) {
      this.roundButton.onTriggerUp.add(() => {
        this.onButtonPressed();
      });
      print('[CoachToggleButton] Connected to RoundButton');
    } else {
      print('[CoachToggleButton] WARNING: RoundButton not found on this object');
    }

    // Initial state will be set when parent becomes enabled
    this.createEvent('OnStartEvent').bind(() => {
      this.initializeIcon();
    });
  }

  private initializeIcon(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Initial state: toggle is OFF, show grey mic
    print('[CoachToggleButton] Initializing - toggle OFF by default');
    this.setIconTexture(false);
  }

  private onButtonPressed(): void {
    if (!this.aiCoach) {
      print('[CoachToggleButton] AICoach not connected');
      return;
    }

    // Toggle the coach
    (this.aiCoach as any).toggleCoach();

    // Get new state and update icon
    const isOn = (this.aiCoach as any).isToggleOn;
    this.setIconTexture(isOn);

    print('[CoachToggleButton] Toggle: ' + (isOn ? 'ON' : 'OFF'));
  }

  private setIconTexture(isOn: boolean): void {
    if (!this.micIcon) {
      print('[CoachToggleButton] ERROR: micIcon not assigned');
      return;
    }

    const texture = isOn ? this.micOnTexture : this.micOffTexture;

    if (!texture) {
      print('[CoachToggleButton] ERROR: ' + (isOn ? 'micOnTexture' : 'micOffTexture') + ' not assigned');
      return;
    }

    // Swap the texture on the Image component
    this.micIcon.mainPass.baseTex = texture;
    print('[CoachToggleButton] Icon texture set to: ' + (isOn ? 'ON (green)' : 'OFF (grey)'));
  }
}
