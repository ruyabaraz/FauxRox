require("LensStudio:RawLocationModule")

// ============================================================================
// LocationTracker.ts — HYROX MIRAGE GPS Distance Tracking
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Uses GeoLocation API for outdoor distance tracking
// Calculates distance using Haversine formula for GPS coordinates
// ============================================================================

@component
export class LocationTracker extends BaseScriptComponent {

  // ── Settings ───────────────────────────────────────────────────────────────

  /** Minimum distance change (meters) to register movement */
  @input minMovementThreshold: number = 1.0;

  /** Update interval in seconds */
  @input updateInterval: number = 0.5;

  /** Enable debug logging */
  @input debugPrint: boolean = true;

  // ── GPS Status ─────────────────────────────────────────────────────────────

  /** GPS connection status */
  static readonly GPS_STATUS = {
    CHECKING: 'CHECKING',
    CONNECTED: 'CONNECTED',
    NOT_AVAILABLE: 'NOT_AVAILABLE',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
  } as const;

  // ── State ──────────────────────────────────────────────────────────────────

  private locationService: LocationService = null;
  private isTracking: boolean = false;
  private totalDistance: number = 0;           // meters
  private lastPosition: GeoPosition = null;
  private updateEvent: SceneEvent = null;
  private lastUpdateTime: number = 0;

  // Current location
  private currentLat: number = 0;
  private currentLon: number = 0;
  private currentAlt: number = 0;
  private hasLocation: boolean = false;

  // GPS Status
  private _gpsStatus: string = 'CHECKING';
  private _gpsStatusMessage: string = 'Checking GPS...';
  private _gpsCheckTimeout: number = 10.0;  // seconds
  private _gpsCheckStartTime: number = 0;
  private _consecutiveErrors: number = 0;
  private _maxConsecutiveErrors: number = 3;

  // Callbacks
  private onDistanceUpdateCallback: (totalDist: number, deltaDist: number) => void = null;
  private onLocationReadyCallback: () => void = null;
  private onGpsStatusChangeCallback: (status: string, message: string) => void = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    this._gpsCheckStartTime = getTime();
    this.initLocationService();

