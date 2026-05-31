// ============================================================================
// MuteToggleButton.ts — Toggle button for AI Coach Audio Mute
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Works with SpectaclesUIKit RoundButton
// Add this script to the same object that has RoundButton
// ============================================================================

import { AICoach } from './AICoach';

@component
export class MuteToggleButton extends BaseScriptComponent {

  @input aiCoach: AICoach;

  // Single image that will swap textures
  @input @allowUndefined speakerIcon: Image;
  @input @allowUndefined speakerOnTexture: Texture;   // Speaker with sound waves (unmuted)
  @input @allowUndefined speakerOffTexture: Texture;  // Speaker with X/line (muted)

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
      print('[MuteToggleButton] Connected to RoundButton');
    } else {
      print('[MuteToggleButton] WARNING: RoundButton not found on this object');
    }

    // Initial state will be set when parent becomes enabled
    this.createEvent('OnStartEvent').bind(() => {
      this.initializeIcon();
    });
  }

  private initializeIcon(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Initial state: NOT muted (audio on), show speaker ON icon
    print('[MuteToggleButton] Initializing - audio ON by default');
    this.setIconTexture(false);  // false = not muted = show speakerOn
  }

  private onButtonPressed(): void {
    if (!this.aiCoach) {
      print('[MuteToggleButton] AICoach not connected');
      return;
    }

    // Toggle mute
    (this.aiCoach as any).toggleMute();

    // Get new state and update icon
    const isMuted = (this.aiCoach as any).isMuted;
    this.setIconTexture(isMuted);

    print('[MuteToggleButton] Mute: ' + (isMuted ? 'ON (silent)' : 'OFF (audio)'));
  }

  private setIconTexture(isMuted: boolean): void {
    if (!this.speakerIcon) {
      print('[MuteToggleButton] ERROR: speakerIcon not assigned');
      return;
    }

    // When muted: show OFF icon (speaker with X)
    // When not muted: show ON icon (speaker with waves)
    const texture = isMuted ? this.speakerOffTexture : this.speakerOnTexture;

    if (!texture) {
      print('[MuteToggleButton] ERROR: ' + (isMuted ? 'speakerOffTexture' : 'speakerOnTexture') + ' not assigned');
      return;
    }

    // Swap the texture on the Image component
    this.speakerIcon.mainPass.baseTex = texture;
    print('[MuteToggleButton] Icon texture set to: ' + (isMuted ? 'MUTED (off)' : 'UNMUTED (on)'));
  }
}
