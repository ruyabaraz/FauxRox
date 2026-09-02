// ============================================================================
// WristMenu.ts — Wrist-mounted menu for race control
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Provides Pause, Resume, Stop controls during race.
// Attach to wrist-tracked SceneObject.
// ============================================================================

import { CapsuleButton } from 'SpectaclesUIKit.lspkg/Scripts/Components/Button/CapsuleButton';
import { AICoach } from './AICoach';

@component
export class WristMenu extends BaseScriptComponent {

  // ── References ──────────────────────────────────────────────────────────────

  @input raceStateMachineScript: ScriptComponent;

  /** AI Coach for voice queries */
  @input @allowUndefined aiCoach: AICoach;

  /** Pause button - visible when race is RUNNING or STATION */
  @input @allowUndefined pauseButton: CapsuleButton;
  @input @allowUndefined pauseButtonObject: SceneObject;

  /** Resume button - visible when race is PAUSED */
  @input @allowUndefined resumeButton: CapsuleButton;
  @input @allowUndefined resumeButtonObject: SceneObject;

  /** Stop button - visible when race is active (RUNNING, STATION, or PAUSED) */
  @input @allowUndefined stopButton: CapsuleButton;
  @input @allowUndefined stopButtonObject: SceneObject;

  /**
   * Ask Coach - the same switch as the one on the panel.
   *
   * One coach, one state, two places to reach it. Both buttons ask it to
   * toggle and both read back what it did, so neither can be showing that
   * the coach is listening while the other shows that it is not.
   */
  @input @allowUndefined askCoachButton: CapsuleButton;
  @input @allowUndefined askCoachButtonObject: SceneObject;

  /** Optional icon that follows the coach, the same way the panel's does */
  @input @allowUndefined askCoachIcon: Image;
  @input @allowUndefined askCoachOnTexture: Texture;
  @input @allowUndefined askCoachOffTexture: Texture;

  /**
   * Next block - leaves the rest of this one undone.
   *
   * Shown only where it means something: in a training session, while
   * something is running, and only when there is another block to go to.
   * A button that is there and does nothing is worse than one that is not
   * there, because pressing it and having nothing happen reads as broken.
   *
   * Never in a race. Eight stations in an order is what a race is.
   */
  @input @allowUndefined nextBlockButton: CapsuleButton;
  @input @allowUndefined nextBlockButtonObject: SceneObject;

  /** Entire menu container - hidden when race is IDLE or FINISHED */
  @input @allowUndefined menuContainer: SceneObject;

  @input debugPrint: boolean = true;

  // ── Internal ────────────────────────────────────────────────────────────────

  private rsm(): any { return this.raceStateMachineScript as any; }

