// BLEConnectionUI.ts — Dialog for HR monitor connection flow
// Flow: Prompt (Yes/No) → Scanning → Device List → Connect

import { HeartRateTracker, HRConnectionState } from './HeartRateTracker';

export enum BLEUIState {
  HIDDEN = 'HIDDEN',
  PROMPT = 'PROMPT',
  SCANNING = 'SCANNING',
  DEVICE_LIST = 'DEVICE_LIST',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISABLED = 'DISABLED'
}

@component
export class BLEConnectionUI extends BaseScriptComponent {

  // ── Dialog Panel (Yes/No Prompt) ────────────────────────────────────────────
  @input promptPanel: SceneObject;
  @input yesButton: ScriptComponent;
  @input noButton: ScriptComponent;

  // ── Scanning Panel ──────────────────────────────────────────────────────────
  @input scanningPanel: SceneObject;
  @input scanningText: Text;

  // ── Device List Panel ───────────────────────────────────────────────────────
  @input deviceListPanel: SceneObject;
  @input deviceButtonsContainer: SceneObject;
  @input @allowUndefined deviceButtonPrefab: ObjectPrefab;
  @input @allowUndefined rescanButton: ScriptComponent;
  @input @allowUndefined cancelButton: ScriptComponent;

  // ── References ──────────────────────────────────────────────────────────────
  @input heartRateTracker: HeartRateTracker;
  @input heartRateHUD: SceneObject;

  /** Frame - parent container for entire BLE UI (has Frame.ts) */
  @input @allowUndefined frame: SceneObject;

  /** Skip button - allows user to skip BLE and continue */
  @input @allowUndefined skipButton: ScriptComponent;

  /**
   * Back - returns to the question, rather than answering it for them.
   *
   * Skip and Cancel both mean "carry on without a monitor", which is an
   * answer. Somebody who scanned, found nothing and wants to turn their strap
   * on and try again was being made to choose between that answer and
   * standing there: with no devices found and no way back, the only screen
   * left was one that said "No HR monitors found." and offered nothing.
   */
  @input @allowUndefined backButton: ScriptComponent;

  @input debugPrint: boolean = true;

  // ── Internal State ──────────────────────────────────────────────────────────
  private onCompleteCallback: (connected: boolean) => void = null;
  private _state: BLEUIState = BLEUIState.HIDDEN;
  private deviceButtons: SceneObject[] = [];
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES: number = 3;
  private connectionListenerRegistered: boolean = false;

  onAwake(): void {
    // CRITICAL: Disable panels IMMEDIATELY before any UI kit initialization
    // This prevents ScrollWindow from initializing before scroller is created
    if (this.frame) this.frame.enabled = false;
    if (this.deviceListPanel) this.deviceListPanel.enabled = false;
    if (this.scanningPanel) this.scanningPanel.enabled = false;
    if (this.promptPanel) this.promptPanel.enabled = false;
    if (this.rescanButton) this.rescanButton.getSceneObject().enabled = false;
    if (this.cancelButton) this.cancelButton.getSceneObject().enabled = false;

    this.log('BLEConnectionUI initialized');
    this.hideAll();

    // Delay button setup to OnStartEvent - SIK components need time to initialize
    this.createEvent('OnStartEvent').bind(() => {
      this.setupButtonCallbacks();
    });
  }

