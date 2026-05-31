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
exports.CloudManager = void 0;
var __selfType = requireType("./CloudManager");
function component(target) {
    target.getTypeName = function () { return __selfType; };
    if (target.prototype.hasOwnProperty("getTypeName"))
        return;
    Object.defineProperty(target.prototype, "getTypeName", {
        value: function () { return __selfType; },
        configurable: true,
        writable: true
    });
}
// ============================================================================
// CloudManager.ts — Supabase Cloud Integration
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Handles:
// - Race data persistence (save on finish)
// - Leaderboard fetch
// - Friend comparison data
// - Historical records
// ============================================================================
const supabase_snapcloud_1 = require("SupabaseClient.lspkg/supabase-snapcloud");
let CloudManager = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var CloudManager = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.supabaseProject = this.supabaseProject;
            this.debugPrint = this.debugPrint;
            this.client = null;
            this._isAuthenticated = false;
            this._userUUID = '';
            this._displayName = '';
        }
        __initialize() {
            super.__initialize();
            this.supabaseProject = this.supabaseProject;
            this.debugPrint = this.debugPrint;
            this.client = null;
            this._isAuthenticated = false;
            this._userUUID = '';
            this._displayName = '';
        }
        get isAuthenticated() { return this._isAuthenticated; }
        get userUUID() { return this._userUUID; }
        get displayName() { return this._displayName; }
        onAwake() {
            this.log('CloudManager initialized');
            if (!this.supabaseProject) {
                this.log('WARNING: SupabaseProject not assigned');
                return;
            }
            this.initClient();
        }
        // ── Initialization ──────────────────────────────────────────────────────────
        initClient() {
            try {
                this.client = (0, supabase_snapcloud_1.createClient)(this.supabaseProject.url, this.supabaseProject.publicToken, {
                    realtime: {
                        heartbeatIntervalMs: 2500 // Required for alpha
                    }
                });
                this.log('Supabase client created');
            }
            catch (e) {
                this.log('ERROR creating client: ' + e);
            }
        }
        // ── Authentication ──────────────────────────────────────────────────────────
        async authenticate() {
            if (!this.client) {
                this.log('ERROR: Client not initialized');
                return false;
            }
            try {
                const { data, error } = await this.client.auth.signInWithIdToken({
                    provider: 'snapchat',
                    token: ''
                });
                if (error) {
                    this.log('Auth error: ' + error.message);
                    return false;
                }
                this._isAuthenticated = true;
                this._userUUID = data.user?.id || '';
                // Debug: log all user data to see what Snapchat provides
                this.log('Auth user data: ' + JSON.stringify(data.user));
                this._displayName = data.user?.user_metadata?.display_name
                    || data.user?.user_metadata?.name
                    || data.user?.user_metadata?.username
                    || 'Player';
                this.log('Authenticated: ' + this._displayName + ' (' + this._userUUID + ')');
                return true;
            }
            catch (e) {
                this.log('Auth exception: ' + e);
                return false;
            }
        }
        // ── Save Race ───────────────────────────────────────────────────────────────
        async saveRace(record) {
            if (!this.client) {
                this.log('Cannot save: client not initialized');
                return false;
            }
            // Auto-authenticate if needed
            if (!this._isAuthenticated) {
                this.log('Auto-authenticating before save...');
                var authSuccess = await this.authenticate();
                if (!authSuccess) {
                    this.log('Auto-auth failed, cannot save');
                    return false;
                }
            }
            try {
                const { data, error } = await this.client
                    .from('race_history')
                    .insert({
                    user_id: this._userUUID,
                    display_name: this._displayName,
                    total_time: Math.round(record.totalTime),
                    completed: record.completed,
                    splits: JSON.stringify(record.splits),
                    avg_hr: Math.round(record.avgHR),
                    peak_hr: Math.round(record.peakHR)
                })
                    .select();
                if (error) {
                    this.log('Save error: ' + error.message);
                    return false;
                }
                this.log('Race saved: ' + record.totalTime + 'ms');
                return true;
            }
            catch (e) {
                this.log('Save exception: ' + e);
                return false;
            }
        }
        // ── Leaderboard ─────────────────────────────────────────────────────────────
        async getLeaderboard(limit = 10) {
            if (!this.client) {
                this.log('ERROR: Client not initialized');
                return [];
            }
            try {
                const { data, error } = await this.client
                    .from('leaderboard')
                    .select('*')
                    .order('best_time', { ascending: true })
                    .limit(limit);
                if (error) {
                    this.log('Leaderboard error: ' + error.message);
                    return [];
                }
                return (data || []).map((row, idx) => ({
                    rank: idx + 1,
                    displayName: row.display_name,
                    bestTime: row.best_time,
                    odizUserId: row.user_id
                }));
            }
            catch (e) {
                this.log('Leaderboard exception: ' + e);
                return [];
            }
        }
        // ── Personal Best ───────────────────────────────────────────────────────────
        async getPersonalBest() {
            if (!this.client || !this._isAuthenticated) {
                this.log('Cannot fetch: not authenticated');
                return null;
            }
            try {
                const { data, error } = await this.client
                    .from('race_history')
                    .select('*')
                    .eq('user_id', this._userUUID)
                    .eq('completed', true)
                    .order('total_time', { ascending: true })
                    .limit(1);
                if (error || !data || data.length === 0) {
                    return null;
                }
                const row = data[0];
                return {
                    totalTime: row.total_time,
                    completed: row.completed,
                    splits: JSON.parse(row.splits || '[]'),
                    avgHR: row.avg_hr,
                    peakHR: row.peak_hr,
                    createdAt: row.created_at
                };
            }
            catch (e) {
                this.log('PersonalBest exception: ' + e);
                return null;
            }
        }
        // ── Friend Comparison ───────────────────────────────────────────────────────
        async getFriendRace(friendUserId) {
            if (!this.client) {
                this.log('ERROR: Client not initialized');
                return null;
            }
            try {
                const { data, error } = await this.client
                    .from('race_history')
                    .select('*')
                    .eq('user_id', friendUserId)
                    .eq('completed', true)
                    .order('total_time', { ascending: true })
                    .limit(1);
                if (error || !data || data.length === 0) {
                    return null;
                }
                const row = data[0];
                return {
                    displayName: row.display_name,
                    totalTime: row.total_time,
                    completed: row.completed,
                    splits: JSON.parse(row.splits || '[]'),
                    avgHR: row.avg_hr,
                    peakHR: row.peak_hr,
                    createdAt: row.created_at
                };
            }
            catch (e) {
                this.log('FriendRace exception: ' + e);
                return null;
            }
        }
        // ── Get Race Context for AI ─────────────────────────────────────────────────
        async getAIContext(friendUserId) {
            // Auto-authenticate if needed
            if (!this._isAuthenticated) {
                var authSuccess = await this.authenticate();
                if (!authSuccess) {
                    return 'Cloud data not available (not authenticated)';
                }
            }
            var lines = [];
            // Personal best
            const pb = await this.getPersonalBest();
            if (pb) {
                lines.push('Your Personal Best: ' + (pb.totalTime / 1000).toFixed(1) + 's');
                lines.push('Your PB Splits: ' + pb.splits.map(s => s.name + ': ' + (s.duration / 1000).toFixed(1) + 's').join(', '));
            }
            else {
                lines.push('No personal best yet (first race)');
            }
            // Leaderboard - top 5
            const leaderboard = await this.getLeaderboard(5);
            if (leaderboard.length > 0) {
                lines.push('');
                lines.push('=== Leaderboard (Top 5) ===');
                leaderboard.forEach((entry, idx) => {
                    var isSelf = entry.odizUserId === this._userUUID ? ' (YOU)' : '';
                    lines.push((idx + 1) + '. ' + entry.displayName + ': ' + (entry.bestTime / 1000).toFixed(1) + 's' + isSelf);
                });
            }
            // Friend comparison
            if (friendUserId) {
                const friend = await this.getFriendRace(friendUserId);
                if (friend) {
                    lines.push('');
                    lines.push('Friend ' + friend.displayName + ' Best: ' + (friend.totalTime / 1000).toFixed(1) + 's');
                }
            }
            return lines.join('\n');
        }
        // ── Debug ───────────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[CloudManager] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "CloudManager");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CloudManager = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CloudManager = _classThis;
})();
exports.CloudManager = CloudManager;
//# sourceMappingURL=CloudManager.js.map