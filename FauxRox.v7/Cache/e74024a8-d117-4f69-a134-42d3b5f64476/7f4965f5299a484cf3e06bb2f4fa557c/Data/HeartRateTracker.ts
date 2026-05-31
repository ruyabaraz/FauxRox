// ============================================================================
// HeartRateTracker.ts — BLE Heart Rate Monitor Integration
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Connects to any Bluetooth LE Heart Rate Monitor (Decathlon, Polar, Garmin, etc.)
// Uses standard Bluetooth Heart Rate Service (0x180D)
// ============================================================================

// Standard Bluetooth Heart Rate Service UUIDs
const HR_SERVICE_UUID = "0x180D";
const HR_CHARACTERISTIC_UUID = "0x2A37";

// Connection states
export enum HRConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

// HR Zones based on max heart rate
export enum HRZone {
  ZONE_1 = 1,  // 50-60% - Very light (warm up)
  ZONE_2 = 2,  // 60-70% - Light (fat burn)
  ZONE_3 = 3,  // 70-80% - Moderate (cardio)
  ZONE_4 = 4,  // 80-90% - Hard (threshold)
  ZONE_5 = 5,  // 90-100% - Maximum (peak)
}

@component
export class HeartRateTracker extends BaseScriptComponent {

  // ── Settings ───────────────────────────────────────────────────────────────

  /** Bluetooth Central Module - link from Resources in Lens Studio */
  @input bluetoothModule: Bluetooth.BluetoothCentralModule;

  /** Maximum heart rate for zone calculation (220 - age) */
  @input maxHeartRate: number = 190;

  /** Scan timeout in seconds */
  @input scanTimeout: number = 15;

  /** Auto-connect to first HR monitor found */
  @input autoConnect: boolean = true;

  /** Target device name to search for (leave empty for any HR device) */
  @input targetDeviceName: string = '';

  /** Enable debug logging */
  @input debugPrint: boolean = true;
  private bluetoothGatt: Bluetooth.BluetoothGatt = null;
  private hrService: Bluetooth.BluetoothGattService = null;
  private hrCharacteristic: Bluetooth.BluetoothGattCharacteristic = null;

  private _connectionState: HRConnectionState = HRConnectionState.DISCONNECTED;
  private _currentBPM: number = 0;
  private _currentZone: HRZone = HRZone.ZONE_1;
  private _deviceName: string = '';

  // Stats tracking
  private _sessionStartTime: number = 0;
  private _bpmReadings: number[] = [];
  private _peakBPM: number = 0;
  private _avgBPM: number = 0;

  // Callbacks
  private onBPMUpdateCallback: (bpm: number, zone: HRZone) => void = null;
  private onConnectionStateChangeCallback: (state: HRConnectionState, message: string) => void = null;

  // ── Public Getters ─────────────────────────────────────────────────────────

