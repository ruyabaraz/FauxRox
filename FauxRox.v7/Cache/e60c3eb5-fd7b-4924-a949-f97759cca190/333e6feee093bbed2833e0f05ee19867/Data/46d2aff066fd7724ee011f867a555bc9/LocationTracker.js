"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationTracker = void 0;
var __selfType = requireType("./LocationTracker");
function component(target) { target.getTypeName = function () { return __selfType; }; }
require("LensStudio:RawLocationModule");
// ============================================================================
// LocationTracker.ts — HYROX MIRAGE GPS Distance Tracking
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Uses GeoLocation API for outdoor distance tracking
// Calculates distance using Haversine formula for GPS coordinates
// ============================================================================
let LocationTracker = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var LocationTracker = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Settings ───────────────────────────────────────────────────────────────
            /** Minimum distance change (meters) to register movement */
            this.minMovementThreshold = this.minMovementThreshold;
            /** Update interval in seconds */
            this.updateInterval = this.updateInterval;
            /** Enable debug logging */
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this.locationService = null;
            this.isTracking = false;
            this.totalDistance = 0; // meters
            this.lastPosition = null;
            this.updateEvent = null;
            this.lastUpdateTime = 0;
            // Current location
            this.currentLat = 0;
            this.currentLon = 0;
            this.currentAlt = 0;
            this.hasLocation = false;
            // Callbacks
            this.onDistanceUpdateCallback = null;
            this.onLocationReadyCallback = null;
        }
        __initialize() {
            super.__initialize();
            // ── Settings ───────────────────────────────────────────────────────────────
            /** Minimum distance change (meters) to register movement */
            this.minMovementThreshold = this.minMovementThreshold;
            /** Update interval in seconds */
            this.updateInterval = this.updateInterval;
            /** Enable debug logging */
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this.locationService = null;
            this.isTracking = false;
            this.totalDistance = 0; // meters
            this.lastPosition = null;
            this.updateEvent = null;
            this.lastUpdateTime = 0;
            // Current location
            this.currentLat = 0;
            this.currentLon = 0;
            this.currentAlt = 0;
            this.hasLocation = false;
            // Callbacks
            this.onDistanceUpdateCallback = null;
            this.onLocationReadyCallback = null;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            this.initLocationService();
        }
        initLocationService() {
            try {
                this.locationService = GeoLocation.createLocationService();
                this.locationService.accuracy = GeoLocationAccuracy.Navigation;
                this.log('LocationService created with Navigation accuracy');
                // Get initial position
                this.locationService.getCurrentPosition((pos) => {
                    this.currentLat = pos.latitude;
                    this.currentLon = pos.longitude;
                    this.currentAlt = pos.altitude;
                    this.hasLocation = true;
                    this.log('Initial position: ' + this.currentLat.toFixed(6) + ', ' + this.currentLon.toFixed(6));
                    if (this.onLocationReadyCallback) {
                        this.onLocationReadyCallback();
                    }
                }, (error) => {
                    this.log('ERROR getting initial position: ' + error);
                });
            }
            catch (e) {
                this.log('ERROR creating LocationService: ' + e);
            }
        }
        // ── Public API ─────────────────────────────────────────────────────────────
        /**
         * Start tracking distance
         * @param onDistanceUpdate Called with (totalDistance, deltaDistance) in meters
         */
        startTracking(onDistanceUpdate) {
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
        stopTracking() {
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
        resetDistance() {
            this.totalDistance = 0;
            this.lastPosition = null;
            this.log('Distance reset');
        }
        /**
         * Get current total distance in meters
         */
        getDistance() {
            return this.totalDistance;
        }
        /**
         * Check if GPS location is available
         */
        isLocationReady() {
            return this.hasLocation;
        }
        /**
         * Set callback for when location becomes available
         */
        onLocationReady(callback) {
            this.onLocationReadyCallback = callback;
            if (this.hasLocation && callback) {
                callback();
            }
        }
        /**
         * Get current position
         */
        getCurrentPosition() {
            return {
                lat: this.currentLat,
                lon: this.currentLon,
                alt: this.currentAlt
            };
        }
        // ── Update Loop ────────────────────────────────────────────────────────────
        onUpdate() {
            if (!this.isTracking || !this.locationService)
                return;
            var now = getTime();
            if (now - this.lastUpdateTime < this.updateInterval)
                return;
            this.lastUpdateTime = now;
            this.locationService.getCurrentPosition((pos) => this.handlePositionUpdate(pos), (error) => {
                // Silently ignore errors during tracking
            });
        }
        handlePositionUpdate(pos) {
            this.currentLat = pos.latitude;
            this.currentLon = pos.longitude;
            this.currentAlt = pos.altitude;
            this.hasLocation = true;
            if (this.lastPosition === null) {
                this.lastPosition = pos;
                return;
            }
            // Calculate distance from last position
            var dist = this.haversineDistance(this.lastPosition.latitude, this.lastPosition.longitude, pos.latitude, pos.longitude);
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
        haversineDistance(lat1, lon1, lat2, lon2) {
            var R = 6371000; // Earth radius in meters
            var dLat = this.toRadians(lat2 - lat1);
            var dLon = this.toRadians(lon2 - lon1);
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }
        toRadians(degrees) {
            return degrees * (Math.PI / 180);
        }
        // ── Logging ────────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[LocationTracker] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "LocationTracker");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LocationTracker = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LocationTracker = _classThis;
})();
exports.LocationTracker = LocationTracker;
//# sourceMappingURL=LocationTracker.js.map