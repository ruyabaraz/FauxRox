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
exports.AICoach = void 0;
var __selfType = requireType("./AICoach");
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
// AICoach.ts — Push-to-Talk AI Assistant for HYROX (Voice Response)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Features:
// - Push-to-talk voice input via ASR
// - Gemini Live for voice responses
// - Context-aware (race state, heart rate, cloud data)
// ============================================================================
const Gemini_1 = require("RemoteServiceGateway.lspkg/HostedExternal/Gemini");
let AICoach = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var AICoach = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Setup ─────────────────────────────────────────────────────────────────
            this.websocketRequirementsObj = this.websocketRequirementsObj;
            this.dynamicAudioOutput = this.dynamicAudioOutput;
            this.textDisplay = this.textDisplay;
            this.raceStateMachine = this.raceStateMachine;
            this.heartRateTracker = this.heartRateTracker;
            this.cloudManager = this.cloudManager;
            this.instructions = this.instructions;
            this.voice = this.voice;
            this.recordingIndicator = this.recordingIndicator;
            this.micImage = this.micImage;
            this.pulseSpeed = this.pulseSpeed;
            this.pulseScale = this.pulseScale;
            this.debugPrint = this.debugPrint;
            this.asrModule = require('LensStudio:AsrModule');
            this.geminiLive = null;
            this.isRecording = false;
            this.isProcessing = false;
            this.isSessionReady = false;
            this.completedTextDisplay = true;
            // Cached cloud context (fetched async)
            this.cachedCloudContext = '';
            // Mic pulse animation
            this.micOriginalScale = null;
            this.micPulseTime = 0;
            this.isMicPulsing = false;
        }
        __initialize() {
            super.__initialize();
            // ── Setup ─────────────────────────────────────────────────────────────────
            this.websocketRequirementsObj = this.websocketRequirementsObj;
            this.dynamicAudioOutput = this.dynamicAudioOutput;
            this.textDisplay = this.textDisplay;
            this.raceStateMachine = this.raceStateMachine;
            this.heartRateTracker = this.heartRateTracker;
            this.cloudManager = this.cloudManager;
            this.instructions = this.instructions;
            this.voice = this.voice;
            this.recordingIndicator = this.recordingIndicator;
            this.micImage = this.micImage;
            this.pulseSpeed = this.pulseSpeed;
            this.pulseScale = this.pulseScale;
            this.debugPrint = this.debugPrint;
            this.asrModule = require('LensStudio:AsrModule');
            this.geminiLive = null;
            this.isRecording = false;
            this.isProcessing = false;
            this.isSessionReady = false;
            this.completedTextDisplay = true;
            // Cached cloud context (fetched async)
            this.cachedCloudContext = '';
            // Mic pulse animation
            this.micOriginalScale = null;
            this.micPulseTime = 0;
            this.isMicPulsing = false;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            this.log('AICoach initialized');
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = false;
            }
            // Initialize on start
            this.createEvent('OnStartEvent').bind(() => {
                this.initGeminiLive();
                this.fetchCloudContext();
            });
            // Update event for mic pulse animation
            this.createEvent('UpdateEvent').bind(() => {
                this.updateMicPulse();
            });
            // Store original mic scale
            if (this.micImage) {
                this.micOriginalScale = this.micImage.getTransform().getLocalScale();
            }
        }
        // ── Mic Pulse Animation ────────────────────────────────────────────────────
        startMicPulse() {
            if (!this.micImage)
                return;
            if (!this.micOriginalScale) {
                this.micOriginalScale = this.micImage.getTransform().getLocalScale();
            }
            this.micPulseTime = 0;
            this.isMicPulsing = true;
        }
        stopMicPulse() {
            this.isMicPulsing = false;
            // Reset to original scale
            if (this.micImage && this.micOriginalScale) {
                this.micImage.getTransform().setLocalScale(this.micOriginalScale);
            }
        }
        updateMicPulse() {
            if (!this.isMicPulsing || !this.micImage || !this.micOriginalScale)
                return;
            this.micPulseTime += getDeltaTime();
            // Sine wave pulse: scale oscillates between (1 - pulseScale) and (1 + pulseScale)
            var pulse = Math.sin(this.micPulseTime * this.pulseSpeed) * this.pulseScale;
            var scaleFactor = 1.0 + pulse;
            var newScale = new vec3(this.micOriginalScale.x * scaleFactor, this.micOriginalScale.y * scaleFactor, this.micOriginalScale.z * scaleFactor);
            this.micImage.getTransform().setLocalScale(newScale);
        }
        // ── Cloud Data Fetch ───────────────────────────────────────────────────────
        async fetchCloudContext() {
            if (!this.cloudManager)
                return;
            try {
                const context = await this.cloudManager.getAIContext();
                if (context) {
                    this.cachedCloudContext = context;
                    this.log('Cloud context loaded:\n' + context);
                }
            }
            catch (e) {
                this.log('Failed to fetch cloud context: ' + e);
            }
        }
        // ── Gemini Live Setup ──────────────────────────────────────────────────────
        initGeminiLive() {
            if (!this.dynamicAudioOutput) {
                this.log('ERROR: DynamicAudioOutput not assigned');
                return;
            }
            // Enable websocket requirements
            if (this.websocketRequirementsObj) {
                this.websocketRequirementsObj.enabled = true;
            }
            // Initialize audio output at 24kHz
            this.dynamicAudioOutput.initialize(24000);
            // Show internet status
            if (this.textDisplay) {
                this.textDisplay.text = global.deviceInfoSystem.isInternetAvailable()
                    ? 'AI Ready'
                    : 'No Internet';
            }
            global.deviceInfoSystem.onInternetStatusChanged.add((args) => {
                if (this.textDisplay) {
                    this.textDisplay.text = args.isInternetAvailable ? 'AI Ready' : 'No Internet';
                }
            });
            // Connect to Gemini Live
            this.geminiLive = Gemini_1.Gemini.liveConnect();
            this.geminiLive.onOpen.add(() => {
                this.log('Gemini Live connected');
                this.setupSession();
            });
            this.geminiLive.onMessage.add((message) => {
                this.handleMessage(message);
            });
            this.geminiLive.onError.add((error) => {
                this.log('Gemini error: ' + error);
            });
            this.geminiLive.onClose.add((event) => {
                this.log('Gemini closed: ' + event.reason);
                this.isSessionReady = false;
            });
        }
        setupSession() {
            const generationConfig = {
                responseModalities: ['AUDIO'],
                temperature: 0.8,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: this.voice
                        }
                    }
                }
            };
            // Define voice command tools for race control
            const tools = [
                {
                    function_declarations: [
                        {
                            name: 'pauseRace',
                            description: 'Pauses the current race. Use when user says pause, hold, wait, or similar.'
                        },
                        {
                            name: 'resumeRace',
                            description: 'Resumes a paused race. Use when user says resume, continue, go, or similar.'
                        },
                        {
                            name: 'stopRace',
                            description: 'Stops and ends the current race. Use when user says stop, end, quit, finish early, or similar.'
                        }
                    ]
                }
            ];
            const sessionSetup = {
                setup: {
                    model: 'models/gemini-2.0-flash-live-preview-04-09',
                    generation_config: generationConfig,
                    system_instruction: {
                        parts: [{ text: this.instructions + '\n\nYou can control the race with voice commands. If user asks to pause, resume, or stop the race, use the appropriate function.' }]
                    },
                    tools: tools,
                    contextWindowCompression: {
                        triggerTokens: 20000,
                        slidingWindow: { targetTokens: 16000 }
                    },
                    output_audio_transcription: {}
                }
            };
            this.geminiLive.send(sessionSetup);
        }
        handleMessage(message) {
            // Setup complete
            if (message.setupComplete) {
                this.log('Gemini session ready');
                this.isSessionReady = true;
                return;
            }
            if (message?.serverContent) {
                // Play audio response
                if (message?.serverContent?.modelTurn?.parts?.[0]?.inlineData?.mimeType?.startsWith('audio/pcm')) {
                    const b64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                    const audio = Base64.decode(b64Audio);
                    this.dynamicAudioOutput.addAudioFrame(audio);
                }
                // Handle interruption
                if (message.serverContent.interrupted) {
                    this.dynamicAudioOutput.interruptAudioOutput();
                }
                // Show transcription (subtitle)
                else if (message?.serverContent?.outputTranscription?.text) {
                    // Hide indicator when AI response starts
                    if (this.recordingIndicator) {
                        this.recordingIndicator.enabled = false;
                    }
                    if (this.textDisplay) {
                        if (this.completedTextDisplay) {
                            this.textDisplay.text = message.serverContent.outputTranscription.text;
                        }
                        else {
                            this.textDisplay.text += message.serverContent.outputTranscription.text;
                        }
                    }
                    this.completedTextDisplay = false;
                }
                // Show text response
                else if (message?.serverContent?.modelTurn?.parts?.[0]?.text) {
                    // Hide indicator when AI response starts
                    if (this.recordingIndicator) {
                        this.recordingIndicator.enabled = false;
                    }
                    if (this.textDisplay) {
                        if (this.completedTextDisplay) {
                            this.textDisplay.text = message.serverContent.modelTurn.parts[0].text;
                        }
                        else {
                            this.textDisplay.text += message.serverContent.modelTurn.parts[0].text;
                        }
                    }
                    this.completedTextDisplay = false;
                }
                // Turn complete
                else if (message?.serverContent?.turnComplete) {
                    this.completedTextDisplay = true;
                    this.isProcessing = false;
                    this.log('AI response complete');
                }
            }
            // Handle function calls (voice commands)
            if (message.toolCall) {
                this.log('Tool call received');
                message.toolCall.functionCalls.forEach((functionCall) => {
                    this.handleFunctionCall(functionCall.name, functionCall.args);
                });
            }
        }
        // ── Function Call Handlers ─────────────────────────────────────────────────
        handleFunctionCall(name, args) {
            this.log('Function call: ' + name);
            if (!this.raceStateMachine) {
                this.log('RaceStateMachine not connected');
                this.sendFunctionResponse(name, 'Race controller not available');
                return;
            }
            const rsm = this.raceStateMachine;
            switch (name) {
                case 'pauseRace':
                    if (rsm.state === 'RUNNING' || rsm.state === 'STATION') {
                        rsm.togglePause();
                        this.sendFunctionResponse(name, 'Race paused');
                        this.log('Race paused via voice command');
                    }
                    else {
                        this.sendFunctionResponse(name, 'Cannot pause - race is ' + rsm.state);
                    }
                    break;
                case 'resumeRace':
                    if (rsm.state === 'PAUSED') {
                        rsm.togglePause();
                        this.sendFunctionResponse(name, 'Race resumed');
                        this.log('Race resumed via voice command');
                    }
                    else {
                        this.sendFunctionResponse(name, 'Cannot resume - race is ' + rsm.state);
                    }
                    break;
                case 'stopRace':
                    if (rsm.state === 'RUNNING' || rsm.state === 'STATION' || rsm.state === 'PAUSED') {
                        rsm.stopRace();
                        this.sendFunctionResponse(name, 'Race stopped');
                        this.log('Race stopped via voice command');
                    }
                    else {
                        this.sendFunctionResponse(name, 'Cannot stop - race is ' + rsm.state);
                    }
                    break;
                default:
                    this.log('Unknown function: ' + name);
                    this.sendFunctionResponse(name, 'Unknown command');
            }
        }
        sendFunctionResponse(functionName, response) {
            if (!this.geminiLive)
                return;
            const message = {
                tool_response: {
                    function_responses: [
                        {
                            name: functionName,
                            response: { content: response }
                        }
                    ]
                }
            };
            this.geminiLive.send(message);
        }
        // ── Public API ─────────────────────────────────────────────────────────────
        /**
         * Start listening for voice input (call from wrist menu button)
         */
        startListening() {
            if (this.isRecording || this.isProcessing) {
                this.log('Already recording or processing');
                return;
            }
            if (!this.isSessionReady) {
                this.log('Gemini not ready yet');
                if (this.textDisplay) {
                    this.textDisplay.text = 'AI not ready...';
                }
                return;
            }
            this.log('Starting voice input...');
            this.isRecording = true;
            // Refresh cloud context before each query
            this.fetchCloudContext();
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = true;
            }
            // Start mic pulse animation
            this.startMicPulse();
            // Clear text during listening (indicator shows we're listening)
            if (this.textDisplay) {
                this.textDisplay.text = '';
            }
            // Start ASR
            const asrSettings = AsrModule.AsrTranscriptionOptions.create();
            asrSettings.mode = AsrModule.AsrMode.HighAccuracy;
            asrSettings.silenceUntilTerminationMs = 2000;
            asrSettings.onTranscriptionUpdateEvent.add((output) => {
                if (output.isFinal) {
                    this.onVoiceInputComplete(output.text);
                }
            });
            asrSettings.onTranscriptionErrorEvent.add((error) => {
                this.log('ASR error: ' + error);
                this.isRecording = false;
                this.stopMicPulse();
                if (this.recordingIndicator) {
                    this.recordingIndicator.enabled = false;
                }
                if (this.textDisplay) {
                    this.textDisplay.text = 'Didn\'t catch that. Try again.';
                }
            });
            this.asrModule.startTranscribing(asrSettings);
        }
        /**
         * Cancel listening
         */
        stopListening() {
            if (!this.isRecording)
                return;
            this.asrModule.stopTranscribing();
            this.isRecording = false;
            this.stopMicPulse();
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = false;
            }
            this.log('Cancelled');
        }
        /**
         * Interrupt AI voice
         */
        interruptResponse() {
            if (this.dynamicAudioOutput) {
                this.dynamicAudioOutput.interruptAudioOutput();
            }
            this.isProcessing = false;
        }
        // ── Voice Processing ───────────────────────────────────────────────────────
        onVoiceInputComplete(transcript) {
            this.isRecording = false;
            this.asrModule.stopTranscribing();
            this.stopMicPulse();
            // Keep recordingIndicator visible during processing (pulse stopped = processing state)
            // It will be hidden when AI response starts arriving
            if (!transcript || transcript.trim().length === 0) {
                // Hide indicator on error
                if (this.recordingIndicator) {
                    this.recordingIndicator.enabled = false;
                }
                if (this.textDisplay) {
                    this.textDisplay.text = 'Didn\'t hear anything.';
                }
                return;
            }
            // Don't write to textDisplay - indicator shows processing state
            this.log('User: ' + transcript);
            this.sendToGemini(transcript);
        }
        sendToGemini(userQuery) {
            if (!this.geminiLive || !this.isSessionReady) {
                this.log('Gemini not ready');
                return;
            }
            this.isProcessing = true;
            this.completedTextDisplay = true;
            // "Processing..." is already shown from onVoiceInputComplete
            // It will be replaced when AI response starts arriving
            // Build context
            const context = this.buildContext();
            const fullPrompt = context + '\n\nUser: ' + userQuery;
            this.log('Sending to Gemini...');
            // Send as text (Gemini will respond with voice)
            const message = {
                client_content: {
                    turns: [
                        {
                            role: 'user',
                            parts: [{ text: fullPrompt }]
                        }
                    ],
                    turn_complete: true
                }
            };
            this.geminiLive.send(message);
        }
        // ── Context Building ───────────────────────────────────────────────────────
        buildContext() {
            var lines = [];
            lines.push('=== Current Status ===');
            // Race state
            if (this.raceStateMachine) {
                const state = this.raceStateMachine.state;
                const station = this.raceStateMachine.currentStationIndex;
                const elapsed = this.raceStateMachine.elapsedMs;
                lines.push('Race: ' + state);
                if (state !== 'IDLE' && state !== 'FINISHED') {
                    lines.push('Station: ' + station);
                    lines.push('Time: ' + (elapsed / 1000).toFixed(0) + 's');
                }
            }
            // Heart rate
            if (this.heartRateTracker && this.heartRateTracker.isConnected) {
                lines.push('HR: ' + this.heartRateTracker.currentBPM + ' BPM');
                lines.push('Avg HR: ' + this.heartRateTracker.avgBPM + ' BPM');
                lines.push('Peak HR: ' + this.heartRateTracker.peakBPM + ' BPM');
            }
            // Cloud data (personal best, splits from Supabase)
            if (this.cachedCloudContext) {
                lines.push('');
                lines.push('=== Historical Data ===');
                lines.push(this.cachedCloudContext);
            }
            return lines.join('\n');
        }
        // ── Debug ──────────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[AICoach] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "AICoach");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AICoach = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AICoach = _classThis;
})();
exports.AICoach = AICoach;
//# sourceMappingURL=AICoach.js.map