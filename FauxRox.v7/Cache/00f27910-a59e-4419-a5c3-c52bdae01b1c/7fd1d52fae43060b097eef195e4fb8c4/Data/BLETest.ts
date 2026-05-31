// Minimal BLE test - exact copy of BLE Arduino pattern

@component
export class BLETest extends BaseScriptComponent {
  @input bluetoothModule: Bluetooth.BluetoothCentralModule

  private scanFilter = new Bluetooth.ScanFilter()
  private scanSettings = new Bluetooth.ScanSettings()

  onAwake() {
    print("[BLETest] onAwake - scanFilter created: " + this.scanFilter)
    print("[BLETest] onAwake - scanSettings created: " + this.scanSettings)

    this.scanSettings.uniqueDevices = true
    this.scanSettings.timeoutSeconds = 30

    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart() {
    print("[BLETest] onStart - starting scan...")

    if (!this.bluetoothModule) {
      print("[BLETest] ERROR: bluetoothModule not linked")
      return
    }

    this.bluetoothModule
      .startScan([this.scanFilter], this.scanSettings, (result: Bluetooth.ScanResult) => {
        print("[BLETest] Found: " + (result?.deviceName || "(no name)"))
        return false  // Continue scanning
      })
      .then((result) => {
        print("[BLETest] Scan completed")
      })
      .catch((error) => {
        print("[BLETest] Scan error: " + error)
      })
  }
}