  private setupButtonCallbacks(): void {
    this.log('Setting up button callbacks...');

    // Yes button
    if (this.yesButton) {
      var yes = this.yesButton as any;
      this.log('Yes button found, onTriggerUp: ' + (yes.onTriggerUp ? 'exists' : 'undefined'));
      if (yes.onTriggerUp && yes.onTriggerUp.add) {
        yes.onTriggerUp.add(() => this.onYesPressed());
        this.log('Yes button callback bound');
      } else if (yes.onButtonPinched) {
        // Alternative: some buttons use onButtonPinched
        yes.onButtonPinched.add(() => this.onYesPressed());
        this.log('Yes button callback bound (onButtonPinched)');
      }
    } else {
      this.log('WARNING: yesButton not linked');
    }

    // No button
    if (this.noButton) {
      var no = this.noButton as any;
      this.log('No button found, onTriggerUp: ' + (no.onTriggerUp ? 'exists' : 'undefined'));
      if (no.onTriggerUp && no.onTriggerUp.add) {
        no.onTriggerUp.add(() => this.onNoPressed());
        this.log('No button callback bound');
      } else if (no.onButtonPinched) {
        no.onButtonPinched.add(() => this.onNoPressed());
        this.log('No button callback bound (onButtonPinched)');
      }
    } else {
      this.log('WARNING: noButton not linked');
    }

    // Rescan button
    if (this.rescanButton) {
      var rescan = this.rescanButton as any;
      if (rescan.onTriggerUp && rescan.onTriggerUp.add) {
        rescan.onTriggerUp.add(() => this.startScanning());
        this.log('Rescan button callback bound');
      } else if (rescan.onButtonPinched) {
        rescan.onButtonPinched.add(() => this.startScanning());
      }
    }

    // Cancel button - skips BLE connection from device list
    if (this.cancelButton) {
      var cancel = this.cancelButton as any;
      if (cancel.onTriggerUp && cancel.onTriggerUp.add) {
        cancel.onTriggerUp.add(() => this.onCancelPressed());
        this.log('Cancel button callback bound');
      } else if (cancel.onButtonPinched) {
        cancel.onButtonPinched.add(() => this.onCancelPressed());
      }
    }

    // Back - to the question, not past it
    if (this.backButton) {
      var back = this.backButton as any;
      if (back.onTriggerUp && back.onTriggerUp.add) {
        back.onTriggerUp.add(() => this.onBackPressed());
        this.log('Back button callback bound');
      } else if (back.onButtonPinched) {
        back.onButtonPinched.add(() => this.onBackPressed());
      }
    }

    // Skip button - allows skipping BLE connection
    if (this.skipButton) {
      var skip = this.skipButton as any;
      if (skip.onTriggerUp && skip.onTriggerUp.add) {
        skip.onTriggerUp.add(() => this.onSkipPressed());
        this.log('Skip button callback bound');
      } else if (skip.onButtonPinched) {
        skip.onButtonPinched.add(() => this.onSkipPressed());
      }
    }

    // Register connection state listener ONCE
    this.registerConnectionListener();
  }

  private registerConnectionListener(): void {
    if (this.connectionListenerRegistered) return;

    this.heartRateTracker.onConnectionStateChange((state: HRConnectionState, msg: string) => {
      this.handleConnectionStateChange(state, msg);
    });
    this.connectionListenerRegistered = true;
    this.log('Connection listener registered');
  }

  private handleConnectionStateChange(state: HRConnectionState, msg: string): void {
    if (this._state !== BLEUIState.CONNECTING) return;

    if (state === HRConnectionState.CONNECTED) {
      this.log('Connected successfully');
      this.connectionRetries = 0;
      this.setState(BLEUIState.CONNECTED);
      if (this.onCompleteCallback) {
        this.onCompleteCallback(true);
      }
    } else if (state === HRConnectionState.ERROR) {
      this.connectionRetries++;
      this.log('Connection failed (attempt ' + this.connectionRetries + '/' + this.MAX_RETRIES + '): ' + msg);

      if (this.connectionRetries >= this.MAX_RETRIES) {
        this.log('Max retries reached - skipping HR');
        // Auto-skip after max retries
        this.onSkipPressed();
        return;
      } else {
        // Go back to device list for retry
        this.setState(BLEUIState.DEVICE_LIST);
      }
    }
  }

  private onSkipPressed(): void {
    this.log('User pressed SKIP - continuing without HR');
    this.skipBLEConnection();
  }

  private onCancelPressed(): void {
    this.log('User pressed CANCEL - continuing without HR');
    this.skipBLEConnection();
  }

  /**
   * Back to the question.
   *
   * The scan is stopped on the way: a scan still running behind the prompt
   * would finish later and move the panel underneath whoever is reading it.
   */
  private onBackPressed(): void {
    this.log('User pressed BACK - returning to the prompt');

    if (this.heartRateTracker) this.heartRateTracker.stopScan();
    this.setState(BLEUIState.PROMPT);
  }