    // Start timeout check
    this.createEvent('UpdateEvent').bind(() => this.checkGpsTimeout());
  }

  private initLocationService(): void {
    this.setGpsStatus('CHECKING', 'Initializing GPS...');

    try {
      this.locationService = GeoLocation.createLocationService();
      this.locationService.accuracy = GeoLocationAccuracy.Navigation;

      this.log('LocationService created with Navigation accuracy');
      this.setGpsStatus('CHECKING', 'Waiting for GPS signal...');

      // Get initial position
      this.locationService.getCurrentPosition(
        (pos: GeoPosition) => {
          this.currentLat = pos.latitude;
          this.currentLon = pos.longitude;
          this.currentAlt = pos.altitude;
          this.hasLocation = true;
          this._consecutiveErrors = 0;

          this.setGpsStatus('CONNECTED', 'GPS Connected');
          this.log('Initial position: ' + this.currentLat.toFixed(6) + ', ' + this.currentLon.toFixed(6));

          if (this.onLocationReadyCallback) {
            this.onLocationReadyCallback();
          }
        },
        (error: string) => {
          this._consecutiveErrors++;
          this.log('ERROR getting initial position: ' + error);

          // Check for permission denied
          if (error.toLowerCase().includes('permission') || error.toLowerCase().includes('denied')) {
            this.setGpsStatus('PERMISSION_DENIED', 'GPS permission denied');
          } else if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
            this.setGpsStatus('NOT_AVAILABLE', 'GPS not available - using step tracking');
          }
        }
      );
    } catch (e) {
      this.log('ERROR creating LocationService: ' + e);
      this.setGpsStatus('NOT_AVAILABLE', 'GPS not available - using step tracking');
    }
  }

  private checkGpsTimeout(): void {
    // Only check during CHECKING state
    if (this._gpsStatus !== 'CHECKING') return;

    var elapsed = getTime() - this._gpsCheckStartTime;
    if (elapsed > this._gpsCheckTimeout) {
      this.setGpsStatus('NOT_AVAILABLE', 'GPS timeout - using step tracking');
      this.log('GPS check timed out after ' + this._gpsCheckTimeout + 's');
    }
  }

  private setGpsStatus(status: string, message: string): void {
    var changed = this._gpsStatus !== status;
    this._gpsStatus = status;
    this._gpsStatusMessage = message;

    if (changed) {
      this.log('GPS Status: ' + status + ' - ' + message);
      if (this.onGpsStatusChangeCallback) {
        this.onGpsStatusChangeCallback(status, message);
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start tracking distance
   * @param onDistanceUpdate Called with (totalDistance, deltaDistance) in meters
   */
  startTracking(onDistanceUpdate?: (totalDist: number, deltaDist: number) => void): void {
    if (this.isTracking) {
      this.log('Already tracking');
      return;
    }

    if (!this.locationService) {
      this.log('ERROR: LocationService not available');
      return;
    }

    this.isTracking = true;
    this.totalDistance = 0;
    this.lastPosition = null;
    this.onDistanceUpdateCallback = onDistanceUpdate;
    this.lastUpdateTime = getTime();

    // Create update loop
    this.updateEvent = this.createEvent('UpdateEvent');
    this.updateEvent.bind(() => this.onUpdate());

    this.log('Started tracking distance');
  }

  /**
   * Stop tracking and return total distance
   */
  stopTracking(): number {
    if (!this.isTracking) {
      return this.totalDistance;
    }

    this.isTracking = false;

    if (this.updateEvent) {
      this.removeEvent(this.updateEvent);
      this.updateEvent = null;
    }

    this.log('Stopped tracking. Total distance: ' + this.totalDistance.toFixed(2) + 'm');
    return this.totalDistance;
  }

  /**
   * Reset distance counter without stopping
   */
  resetDistance(): void {
    this.totalDistance = 0;
    this.lastPosition = null;
    this.log('Distance reset');
  }

  /**
   * Get current total distance in meters
   */
  getDistance(): number {
    return this.totalDistance;
  }

  /**
   * Check if GPS location is available
   */
  isLocationReady(): boolean {
    return this.hasLocation;
  }

  /**
   * Set callback for when location becomes available
   */
  onLocationReady(callback: () => void): void {
    this.onLocationReadyCallback = callback;
    if (this.hasLocation && callback) {
      callback();
    }
  }

  /**
   * Get current position
   */
  getCurrentPosition(): { lat: number, lon: number, alt: number } {
    return {
      lat: this.currentLat,
      lon: this.currentLon,
      alt: this.currentAlt
    };
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.isTracking || !this.locationService) return;

    var now = getTime();
    if (now - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = now;

    this.locationService.getCurrentPosition(
      (pos: GeoPosition) => this.handlePositionUpdate(pos),
      (error: string) => {
        // Silently ignore errors during tracking
      }
    );
  }

  private handlePositionUpdate(pos: GeoPosition): void {
    this.currentLat = pos.latitude;
    this.currentLon = pos.longitude;
    this.currentAlt = pos.altitude;
    this.hasLocation = true;

    if (this.lastPosition === null) {
      this.lastPosition = pos;
      return;
    }

    // Calculate distance from last position
    var dist = this.haversineDistance(
      this.lastPosition.latitude,
      this.lastPosition.longitude,
      pos.latitude,
      pos.longitude
    );

    // Only count if movement exceeds threshold (filters GPS jitter)
    if (dist >= this.minMovementThreshold) {
      this.totalDistance += dist;
      this.lastPosition = pos;

      if (this.onDistanceUpdateCallback) {
        this.onDistanceUpdateCallback(this.totalDistance, dist);
      }

      if (this.debugPrint) {
        this.log('Distance: ' + this.totalDistance.toFixed(1) + 'm (+' + dist.toFixed(1) + 'm)');
      }
    }
  }

  // ── Haversine Formula ──────────────────────────────────────────────────────
  // Calculates distance between two GPS coordinates in meters

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    var R = 6371000; // Earth radius in meters

    var dLat = this.toRadians(lat2 - lat1);
    var dLon = this.toRadians(lon2 - lon1);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // ── Logging ────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[LocationTracker] ' + msg);
    }
  }
}
