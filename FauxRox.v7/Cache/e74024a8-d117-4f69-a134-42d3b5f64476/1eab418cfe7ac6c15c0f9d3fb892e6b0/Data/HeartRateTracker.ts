// ============================================================================
// HeartRateTracker.ts — BLE Heart Rate Monitor Integration
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Based on working BLE Playground pattern
// ============================================================================

const HR_SERVICE_UUID = "0x180D";
const HR_CHAR_UUID = "0x2A37";

export enum HRConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export enum HRZone {
  ZONE_1 = 1,
  ZONE_2 = 2,
  ZONE_3 = 3,
  ZONE_4 = 4,
  ZONE_5 = 5,
}

@component
export class HeartRateTracker extends BaseScriptComponent {

  @input bluetoothModule: Bluetooth.BluetoothCentralModule;
  @input maxHeartRate: number = 190;
  @input scanTimeout: number = 30;
  @input debugPrint: boolean = true;

  // BLE scan objects - initialized in onAwake
  private scanFilter: Bluetooth.ScanFilter = null;
  private scanSettings: Bluetooth.ScanSettings = null;

  private bluetoothGatt: Bluetooth.BluetoothGatt = null;
  private hrService: Bluetooth.BluetoothGattService = null;
  private hrCharacteristic: Bluetooth.BluetoothGattCharacteristic = null;

  private _connectionState: HRConnectionState = HRConnectionState.DISCONNECTED;
  private _currentBPM: number = 0;
  private _currentZone: HRZone = HRZone.ZONE_1;
  private _deviceName: string = '';
  private _isScanning: boolean = false;

  private _sessionStartTime: number = 0;
  private _bpmReadings: number[] = [];
  private _peakBPM: number = 0;
  private _avgBPM: number = 0;

  private onBPMUpdateCallback: (bpm: number, zone: HRZone) => void = null;
  private onConnectionStateChangeCallback: (state: HRConnectionState, message: string) => void = null;

  // Simulated HR for editor
  private simulatedBPM: number = 75;

  get connectionState(): HRConnectionState { return this._connectionState; }
  get currentBPM(): number { return this._currentBPM; }
  get currentZone(): HRZone { return this._currentZone; }
  get deviceName(): string { return this._deviceName; }
  get peakBPM(): number { return this._peakBPM; }
  get avgBPM(): number { return this._avgBPM; }
  get isConnected(): boolean { return this._connectionState === HRConnectionState.CONNECTED; }

  onAwake(): void {
    // Create scan objects in onAwake (not as class property initializers)
    this.createEvent('OnStartEvent').bind(() => {
      this.initBLE();
    });
  }

  private initBLE(): void {
    try {
      this.scanFilter = new Bluetooth.ScanFilter();
      this.scanSettings = new Bluetooth.ScanSettings();
      this.scanSettings.uniqueDevices = true;
      this.scanSettings.timeoutSeconds = this.scanTimeout;
      this.log('BLE initialized');
      this.setConnectionState(HRConnectionState.DISCONNECTED, 'Ready');
    } catch (e) {
      this.log('BLE init error: ' + e);
      this.setConnectionState(HRConnectionState.ERROR, 'BLE init failed');
    }
  }

  startScan(): void {
    if (this._isScanning) {
      this.log('Already scanning');
      return;
    }

    // Editor mode - simulate
    if (global.deviceInfoSystem.isEditor()) {
      this.log('Editor mode - simulating HR');
      this.setConnectionState(HRConnectionState.CONNECTED, 'Simulated');
      this._deviceName = 'Simulated HR';
      this.startSimulatedHR();
      return;
    }

    if (!this.bluetoothModule) {
      this.log('ERROR: Bluetooth module not linked');
      this.setConnectionState(HRConnectionState.ERROR, 'No Bluetooth');
      return;
    }

    if (!this.scanFilter || !this.scanSettings) {
      this.log('BLE not initialized yet, initializing...');
      this.initBLE();
      if (!this.scanFilter) {
        this.setConnectionState(HRConnectionState.ERROR, 'BLE init failed');
        return;
      }
    }

    this._isScanning = true;
    this.setConnectionState(HRConnectionState.SCANNING, 'Scanning...');
    this.log('Starting BLE scan...');

    this.bluetoothModule
      .startScan(
        [this.scanFilter],
        this.scanSettings,
        (result: Bluetooth.ScanResult) => this.onScanResult(result)
      )
      .then((result: Bluetooth.ScanResult) => {
        this.log('Scan completed: ' + (result ? result.deviceName : 'none'));
        this._isScanning = false;
      })
      .catch((error: string) => {
        this.log('Scan ended: ' + error);
        this._isScanning = false;
        if (this._connectionState !== HRConnectionState.CONNECTED) {
          this.setConnectionState(HRConnectionState.ERROR, 'No device found');
        }
      });
  }

  stopScan(): void {
    if (this._isScanning && this.bluetoothModule) {
      this.bluetoothModule.stopScan();
      this._isScanning = false;
      this.setConnectionState(HRConnectionState.DISCONNECTED, 'Scan stopped');
    }
  }

  private onScanResult(result: Bluetooth.ScanResult): boolean {
    if (!result) return false;

    var name = result.deviceName || '';
    this.log('Found: ' + name);

    // Check if HR device
    var upper = name.toUpperCase();
    var isHR = upper.indexOf('ECHO') >= 0 ||
               upper.indexOf('HEART') >= 0 ||
               upper.indexOf('HR') >= 0 ||
               upper.indexOf('POLAR') >= 0 ||
               upper.indexOf('GARMIN') >= 0 ||
               upper.indexOf('WAHOO') >= 0;

    if (isHR || name.length > 0) {
      // Try connecting to any named device (HR service will validate)
      this.log('Connecting to: ' + name);
      this._deviceName = name;
      this.connectToDevice(result);
      return true;
    }

    return false;
  }