  onAwake(): void {
    this.log('WristMenu initialized');

    // Hide menu initially
    if (this.menuContainer) {
      this.menuContainer.enabled = false;
    }

    // Bind buttons after UIKit initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtons();
    });

    // Update visibility based on race state
    this.createEvent('UpdateEvent').bind(() => {
      this.updateVisibility();
      this.followCoach();
    });
  }

  private bindButtons(): void {
    // Pause button
    if (this.pauseButton) {
      try {
        this.pauseButton.onTriggerUp.add(() => {
          this.onPausePressed();
        });
        this.log('Pause button bound');
      } catch (e) {
        this.log('Could not bind pause button: ' + e);
      }
    }

    // Resume button
    if (this.resumeButton) {
      try {
        this.resumeButton.onTriggerUp.add(() => {
          this.onResumePressed();
        });
        this.log('Resume button bound');
      } catch (e) {
        this.log('Could not bind resume button: ' + e);
      }
    }

    // Stop button
    if (this.stopButton) {
      try {
        this.stopButton.onTriggerUp.add(() => {
          this.onStopPressed();
        });
        this.log('Stop button bound');
      } catch (e) {
        this.log('Could not bind stop button: ' + e);
      }
    }

    // Next block
    if (this.nextBlockButton) {
      try {
        this.nextBlockButton.onTriggerUp.add(() => {
          this.onNextBlockPressed();
        });
        this.log('Next block button bound');
      } catch (e) {
        this.log('Could not bind next block button: ' + e);
      }
    }

    // Ask Coach button
    if (this.askCoachButton) {
      try {
        this.askCoachButton.onTriggerUp.add(() => {
          this.onAskCoachPressed();
        });
        this.log('Ask Coach button bound');
      } catch (e) {
        this.log('Could not bind ask coach button: ' + e);
      }
    }
  }

  // ── Button Handlers ─────────────────────────────────────────────────────────

  private onPausePressed(): void {
    var race = this.rsm();
    if (!race) return;

    // Separate buttons, so separate intents. Both used to call the toggle,
    // which meant pressing PAUSE twice resumed the session.
    this.log('Pause pressed');
    race.pauseSession();
  }

  private onResumePressed(): void {
    var race = this.rsm();
    if (!race) return;

    this.log('Resume pressed');
    race.resumeSession();
  }

  private onStopPressed(): void {
    var race = this.rsm();
    if (!race) return;

    this.log('Stop pressed');
    race.stopRace();
  }

  /**
   * On to the next block.
   *
   * The engine decides whether it can happen and says why not when it
   * cannot - the same answer the coach gets when asked out loud, so the two
   * ways of asking cannot disagree about what is allowed.
   */
  private onNextBlockPressed(): void {
    var race = this.rsm();
    if (!race || !race.skipToNextBlock) return;

    var refused = race.skipToNextBlock();

    this.log(refused
      ? 'Next block refused - ' + refused
      : 'Skipped to the next block');
  }

  /**
   * The same thing the panel's microphone does.
   *
   * It used to be push-to-talk, which the coach ignores outright while the
   * toggle is on - so pressing it after switching the coach on from the panel
   * did nothing at all, and the wrist had a button that worked only when the
   * other one had not been used.
   */
  private onAskCoachPressed(): void {
    if (!this.aiCoach) {
      this.log('AI Coach not connected');
      return;
    }

    (this.aiCoach as any).toggleCoach();

    this.log('Ask Coach pressed: coach now ' +
             ((this.aiCoach as any).isToggleOn ? 'ON' : 'OFF'));
  }

  /** What the wrist icon is showing, so it is only redrawn on a change */
  private _coachShownOn: boolean = false;

  /**
   * Follow the coach rather than remembering what this button did.
   *
   * The other microphone can change it, and a button that only updates
   * itself when pressed goes stale the moment the other one is used.
   */
  private followCoach(): void {
    if (!this.aiCoach || !this.askCoachIcon) return;

    var isOn = (this.aiCoach as any).isToggleOn === true;
    if (isOn === this._coachShownOn) return;

    this._coachShownOn = isOn;

    var texture = isOn ? this.askCoachOnTexture : this.askCoachOffTexture;
    if (texture) this.askCoachIcon.mainPass.baseTex = texture;

    this.log('Coach icon now ' + (isOn ? 'ON' : 'OFF'));
  }

  // ── Visibility ──────────────────────────────────────────────────────────────

  private updateVisibility(): void {
    var race = this.rsm();
    if (!race) return;

    var state = race.state;

    // Hide menu during two-handed exercises (ZONE_HIT) to prevent accidental stops
    var isZoneHit = race.isZoneHitActive || false;

    // Menu visible only during active race AND not in two-handed exercise
    var menuVisible = (state === 'RUNNING' || state === 'APPROACHING_STATION' || state === 'APPROACHING_FINISH' || state === 'STATION' || state === 'PAUSED') && !isZoneHit;
    if (this.menuContainer) {
      this.menuContainer.enabled = menuVisible;
    }

    if (!menuVisible) return;

    // Pause button: visible when running, approaching, or at station
    var showPause = (state === 'RUNNING' || state === 'APPROACHING_STATION' || state === 'STATION');
    if (this.pauseButtonObject) {
      this.pauseButtonObject.enabled = showPause;
    }

    // Resume button: visible when paused
    var showResume = (state === 'PAUSED');
    if (this.resumeButtonObject) {
      this.resumeButtonObject.enabled = showResume;
    }

    // Stop button: always visible during active race
    if (this.stopButtonObject) {
      this.stopButtonObject.enabled = true;
    }

    // Ask Coach button: always visible during active race
    if (this.askCoachButtonObject) {
      this.askCoachButtonObject.enabled = true;
    }

    // Next block: only where pressing it would do something. Asked of the
    // engine rather than worked out here, so the button and the voice command
    // cannot disagree about whether there is a block to go to.
    var canSkip = race.canSkipBlock === true;

    if (this.nextBlockButtonObject) {
      this.nextBlockButtonObject.enabled = canSkip;
    }

    // Said once each way rather than every frame. "It never appears" and "it
    // appeared and there was nowhere to go" are different problems, and from
    // the outside they look identical.
    if (canSkip !== this._couldSkip) {
      this._couldSkip = canSkip;

      this.log(canSkip
        ? 'Next block available'
        : 'Next block unavailable - this is the last block, or it is a race');

      if (canSkip && !this.nextBlockButtonObject) {
        this.log('...but no next block button object is wired, so nothing shows');
      }
    }
  }

  /** Whether moving on was possible last frame, so the log says it once */
  private _couldSkip: boolean = false;

  // ── Debug ───────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[WristMenu] ' + msg);
    }
  }
}