  private skipBLEConnection(): void {
    // Disable HR HUD
    if (this.heartRateHUD) {
      this.heartRateHUD.enabled = false;
    }

    this.setState(BLEUIState.DISABLED);

    if (this.onCompleteCallback) {
      this.onCompleteCallback(false);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  show(onComplete: (connected: boolean) => void): void {
    this.log('Showing BLE connection dialog');
    this.onCompleteCallback = onComplete;
    this.setState(BLEUIState.PROMPT);
  }

  hide(): void {
    this.setState(BLEUIState.HIDDEN);
  }

  get state(): BLEUIState {
    return this._state;
  }

  // ── State Management ────────────────────────────────────────────────────────

  private setState(state: BLEUIState): void {
    this._state = state;
    this.log('State: ' + state);
    this.hideAll();

    switch (state) {
      case BLEUIState.PROMPT:
        if (this.frame) this.frame.enabled = true;
        if (this.promptPanel) this.promptPanel.enabled = true;
        break;

      case BLEUIState.SCANNING:
        if (this.scanningPanel) {
          this.scanningPanel.enabled = true;
          if (this.scanningText) {
            this.scanningText.text = 'Scanning for HR monitors...';
          }
        }
        // A scan can take a while and can find nothing. Either way there is
        // a way out of it from the moment it starts.
        this.setButtonVisible(this.backButton, true);
        break;

      case BLEUIState.DEVICE_LIST:
        if (this.deviceListPanel) {
          this.deviceListPanel.enabled = true;
          this.populateDeviceList();
        }
        this.setButtonVisible(this.backButton, true);
        // Rescan and Cancel buttons are outside DeviceListPanel, enable separately
        if (this.rescanButton) {
          this.rescanButton.getSceneObject().enabled = true;
        }
        if (this.cancelButton) {
          this.cancelButton.getSceneObject().enabled = true;
        }
        break;

      case BLEUIState.CONNECTING:
        if (this.scanningPanel) {
          this.scanningPanel.enabled = true;
          if (this.scanningText) {
            this.scanningText.text = 'Connecting...';
          }
        }
        break;

      case BLEUIState.CONNECTED:
      case BLEUIState.DISABLED:
      case BLEUIState.HIDDEN:
        // All panels hidden, frame disabled
        if (this.frame) this.frame.enabled = false;
        break;
    }
  }

  private hideAll(): void {
    if (this.promptPanel) this.promptPanel.enabled = false;
    if (this.scanningPanel) this.scanningPanel.enabled = false;
    if (this.deviceListPanel) this.deviceListPanel.enabled = false;

    // Rescan, Cancel and Back live outside the panels they belong to
    this.setButtonVisible(this.rescanButton, false);
    this.setButtonVisible(this.cancelButton, false);
    this.setButtonVisible(this.backButton, false);
  }

  private setButtonVisible(button: ScriptComponent, visible: boolean): void {
    if (!button) return;

    var object = button.getSceneObject();
    if (object) object.enabled = visible;
  }

  /** True when the athlete has some way off this screen other than finishing it */
  private hasWayOut(): boolean {
    return !!(this.backButton || this.rescanButton || this.cancelButton);
  }

  // ── Button Handlers ─────────────────────────────────────────────────────────

  private onYesPressed(): void {
    this.log('User pressed YES - starting scan');
    this.startScanning();
  }

  private onNoPressed(): void {
    this.log('User pressed NO - disabling HR');
    this.skipBLEConnection();
  }

  // ── Scanning ────────────────────────────────────────────────────────────────

  private startScanning(): void {
    this.setState(BLEUIState.SCANNING);
    this.connectionRetries = 0;  // Reset retry counter

    // Set callback for when scan completes
    this.heartRateTracker.setScanCompleteCallback(() => {
      this.onScanComplete();
    });

    // Start the scan
    this.heartRateTracker.startScan();
  }

  private onScanComplete(): void {
    var devices = this.heartRateTracker.getFoundDevices();
    this.log('Scan complete. Found ' + devices.length + ' devices');

    if (devices.length === 0) {
      // Nothing found, and nothing wired to leave by. Back to the question,
      // which is the one screen whose buttons are not optional - rather than
      // leaving somebody in front of "No HR monitors found." with no way on.
      if (!this.hasWayOut()) {
        this.log('WARNING: no back, rescan or cancel button wired — ' +
                 'returning to the prompt so the athlete is not stranded');
        this.setState(BLEUIState.PROMPT);
        return;
      }

      // No devices found - show scanning panel with rescan/cancel buttons
      this.setState(BLEUIState.SCANNING);
      if (this.scanningText) {
        this.scanningText.text = 'No HR monitors found.';
      }

      this.setButtonVisible(this.rescanButton, true);
      this.setButtonVisible(this.cancelButton, true);
      this.setButtonVisible(this.backButton, true);
    } else {
      this.setState(BLEUIState.DEVICE_LIST);
    }
  }

  // ── Device List ─────────────────────────────────────────────────────────────

  private populateDeviceList(): void {
    this.clearDeviceButtons();

    var devices = this.heartRateTracker.getFoundDevices();
    this.log('Populating device list: ' + devices.length + ' devices');

    if (!this.deviceButtonPrefab || !this.deviceButtonsContainer) {
      this.log('WARNING: deviceButtonPrefab or deviceButtonsContainer not set');
      // Fallback: if no prefab, auto-connect to first device
      if (devices.length > 0) {
        this.onDeviceSelected(devices[0].address);
      }
      return;
    }

    var buttonStartY = 6.0;   // Starting Y position (adjust to match your layout)
    var buttonSpacing = 4.0;  // cm between buttons

    for (var i = 0; i < devices.length; i++) {
      var device = devices[i];
      var btn = this.deviceButtonPrefab.instantiate(this.deviceButtonsContainer);
      btn.enabled = true;

      // Position button vertically (stack downward from startY)
      var transform = btn.getTransform();
      var localPos = transform.getLocalPosition();
      transform.setLocalPosition(new vec3(localPos.x, buttonStartY - (i * buttonSpacing), localPos.z));

      // Truncate long device names
      var displayName = this.truncateName(device.name, 12);

      // Set button text if Text component exists
      var textComp = btn.getComponent('Text') as Text;
      if (textComp) {
        textComp.text = displayName;
      }

      // Look for text in children
      for (var c = 0; c < btn.getChildrenCount(); c++) {
        var child = btn.getChild(c);
        var childText = child.getComponent('Text') as Text;
        if (childText) {
          childText.text = displayName;
          break;
        }
      }

      // Set button callback (use helper to avoid closure bug with var)
      var buttonComp = btn.getComponent('ScriptComponent') as any;
      if (buttonComp && buttonComp.onTriggerUp) {
        this.bindDeviceButton(buttonComp, device.address);
      }

      this.deviceButtons.push(btn);
    }
  }

  private clearDeviceButtons(): void {
    for (var i = 0; i < this.deviceButtons.length; i++) {
      var btn = this.deviceButtons[i];
      if (!isNull(btn)) {
        // Disable before destroy to prevent hover callbacks
        btn.enabled = false;
        btn.destroy();
      }
    }
    this.deviceButtons = [];
  }

  private onDeviceSelected(address: Uint8Array): void {
    this.log('Device selected');
    this.setState(BLEUIState.CONNECTING);

    // Connection state is handled by handleConnectionStateChange (registered once)
    // Initiate connection
    this.heartRateTracker.connectToDeviceByAddress(address);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Bind device button callback - avoids closure bug with var in loop */
  private bindDeviceButton(buttonComp: any, address: Uint8Array): void {
    buttonComp.onTriggerUp.add(() => this.onDeviceSelected(address));
  }

  private truncateName(name: string, maxLen: number): string {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 2) + '..';
  }

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[BLEConnectionUI] ' + msg);
    }
  }
}
