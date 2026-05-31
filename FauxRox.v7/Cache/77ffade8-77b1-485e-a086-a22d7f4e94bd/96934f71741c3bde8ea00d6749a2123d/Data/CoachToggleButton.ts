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
  @input @allowUndefined microphoneOn: SceneObject;   // Green mic (visible when ON)
  @input @allowUndefined microphoneOff: SceneObject;  // Grey mic (visible when OFF)

  private roundButton: any = null;

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

    // Initial state: toggle is OFF, so grey visible, green hidden
    this.setIconState(false);
  }

  private onButtonPressed(): void {
    if (!this.aiCoach) {
      print('[CoachToggleButton] AICoach not connected');
      return;
    }

    // Toggle the coach
    (this.aiCoach as any).toggleCoach();

    // Get new state and update icons
    const isOn = (this.aiCoach as any).isToggleOn;
    this.setIconState(isOn);

    print('[CoachToggleButton] Toggle: ' + (isOn ? 'ON' : 'OFF'));
  }

  private setIconState(isOn: boolean): void {
    print('[CoachToggleButton] setIconState: ' + (isOn ? 'ON' : 'OFF'));

    // Green mic (MicrophoneON) - visible only when toggle is ON
    if (this.microphoneOn) {
      this.microphoneOn.enabled = isOn;
      print('[CoachToggleButton] MicrophoneON.enabled = ' + isOn);
    }

    // Grey mic (MicrophoneOFF) - visible only when toggle is OFF
    if (this.microphoneOff) {
      this.microphoneOff.enabled = !isOn;
      print('[CoachToggleButton] MicrophoneOFF.enabled = ' + !isOn);
    }
  }
}
