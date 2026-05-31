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
    // Use OnStartEvent to ensure proper initialization timing
    this.createEvent('OnStartEvent').bind(() => {
      this.initializeIcons();
    });
  }

  private initializeIcons(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Initial state: toggle is OFF, so grey visible, green hidden
    print('[CoachToggleButton] Initializing icons - toggle OFF by default');
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
      this.setVisibility(this.microphoneOn, isOn, 'MicrophoneON');
    }

    // Grey mic (MicrophoneOFF) - visible only when toggle is OFF
    if (this.microphoneOff) {
      this.setVisibility(this.microphoneOff, !isOn, 'MicrophoneOFF');
    }
  }

  private setVisibility(obj: SceneObject, visible: boolean, name: string): void {
    const alpha = visible ? 1.0 : 0.0;

    // Try Image component
    const image = obj.getComponent('Component.Image') as Image;
    if (image) {
      try {
        const pass = image.mainPass;
        if (pass) {
          pass.baseColor = new vec4(1, 1, 1, alpha);
          print('[CoachToggleButton] ' + name + ' alpha = ' + alpha);
          return;
        }
      } catch (e) {
        print('[CoachToggleButton] ' + name + ' mainPass error: ' + e);
      }
    }

    // Try RenderMeshVisual
    const rmv = obj.getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
    if (rmv) {
      try {
        const pass = rmv.mainPass;
        if (pass) {
          pass.baseColor = new vec4(1, 1, 1, alpha);
          print('[CoachToggleButton] ' + name + ' RMV alpha = ' + alpha);
          return;
        }
      } catch (e) {
        print('[CoachToggleButton] ' + name + ' RMV mainPass error: ' + e);
      }
    }

    // Fallback: just use enabled
    obj.enabled = visible;
    print('[CoachToggleButton] ' + name + ' enabled = ' + visible + ' (fallback)');
  }
}
