// ============================================================================
// CoachToggleButton.ts — Toggle button for AI Coach
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================

import { AICoach } from './AICoach';

@component
export class CoachToggleButton extends BaseScriptComponent {

  @input aiCoach: AICoach;
  @input @allowUndefined onIcon: SceneObject;
  @input @allowUndefined offIcon: SceneObject;
  @input @allowUndefined buttonInteractable: ScriptComponent;

  onAwake(): void {
    // Try to get Interactable from this object or input
    const interactable = this.buttonInteractable || this.getSceneObject().getComponent('ScriptComponent');

    if (interactable) {
      // Bind to pinch/tap event
      const btn = interactable as any;

      if (btn.onTriggerEnd) {
        btn.onTriggerEnd.add(() => this.onButtonPressed());
      } else if (btn.onButtonPinched) {
        btn.onButtonPinched.add(() => this.onButtonPressed());
      }
    }

    // Set initial icon state
    this.updateIcons(false);
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
  }

  private updateIcons(isOn: boolean): void {
    if (this.onIcon) {
      this.onIcon.enabled = isOn;
    }
    if (this.offIcon) {
      this.offIcon.enabled = !isOn;
    }
  }
}