  get connectionState(): HRConnectionState { return this._connectionState; }
  get currentBPM(): number { return this._currentBPM; }
  get currentZone(): HRZone { return this._currentZone; }
  get deviceName(): string { return this._deviceName; }
  get peakBPM(): number { return this._peakBPM; }
  get avgBPM(): number { return this._avgBPM; }
  get isConnected(): boolean { return this._connectionState === HRConnectionState.CONNECTED; }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.bluetoothModule) {
      this.log('ERROR: BluetoothCentralModule not linked in Inspector');
      this.setConnectionState(HRConnectionState.ERROR, 'Bluetooth not configured');
      return;
    }
    this.log('Bluetooth module initialized');
    this.setConnectionState(HRConnectionState.DISCONNECTED, 'Ready to scan');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start scanning for HR monitors
   */
  startScan(): void {
    if (!this.bluetoothModule) {
      this.log('ERROR: Bluetooth module not available');
      this.setConnectionState(HRConnectionState.ERROR, 'Bluetooth not available');
      return;
    }

    if (this._connectionState === HRConnectionState.SCANNING) {
      this.log('Already scanning');
      return;
    }

    // Editor mode - simulate connection
    if (global.deviceInfoSystem.isEditor()) {
      this.log('Editor mode - simulating HR connection');
      this.setConnectionState(HRConnectionState.SCANNING, 'Scanning...');

      // Simulate finding device after 1 second
      var delayEvent = this.createEvent('DelayedCallbackEvent');
      delayEvent.bind(() => {
        this._deviceName = 'Simulated HR Monitor';
        this.setConnectionState(HRConnectionState.CONNECTED, 'Connected (Simulated)');
        this.startSimulatedHR();
      });
      (delayEvent as DelayedCallbackEvent).reset(1.0);
      return;
    }

    this.setConnectionState(HRConnectionState.SCANNING, 'Scanning for HR monitors...');
    this.log('Starting BLE scan...');

    // TEMPORARY: Use simulated HR on device until BLE issue is resolved
    // Spectacles BLE API seems to have issues with ScanFilter constructor
    this.log('Using simulated HR (BLE disabled for debugging)');
    this._deviceName = 'Simulated HR';
    this.setConnectionState(HRConnectionState.CONNECTED, 'Simulated Mode');
    this.startSimulatedHR();
    return;

    /* BLE CODE DISABLED - ScanFilter constructor not available on device
    // Create scan filter and settings
    var filter: Bluetooth.ScanFilter;
    var settings: Bluetooth.ScanSettings;

    try {
      filter = new Bluetooth.ScanFilter();
      // NO serviceUUID filter - scan for all devices

      settings = new Bluetooth.ScanSettings();
      settings.uniqueDevices = true;
      settings.timeoutSeconds = this.scanTimeout;

      this.log('Scan objects created, starting scan...');
    } catch (e) {
      this.log('ERROR creating scan objects: ' + e);
      this.setConnectionState(HRConnectionState.ERROR, 'BLE init failed: ' + e);
      return;
    }

    this.bluetoothModule.startScan(
      [filter],
      settings,
      (result: Bluetooth.ScanResult) => this.onScanResult(result)
    )
    .then((result: Bluetooth.ScanResult) => {
      // Scan stopped via predicate returning true
      this.log('Scan completed with result: ' + (result ? result.deviceName : 'none'));
    })
    .catch((error: string) => {
      if (this._connectionState === HRConnectionState.CONNECTED) {
        // Already connected, ignore scan timeout
        return;
      }
      this.log('Scan error/timeout: ' + error);
      this.setConnectionState(HRConnectionState.ERROR, 'No HR monitor found');
    END OF BLE CODE */
    });
  }

  /**
   * Stop scanning
   */
  stopScan(): void {
    if (this.bluetoothModule && this._connectionState === HRConnectionState.SCANNING) {
      this.bluetoothModule.stopScan();
      this.setConnectionState(HRConnectionState.DISCONNECTED, 'Scan stopped');
    }
  }

  /**
   * Disconnect from current device
   */
  disconnect(): void {
    if (this.bluetoothGatt) {
      // Note: There's no explicit disconnect method in the API
      // Setting to null and letting GC handle it
      this.bluetoothGatt = null;
      this.hrService = null;
      this.hrCharacteristic = null;
    }
    this._deviceName = '';
    this._currentBPM = 0;
    this.setConnectionState(HRConnectionState.DISCONNECTED, 'Disconnected');
    this.log('Disconnected');
  }

  /**
   * Start tracking HR session (resets stats)
   */
  startSession(): void {
    this._sessionStartTime = getTime();
    this._bpmReadings = [];
    this._peakBPM = 0;
    this._avgBPM = 0;
    this.log('HR session started');
  }

  /**
   * End tracking session and calculate final stats
   */
  endSession(): { avgBPM: number, peakBPM: number, readings: number[] } {
    this.calculateStats();
    this.log('HR session ended. Avg: ' + this._avgBPM + ' Peak: ' + this._peakBPM);
    return {
      avgBPM: this._avgBPM,
      peakBPM: this._peakBPM,
      readings: this._bpmReadings.slice()
    };
  }

  /**
   * Set callback for BPM updates
   */
  onBPMUpdate(callback: (bpm: number, zone: HRZone) => void): void {
    this.onBPMUpdateCallback = callback;
  }

  /**
   * Set callback for connection state changes
   */
  onConnectionStateChange(callback: (state: HRConnectionState, message: string) => void): void {
    this.onConnectionStateChangeCallback = callback;
    // Immediately call with current state
    if (callback) {
      callback(this._connectionState, this.getStateMessage());
    }
  }

  /**
   * Get zone name for display
   */
  getZoneName(zone: HRZone): string {
    switch (zone) {
      case HRZone.ZONE_1: return 'WARM UP';
      case HRZone.ZONE_2: return 'FAT BURN';
      case HRZone.ZONE_3: return 'CARDIO';
      case HRZone.ZONE_4: return 'THRESHOLD';
      case HRZone.ZONE_5: return 'PEAK';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Get zone color for display (returns vec4 RGBA)
   */
  getZoneColor(zone: HRZone): vec4 {
    switch (zone) {
      case HRZone.ZONE_1: return new vec4(0.5, 0.5, 0.5, 1);  // Gray
      case HRZone.ZONE_2: return new vec4(0.2, 0.6, 1, 1);    // Blue
      case HRZone.ZONE_3: return new vec4(0.2, 0.8, 0.2, 1);  // Green
      case HRZone.ZONE_4: return new vec4(1, 0.8, 0, 1);      // Yellow/Orange
      case HRZone.ZONE_5: return new vec4(1, 0.2, 0.2, 1);    // Red
      default: return new vec4(1, 1, 1, 1);
    }
  }

  // ── Scan & Connection ─────────────────────────────────────────────────────

  private onScanResult(result: Bluetooth.ScanResult): boolean {
    // Log ALL scan results for debugging
    var name = result ? (result.deviceName || '(no name)') : '(null)';
    this.log('SCAN: ' + name);

    if (!result) {
      return false; // Continue scanning
    }

    var deviceName = result.deviceName || '';
    var upperName = deviceName.toUpperCase();

    // If targetDeviceName is set, only connect to that specific device
    if (this.targetDeviceName && this.targetDeviceName.length > 0) {
      var targetUpper = this.targetDeviceName.toUpperCase();
      if (upperName.indexOf(targetUpper) >= 0) {
        this.log('Target device found! Connecting to: ' + deviceName);
        this._deviceName = deviceName;
        this.connectToDevice(result);
        return true; // Stop scanning
      }
      return false; // Continue scanning for target
    }

    // Otherwise, look for any HR-related device
    var isHRDevice = upperName.indexOf('ECHO') >= 0 ||
                     upperName.indexOf('HEART') >= 0 ||
                     upperName.indexOf('HR') >= 0 ||
                     upperName.indexOf('POLAR') >= 0 ||
                     upperName.indexOf('GARMIN') >= 0 ||
                     upperName.indexOf('WAHOO') >= 0 ||
                     upperName.indexOf('DECATHLON') >= 0;

    if (isHRDevice && this.autoConnect) {
      this.log('HR device found! Connecting to: ' + deviceName);
      this._deviceName = deviceName;
      this.connectToDevice(result);
      return true; // Stop scanning
    }

    return false; // Continue scanning
  }

  private connectToDevice(scanResult: Bluetooth.ScanResult): void {
    this.setConnectionState(HRConnectionState.CONNECTING, 'Connecting to ' + scanResult.deviceName + '...');
    this.log('Connecting to: ' + scanResult.deviceName);

    this.bluetoothModule.connectGatt(scanResult.deviceAddress)
      .then((gatt: Bluetooth.BluetoothGatt) => {
        this.bluetoothGatt = gatt;
        this.onGattConnected();
      })
      .catch((error: string) => {
        this.log('Connection error: ' + error);
        this.setConnectionState(HRConnectionState.ERROR, 'Connection failed');
      });
  }

  private onGattConnected(): void {
    if (!this.bluetoothGatt) {
      this.setConnectionState(HRConnectionState.ERROR, 'GATT connection lost');
      return;
    }

    // Monitor connection state
    this.bluetoothGatt.onConnectionStateChangedEvent.add((event: Bluetooth.ConnectionStateChangedEvent) => {
      if (event.state === Bluetooth.ConnectionState.Disconnected) {
        this.log('Device disconnected');
        this.setConnectionState(HRConnectionState.DISCONNECTED, 'Device disconnected');
      }
    });

    // Get HR service
    try {
      this.hrService = this.bluetoothGatt.getService(HR_SERVICE_UUID);
      if (!this.hrService) {
        this.setConnectionState(HRConnectionState.ERROR, 'HR service not found');
        return;
      }

      // Get HR characteristic
      this.hrCharacteristic = this.hrService.getCharacteristic(HR_CHARACTERISTIC_UUID);
      if (!this.hrCharacteristic) {
        this.setConnectionState(HRConnectionState.ERROR, 'HR characteristic not found');
        return;
      }

      // Register for notifications
      this.registerHRNotifications();

    } catch (e) {
      this.log('ERROR getting HR service: ' + e);
      this.setConnectionState(HRConnectionState.ERROR, 'Service discovery failed');
    }
  }

  private registerHRNotifications(): void {
    this.hrCharacteristic.registerNotifications((value: Uint8Array) => {
      this.onHRNotification(value);
    })
    .then(() => {
      this.log('HR notifications registered');
      this.setConnectionState(HRConnectionState.CONNECTED, 'Connected to ' + this._deviceName);
    })
    .catch((error: string) => {
      this.log('ERROR registering HR notifications: ' + error);
      this.setConnectionState(HRConnectionState.ERROR, 'Notification registration failed');
    });
  }

  private onHRNotification(value: Uint8Array): void {
    if (!value || value.length < 2) {
      return;
    }

    // Parse heart rate value
    // First byte is flags, second byte (or two bytes if flag set) is HR value
    var flags = value[0];
    var bpm: number;

    if ((flags & 0x01) === 0) {
      // 8-bit HR value
      bpm = value[1];
    } else {
      // 16-bit HR value
      bpm = value[1] | (value[2] << 8);
    }

    // Validate BPM (reasonable range: 30-220)
    if (bpm < 30 || bpm > 220) {
      return;
    }

    this._currentBPM = bpm;
    this._currentZone = this.calculateZone(bpm);

    // Track for stats
    if (this._sessionStartTime > 0) {
      this._bpmReadings.push(bpm);
      if (bpm > this._peakBPM) {
        this._peakBPM = bpm;
      }
      this.calculateStats();
    }

    // Notify callback
    if (this.onBPMUpdateCallback) {
      this.onBPMUpdateCallback(this._currentBPM, this._currentZone);
    }
  }

  // ── Zone Calculation ──────────────────────────────────────────────────────

  private calculateZone(bpm: number): HRZone {
    var pct = (bpm / this.maxHeartRate) * 100;

    if (pct < 60) return HRZone.ZONE_1;
    if (pct < 70) return HRZone.ZONE_2;
    if (pct < 80) return HRZone.ZONE_3;
    if (pct < 90) return HRZone.ZONE_4;
    return HRZone.ZONE_5;
  }

  private calculateStats(): void {
    if (this._bpmReadings.length === 0) {
      this._avgBPM = 0;
      return;
    }

    var sum = 0;
    for (var i = 0; i < this._bpmReadings.length; i++) {
      sum += this._bpmReadings[i];
    }
    this._avgBPM = Math.round(sum / this._bpmReadings.length);
  }

  // ── Simulated HR (Editor Mode) ────────────────────────────────────────────

  private simulatedHREvent: SceneEvent = null;
  private simulatedBPM: number = 75;
  private simulatedDirection: number = 1;

  private startSimulatedHR(): void {
    this.simulatedHREvent = this.createEvent('UpdateEvent');
    this.simulatedHREvent.bind(() => this.updateSimulatedHR());
    this.log('Started simulated HR');
  }

  private updateSimulatedHR(): void {
    // Simulate realistic HR changes
    var change = (Math.random() - 0.3) * 3;  // Slight upward bias
    this.simulatedBPM += change;

    // Keep in reasonable range
    if (this.simulatedBPM > 180) {
      this.simulatedBPM = 180;
    } else if (this.simulatedBPM < 60) {
      this.simulatedBPM = 60;
    }

    var bpm = Math.round(this.simulatedBPM);
    this._currentBPM = bpm;
    this._currentZone = this.calculateZone(bpm);

    // Track for stats
    if (this._sessionStartTime > 0) {
      this._bpmReadings.push(bpm);
      if (bpm > this._peakBPM) {
        this._peakBPM = bpm;
      }
      this.calculateStats();
    }

    // Notify callback
    if (this.onBPMUpdateCallback) {
      this.onBPMUpdateCallback(this._currentBPM, this._currentZone);
    }
  }

  // ── State Management ──────────────────────────────────────────────────────

  private setConnectionState(state: HRConnectionState, message: string): void {
    var changed = this._connectionState !== state;
    this._connectionState = state;

    if (changed) {
      this.log('State: ' + state + ' - ' + message);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(state, message);
      }
    }
  }

  private getStateMessage(): string {
    switch (this._connectionState) {
      case HRConnectionState.DISCONNECTED: return 'Disconnected';
      case HRConnectionState.SCANNING: return 'Scanning...';
      case HRConnectionState.CONNECTING: return 'Connecting...';
      case HRConnectionState.CONNECTED: return 'Connected to ' + this._deviceName;
      case HRConnectionState.ERROR: return 'Error';
      default: return 'Unknown';
    }
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[HeartRateTracker] ' + msg);
    }
  }
}
