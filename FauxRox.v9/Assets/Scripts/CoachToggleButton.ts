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

  // Mute button - only visible when coach is ON
  @input @allowUndefined muteButton: SceneObject;

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

    // The coach is the one that knows whether it is listening, and there is
    // more than one button that can start it - one here and one on the wrist.
    // A button that only updates itself when pressed goes stale the moment
    // the other one is used, and then two buttons disagree about a thing
    // there is only one of.
    this.createEvent('UpdateEvent').bind(() => {
      this.followCoach();
    });
  }

  /** What the icon is currently showing, so it is only redrawn on a change */
  private shownOn: boolean = false;

  private followCoach(): void {
    if (!this.aiCoach) return;

    var isOn = (this.aiCoach as any).isToggleOn === true;
    if (isOn === this.shownOn) return;

    this.shownOn = isOn;
    this.setIconTexture(isOn);
    this.setMuteButtonVisible(isOn);
  }

  private initializeIcon(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Initial state: toggle is OFF, show grey mic, hide mute button
    print('[CoachToggleButton] Initializing - toggle OFF by default');
    this.shownOn = false;
    this.setIconTexture(false);
    this.setMuteButtonVisible(false);
  }

  private onButtonPressed(): void {
    if (!this.aiCoach) {
      print('[CoachToggleButton] AICoach not connected');
      return;
    }

    // Ask the coach to change; the icon follows what it actually did rather
    // than what this button assumed it would do.
    (this.aiCoach as any).toggleCoach();

    print('[CoachToggleButton] Toggle pressed: now ' +
          ((this.aiCoach as any).isToggleOn ? 'ON' : 'OFF'));
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

  private setMuteButtonVisible(visible: boolean): void {
    if (!isNull(this.muteButton)) {
      this.muteButton.enabled = visible;
      print('[CoachToggleButton] Mute button: ' + (visible ? 'VISIBLE' : 'HIDDEN'));
    }
  }
}
