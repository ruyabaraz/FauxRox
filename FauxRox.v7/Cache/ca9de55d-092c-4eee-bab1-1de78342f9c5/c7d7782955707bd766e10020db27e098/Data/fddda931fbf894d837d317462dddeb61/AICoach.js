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
// AICoach.ts — AI Coach for HYROX (Toggle Mode + Push-to-Talk)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Features:
// - Toggle mode: continuous conversation (left corner button)
// - Push-to-talk: single query mode (legacy support)
// - Gemini Live for voice responses
// - Context-aware (race state, heart rate, cloud data)
// - Interrupt: user speaking stops AI audio
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
            this.listeningWaveAnimation = this.listeningWaveAnimation;
            this.micImage = this.micImage;
            this.toggleButton = this.toggleButton;
            this.pulseSpeed = this.pulseSpeed;
            this.pulseScale = this.pulseScale;
            this.debugPrint = this.debugPrint;
            this.asrModule = require('LensStudio:AsrModule');
            this.geminiLive = null;
            this.isRecording = false;
            this.isProcessing = false;
            this.isSessionReady = false;
            this.completedTextDisplay = true;
            // Toggle mode state
            this._isToggleOn = false;
            this.isUserSpeaking = false;
            this.isAISpeaking = false;
            this.shouldRestartListening = false;
            // Cached cloud context (fetched async)
            this.cachedCloudContext = '';
            // Mic pulse animation
            this.micOriginalScale = null;
            this.micPulseTime = 0;
            this.isMicPulsing = false;
            // Animated texture for wave animation
            this.waveAnimatedTexture = null;
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
            this.listeningWaveAnimation = this.listeningWaveAnimation;
            this.micImage = this.micImage;
            this.toggleButton = this.toggleButton;
            this.pulseSpeed = this.pulseSpeed;
            this.pulseScale = this.pulseScale;
            this.debugPrint = this.debugPrint;
            this.asrModule = require('LensStudio:AsrModule');
            this.geminiLive = null;
            this.isRecording = false;
            this.isProcessing = false;
            this.isSessionReady = false;
            this.completedTextDisplay = true;
            // Toggle mode state
            this._isToggleOn = false;
            this.isUserSpeaking = false;
            this.isAISpeaking = false;
            this.shouldRestartListening = false;
            // Cached cloud context (fetched async)
            this.cachedCloudContext = '';
            // Mic pulse animation
            this.micOriginalScale = null;
            this.micPulseTime = 0;
            this.isMicPulsing = false;
            // Animated texture for wave animation
            this.waveAnimatedTexture = null;
        }
        // Public getter for MotivationalShouts
        get isToggleOn() { return this._isToggleOn; }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            this.log('AICoach initialized');
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = false;
            }
            if (this.listeningWaveAnimation) {
                this.listeningWaveAnimation.enabled = false;
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
            // Get animated texture from wave animation
            if (this.listeningWaveAnimation) {
                const image = this.listeningWaveAnimation.getComponent('Component.Image');
                if (image && image.mainPass && image.mainPass.baseTex) {
                    this.waveAnimatedTexture = image.mainPass.baseTex;
                    // Stop animation initially
                    if (this.waveAnimatedTexture && this.waveAnimatedTexture.stop) {
                        this.waveAnimatedTexture.stop();
                    }
                }
            }
        }
        // ── Toggle Mode ───────────────────────────────────────────────────────────
        /**
         * Toggle coach on/off (called from UI button)
         */
        toggleCoach() {
            if (this._isToggleOn) {
                this.deactivateToggleMode();
            }
            else {
                this.activateToggleMode();
            }
        }
        activateToggleMode() {
            if (!this.isSessionReady) {
                this.log('Cannot activate: Gemini not ready');
                if (this.textDisplay) {
                    this.textDisplay.text = 'AI not ready...';
                }
                return;
            }
            this.log('Toggle mode ON');
            this._isToggleOn = true;
            // Show indicator
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = true;
            }
            // Wave animation starts hidden, shown only when user speaks
            if (this.listeningWaveAnimation) {
                this.listeningWaveAnimation.enabled = false;
            }
            // Refresh cloud context
            this.fetchCloudContext();
            // Clear text
            if (this.textDisplay) {
                this.textDisplay.text = '';
            }
            // Start continuous listening
            this.startContinuousListening();
        }
        deactivateToggleMode() {
            this.log('Toggle mode OFF');
            this._isToggleOn = false;
            this.shouldRestartListening = false;
            // Stop ASR
            if (this.isRecording) {
                this.asrModule.stopTranscribing();
                this.isRecording = false;
            }
            // Stop animations
            this.stopMicPulse();
            // Stop and hide wave animation
            if (this.waveAnimatedTexture && this.waveAnimatedTexture.stop) {
                this.waveAnimatedTexture.stop();
            }
            if (this.listeningWaveAnimation) {
                this.listeningWaveAnimation.enabled = false;
            }
            // Hide indicator
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = false;
            }
            // Interrupt any AI speech
            if (this.dynamicAudioOutput) {
                this.dynamicAudioOutput.interruptAudioOutput();
            }
            if (this.textDisplay) {
                this.textDisplay.text = '';
            }
        }
        // ── Continuous Listening ──────────────────────────────────────────────────
        startContinuousListening() {
            if (!this._isToggleOn)
                return;
            if (this.isRecording)
                return;
            this.log('Starting continuous listening...');
            this.isRecording = true;
            this.isUserSpeaking = false;
            const asrSettings = AsrModule.AsrTranscriptionOptions.create();
            asrSettings.mode = AsrModule.AsrMode.HighAccuracy;
            asrSettings.silenceUntilTerminationMs = 1500; // Shorter for conversation flow
            asrSettings.onTranscriptionUpdateEvent.add((output) => {
                if (!this._isToggleOn)
                    return;
                if (!output.isFinal) {
                    // User is speaking - show animations
                    if (!this.isUserSpeaking) {
                        this.onUserStartedSpeaking();
                    }
                }
                else {
                    // User finished speaking
                    this.onUserFinishedSpeaking(output.text);
                }
            });
            asrSettings.onTranscriptionErrorEvent.add((error) => {
                this.log('ASR error: ' + error);
                this.isRecording = false;
                this.isUserSpeaking = false;
                this.stopMicPulse();
                this.setListeningAnimation(false);
                // Restart listening if still in toggle mode
                if (this._isToggleOn) {
                    this.delayedCall(0.5, () => this.startContinuousListening());
                }
            });
            this.asrModule.startTranscribing(asrSettings);
        }
        onUserStartedSpeaking() {
            this.log('User started speaking');
            this.isUserSpeaking = true;
            // Interrupt AI if it's speaking
            if (this.isAISpeaking || this.isProcessing) {
                this.log('Interrupting AI...');
                if (this.dynamicAudioOutput) {
                    this.dynamicAudioOutput.interruptAudioOutput();
                }
                this.isAISpeaking = false;
                this.isProcessing = false;
            }
            // Show animations
            this.startMicPulse();
            this.setListeningAnimation(true);
        }
        onUserFinishedSpeaking(transcript) {
            this.log('User finished speaking');
            this.isRecording = false;
            this.isUserSpeaking = false;
            this.asrModule.stopTranscribing();
            // Stop animations
            this.stopMicPulse();
            this.setListeningAnimation(false);
            if (!transcript || transcript.trim().length === 0) {
                // No speech detected, restart listening
                if (this._isToggleOn) {
                    this.delayedCall(0.3, () => this.startContinuousListening());
                }
                return;
            }
            // Send to Gemini
            this.log('User: ' + transcript);
            this.shouldRestartListening = true;
            this.sendToGemini(transcript);
        }
        setListeningAnimation(active) {
            // Simply show/hide the animation object
            // The animated texture has Auto Play enabled, so it will animate when visible
            if (this.listeningWaveAnimation) {
                this.listeningWaveAnimation.enabled = active;
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
            // Sine wave pulse
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
                    this.log('Cloud context loaded');
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
                if (this.textDisplay && !this._isToggleOn) {
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
                    this.isAISpeaking = true;
                    const b64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                    const audio = Base64.decode(b64Audio);
                    this.dynamicAudioOutput.addAudioFrame(audio);
                }
                // Handle interruption
                if (message.serverContent.interrupted) {
                    this.isAISpeaking = false;
                    this.dynamicAudioOutput.interruptAudioOutput();
                }
                // Show transcription (subtitle)
                else if (message?.serverContent?.outputTranscription?.text) {
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
                    this.isAISpeaking = false;
                    this.log('AI response complete');
                    // Restart listening if in toggle mode
                    if (this._isToggleOn && this.shouldRestartListening) {
                        this.shouldRestartListening = false;
                        this.delayedCall(0.3, () => this.startContinuousListening());
                    }
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
         * Speak a motivational shout (called by MotivationalShouts)
         * Only works when toggle mode is OFF
         */
        speakShout(context) {
            // Don't shout when toggle mode is on (conversation mode)
            if (this._isToggleOn) {
                this.log('Shout skipped: toggle mode is ON');
                return;
            }
            if (!this.geminiLive || !this.isSessionReady) {
                this.log('Cannot shout: Gemini not ready');
                return;
            }
            if (this.isRecording || this.isProcessing) {
                this.log('Cannot shout: busy with user interaction');
                return;
            }
            this.log('Shout context: ' + context);
            // Let Gemini generate a unique motivational shout based on context
            const shoutMessage = {
                client_content: {
                    turns: [
                        {
                            role: 'user',
                            parts: [{ text: 'You are an energetic fitness coach. ' + context + ' Give a SHORT motivational shout (max 6 words). Be creative, vary your style. Just say the shout, nothing else.' }]
                        }
                    ],
                    turn_complete: true
                }
            };
            this.geminiLive.send(shoutMessage);
        }
        /**
         * Start listening for voice input (legacy push-to-talk mode)
         */
        startListening() {
            // If toggle mode is on, ignore push-to-talk
            if (this._isToggleOn) {
                this.log('Push-to-talk ignored: toggle mode is ON');
                return;
            }
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
            this.log('Starting voice input (push-to-talk)...');
            this.isRecording = true;
            // Refresh cloud context
            this.fetchCloudContext();
            if (this.recordingIndicator) {
                this.recordingIndicator.enabled = true;
            }
            this.startMicPulse();
            this.setListeningAnimation(true);
            if (this.textDisplay) {
                this.textDisplay.text = '';
            }
            const asrSettings = AsrModule.AsrTranscriptionOptions.create();
            asrSettings.mode = AsrModule.AsrMode.HighAccuracy;
            asrSettings.silenceUntilTerminationMs = 2000;
            asrSettings.onTranscriptionUpdateEvent.add((output) => {
                if (output.isFinal) {
                    this.onPushToTalkComplete(output.text);
                }
            });
            asrSettings.onTranscriptionErrorEvent.add((error) => {
                this.log('ASR error: ' + error);
                this.isRecording = false;
                this.stopMicPulse();
                this.setListeningAnimation(false);
                if (this.recordingIndicator) {
                    this.recordingIndicator.enabled = false;
                }
                if (this.textDisplay) {
                    this.textDisplay.text = 'Didn\'t catch that. Try again.';
                }
            });
            this.asrModule.startTranscribing(asrSettings);
        }
        onPushToTalkComplete(transcript) {
            this.isRecording = false;
            this.asrModule.stopTranscribing();
            this.stopMicPulse();
            this.setListeningAnimation(false);
            if (!transcript || transcript.trim().length === 0) {
                if (this.recordingIndicator) {
                    this.recordingIndicator.enabled = false;
                }
                if (this.textDisplay) {
                    this.textDisplay.text = 'Didn\'t hear anything.';
                }
                return;
            }
            this.log('User: ' + transcript);
            this.sendToGemini(transcript);
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
            this.setListeningAnimation(false);
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
            this.isAISpeaking = false;
            this.isProcessing = false;
        }
        // ── Voice Processing ───────────────────────────────────────────────────────
        sendToGemini(userQuery) {
            if (!this.geminiLive || !this.isSessionReady) {
                this.log('Gemini not ready');
                return;
            }
            this.isProcessing = true;
            this.completedTextDisplay = true;
            // Build context
            const context = this.buildContext();
            const fullPrompt = context + '\n\nUser: ' + userQuery;
            this.log('Sending to Gemini...');
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
            // Cloud data
            if (this.cachedCloudContext) {
                lines.push('');
                lines.push('=== Historical Data ===');
                lines.push(this.cachedCloudContext);
            }
            return lines.join('\n');
        }
        // ── Utilities ─────────────────────────────────────────────────────────────
        delayedCall(seconds, callback) {
            const event = this.createEvent('DelayedCallbackEvent');
            event.bind(() => {
                callback();
            });
            event.reset(seconds);
        }
        // ── Debug ─────────────────────────────────────────────────────────────────
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