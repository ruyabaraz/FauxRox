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
  @input @allowUndefined onIcon: SceneObject;
  @input @allowUndefined offIcon: SceneObject;

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
      // Subscribe to button trigger
      this.roundButton.onTriggerUp.add(() => {
        this.onButtonPressed();
      });
      print('[CoachToggleButton] Connected to RoundButton');
    } else {
      print('[CoachToggleButton] WARNING: RoundButton not found on this object');
    }

    // Set initial icon state based on AICoach
    const initialState = this.aiCoach ? (this.aiCoach as any).isToggleOn : false;
    this.updateIcons(initialState);
  }

  private onButtonPressed(): void {
    if (!this.aiCoach) {
      print('[CoachToggleButton] AICoach not connected');
      return;
    }

    // Toggle the coach
    (this.aiCoach as any).toggleCoach();

    // Update icons
    const isOn = (this.aiCoach as any).isToggleOn;
    this.updateIcons(isOn);

    print('[CoachToggleButton] Toggle: ' + (isOn ? 'ON' : 'OFF'));
  }

  private updateIcons(isOn: boolean): void {
    print('[CoachToggleButton] updateIcons: isOn=' + isOn);
    print('[CoachToggleButton] onIcon exists: ' + (this.onIcon ? 'yes' : 'no'));
    print('[CoachToggleButton] offIcon exists: ' + (this.offIcon ? 'yes' : 'no'));

    if (this.onIcon) {
      this.onIcon.enabled = isOn;
      print('[CoachToggleButton] onIcon.enabled = ' + isOn);
    }
    if (this.offIcon) {
      this.offIcon.enabled = !isOn;
      print('[CoachToggleButton] offIcon.enabled = ' + !isOn);
    }
  }
}
