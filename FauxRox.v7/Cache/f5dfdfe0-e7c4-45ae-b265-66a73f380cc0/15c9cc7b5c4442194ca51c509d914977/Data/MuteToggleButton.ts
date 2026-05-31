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

  // Two separate scene objects - enable/disable is more reliable than texture swap
  @input @allowUndefined speakerOnObject: SceneObject;   // Speaker with sound waves (unmuted)
  @input @allowUndefined speakerOffObject: SceneObject;  // Speaker with X/line (muted)

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

    // Initial state: NOT muted (audio on), show speaker with sound waves
    print('[MuteToggleButton] Initializing - audio ON by default');
    this.setIconState(false);  // false = not muted = show "on" icon
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
    this.setIconState(isMuted);

    print('[MuteToggleButton] Mute: ' + (isMuted ? 'ON (silent)' : 'OFF (audio)'));
  }

  private setIconState(isMuted: boolean): void {
    // Enable/disable objects - more reliable than texture swapping
    if (!isNull(this.speakerOnObject)) {
      this.speakerOnObject.enabled = !isMuted;
    }
    if (!isNull(this.speakerOffObject)) {
      this.speakerOffObject.enabled = isMuted;
    }
    print('[MuteToggleButton] Icon state: ' + (isMuted ? 'MUTED (off icon)' : 'UNMUTED (on icon)'));
  }
}