  private connectToDevice(result: Bluetooth.ScanResult): void {
    this.setConnectionState(HRConnectionState.CONNECTING, 'Connecting...');

    this.bluetoothModule
      .connectGatt(result.deviceAddress)
      .then((gatt: Bluetooth.BluetoothGatt) => {
        this.bluetoothGatt = gatt;
        this.log('GATT connected');
        this.setupHRService();
      })
      .catch((error: string) => {
        this.log('Connection error: ' + error);
        this.setConnectionState(HRConnectionState.ERROR, 'Connection failed');
      });
  }

  private setupHRService(): void {
    try {
      this.hrService = this.bluetoothGatt.getService(HR_SERVICE_UUID);
      if (!this.hrService) {
        this.log('HR service not found on device');
        this.setConnectionState(HRConnectionState.ERROR, 'Not HR device');
        return;
      }

      this.hrCharacteristic = this.hrService.getCharacteristic(HR_CHAR_UUID);
      if (!this.hrCharacteristic) {
        this.log('HR characteristic not found');
        this.setConnectionState(HRConnectionState.ERROR, 'HR char missing');
        return;
      }

      this.log('HR service found, registering notifications...');
      this.registerNotifications();
    } catch (e) {
      this.log('ERROR: ' + e);
      this.setConnectionState(HRConnectionState.ERROR, 'Service error');
    }
  }

  private registerNotifications(): void {
    this.hrCharacteristic
      .registerNotifications((val: Uint8Array) => this.onHRNotification(val))
      .then(() => {
        this.log('HR notifications registered');
        this.setConnectionState(HRConnectionState.CONNECTED, this._deviceName);
      })
      .catch((error: string) => {
        this.log('Notification error: ' + error);
        this.setConnectionState(HRConnectionState.ERROR, 'Notification failed');
      });
  }

  private onHRNotification(val: Uint8Array): void {
    if (!val || val.length < 2) return;

    var flags = val[0];
    var bpm: number;

    if ((flags & 0x01) === 0) {
      bpm = val[1];
    } else {
      bpm = val[1] | (val[2] << 8);
    }

    if (bpm < 30 || bpm > 220) return;

    this.processBPM(bpm);
  }

  private processBPM(bpm: number): void {
    this._currentBPM = bpm;
    this._currentZone = this.calculateZone(bpm);

    if (this._sessionStartTime > 0) {
      this._bpmReadings.push(bpm);
      if (bpm > this._peakBPM) this._peakBPM = bpm;
      this.calculateAvg();
    }

    if (this.onBPMUpdateCallback) {
      this.onBPMUpdateCallback(bpm, this._currentZone);
    }
  }

  private calculateZone(bpm: number): HRZone {
    var pct = (bpm / this.maxHeartRate) * 100;
    if (pct < 60) return HRZone.ZONE_1;
    if (pct < 70) return HRZone.ZONE_2;
    if (pct < 80) return HRZone.ZONE_3;
    if (pct < 90) return HRZone.ZONE_4;
    return HRZone.ZONE_5;
  }

  private calculateAvg(): void {
    if (this._bpmReadings.length === 0) return;
    var sum = 0;
    for (var i = 0; i < this._bpmReadings.length; i++) {
      sum += this._bpmReadings[i];
    }
    this._avgBPM = Math.round(sum / this._bpmReadings.length);
  }

  // Simulated HR for editor
  private startSimulatedHR(): void {
    this.createEvent('UpdateEvent').bind(() => {
      this.simulatedBPM += (Math.random() - 0.4) * 2;
      if (this.simulatedBPM > 170) this.simulatedBPM = 170;
      if (this.simulatedBPM < 60) this.simulatedBPM = 60;
      this.processBPM(Math.round(this.simulatedBPM));
    });
  }

  // Public API
  startSession(): void {
    this._sessionStartTime = getTime();
    this._bpmReadings = [];
    this._peakBPM = 0;
    this._avgBPM = 0;
  }

  endSession(): { avgBPM: number, peakBPM: number } {
    return { avgBPM: this._avgBPM, peakBPM: this._peakBPM };
  }

  onBPMUpdate(callback: (bpm: number, zone: HRZone) => void): void {
    this.onBPMUpdateCallback = callback;
  }

  onConnectionStateChange(callback: (state: HRConnectionState, message: string) => void): void {
    this.onConnectionStateChangeCallback = callback;
    callback(this._connectionState, '');
  }

  getZoneName(zone: HRZone): string {
    switch (zone) {
      case HRZone.ZONE_1: return 'WARM UP';
      case HRZone.ZONE_2: return 'FAT BURN';
      case HRZone.ZONE_3: return 'CARDIO';
      case HRZone.ZONE_4: return 'THRESHOLD';
      case HRZone.ZONE_5: return 'PEAK';
      default: return '';
    }
  }

  private setConnectionState(state: HRConnectionState, message: string): void {
    this._connectionState = state;
    this.log('State: ' + state + ' - ' + message);
    if (this.onConnectionStateChangeCallback) {
      this.onConnectionStateChangeCallback(state, message);
    }
  }

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[HeartRateTracker] ' + msg);
    }
  }
}
