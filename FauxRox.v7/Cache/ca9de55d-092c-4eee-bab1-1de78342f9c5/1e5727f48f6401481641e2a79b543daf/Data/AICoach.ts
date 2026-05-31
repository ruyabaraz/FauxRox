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

import { Gemini } from 'RemoteServiceGateway.lspkg/HostedExternal/Gemini';
import { GeminiTypes } from 'RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes';
import { DynamicAudioOutput } from 'RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput';
import { RaceStateMachine } from './RaceStateMachine';
import { HeartRateTracker } from './HeartRateTracker';
import { CloudManager } from './CloudManager';

@component
export class AICoach extends BaseScriptComponent {

  // ── Setup ─────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('AI Coach - Toggle Mode + Push-to-Talk')
  @ui.separator

  @ui.group_start('Setup')
  @input websocketRequirementsObj: SceneObject;
  @input dynamicAudioOutput: DynamicAudioOutput;
  @input @allowUndefined textDisplay: Text;
  @ui.group_end

  // ── Game References ────────────────────────────────────────────────────────

  @ui.separator
  @ui.group_start('Game References')
  @input @allowUndefined raceStateMachine: RaceStateMachine;
  @input @allowUndefined heartRateTracker: HeartRateTracker;
  @input @allowUndefined cloudManager: CloudManager;
  @ui.group_end

  // ── AI Settings ────────────────────────────────────────────────────────────

  // Base coach personality (always used, cannot be overridden by scene)
  private readonly BASE_INSTRUCTIONS: string = `You are a HYROX fitness coach on AR glasses.
Keep responses SHORT (1-2 sentences) since user is exercising.
You have real-time race data, heart rate, and personal best info.
Be encouraging but direct. Focus on actionable advice.

EXERCISE GUIDE:
- AIR SKIERG: Stand tall, reach arms overhead, then explosively pull down to hips like skiing. Keep core tight, use full range of motion.
- DUMBBELL BEAR CRAWL: Get on all fours with dumbbells, crawl forward pushing weights ahead. Keep back flat, move opposite arm and leg.
- GOBLET REVERSE WALK: Hold weight at chest with both hands, walk backward with controlled steps. Keep chest up, look over shoulder for safety.
- BURPEE BROAD JUMP: Drop to ground, chest touches floor, push up, then jump forward as far as possible. Land soft, repeat immediately.
- STANDING ROW: Hinge at hips, arms extended forward, pull elbows back squeezing shoulder blades. Control the movement both ways.
- HEAVY CARRY: Hold weights at sides or shoulders, walk with tall posture. Short quick steps, breathe steadily, keep core braced.
- DB WALKING LUNGES: Step forward into lunge holding dumbbells, knee tracks over toe. Push through front heel, alternate legs.
- SQUAT TARGET REACH: Squat down with control, then stand and reach arms up to touch target. Full depth squat, explosive stand.`;

  @ui.separator
  @ui.group_start('AI Settings')
  @input
  @widget(new TextAreaWidget())
  @allowUndefined
  extraInstructions: string = '';

  @input
  @widget(new ComboBoxWidget([
    new ComboBoxItem('Kore', 'Kore'),
    new ComboBoxItem('Puck', 'Puck'),
    new ComboBoxItem('Charon', 'Charon'),
    new ComboBoxItem('Aoede', 'Aoede'),
    new ComboBoxItem('Fenrir', 'Fenrir'),
    new ComboBoxItem('Leda', 'Leda'),
    new ComboBoxItem('Orus', 'Orus'),
    new ComboBoxItem('Zephyr', 'Zephyr')
  ]))
  voice: string = 'Kore';
  @ui.group_end

  // ── UI ─────────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.group_start('UI')
  @input @allowUndefined recordingIndicator: SceneObject;
  @input @allowUndefined listeningWaveAnimation: SceneObject;
  @input @allowUndefined micImage: SceneObject;
  @input @allowUndefined toggleButton: SceneObject;
  @input pulseSpeed: number = 4.0;
  @input pulseScale: number = 0.15;
  @input debugPrint: boolean = true;
  @ui.group_end

  // ── State ──────────────────────────────────────────────────────────────────

  private asrModule: AsrModule = require('LensStudio:AsrModule');
  private geminiLive: any = null;
  private isRecording: boolean = false;
  private isProcessing: boolean = false;
  private isSessionReady: boolean = false;
  private completedTextDisplay: boolean = true;

  // Toggle mode state
  private _isToggleOn: boolean = false;
  private isUserSpeaking: boolean = false;
  private isAISpeaking: boolean = false;
  private shouldRestartListening: boolean = false;

  // Cached cloud context (fetched async)
  private cachedCloudContext: string = '';

  // Mic pulse animation
  private micOriginalScale: vec3 = null;
  private micPulseTime: number = 0;
  private isMicPulsing: boolean = false;

  // Public getter for MotivationalShouts
  get isToggleOn(): boolean { return this._isToggleOn; }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
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
  }

  // ── Toggle Mode ───────────────────────────────────────────────────────────

  /**
   * Toggle coach on/off (called from UI button)
   */
  toggleCoach(): void {
    this.log('toggleCoach called, current state: ' + this._isToggleOn);
    if (this._isToggleOn) {
      this.deactivateToggleMode();
    } else {
      this.activateToggleMode();
    }
    this.log('toggleCoach finished, new state: ' + this._isToggleOn);
  }

  private activateToggleMode(): void {
    this.log('Toggle mode ON');
    this._isToggleOn = true;

    if (!this.isSessionReady) {
      this.log('Warning: Gemini not ready yet');
      if (this.textDisplay) {
        this.textDisplay.text = 'AI connecting...';
      }
      // Still show indicator, listening will start when session becomes ready
    }

    // Show indicator, but wave animation only when user speaks
    if (this.recordingIndicator) {
      this.recordingIndicator.enabled = true;
    }
    if (this.listeningWaveAnimation) {
      this.listeningWaveAnimation.enabled = false; // Hidden until user speaks
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

  private deactivateToggleMode(): void {
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

    // Hide indicator and wave animation
    if (this.recordingIndicator) {
      this.recordingIndicator.enabled = false;
    }
    if (this.listeningWaveAnimation) {
      this.listeningWaveAnimation.enabled = false;
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

  private startContinuousListening(): void {
    if (!this._isToggleOn) return;
    if (this.isRecording) return;

    this.log('Starting continuous listening...');
    this.isRecording = true;
    this.isUserSpeaking = false;

    const asrSettings = AsrModule.AsrTranscriptionOptions.create();
    asrSettings.mode = AsrModule.AsrMode.HighAccuracy;
    asrSettings.silenceUntilTerminationMs = 1500; // Shorter for conversation flow

    asrSettings.onTranscriptionUpdateEvent.add((output) => {
      if (!this._isToggleOn) return;

      if (!output.isFinal) {
        // User is speaking - show animations
        if (!this.isUserSpeaking) {
          this.onUserStartedSpeaking();
        }
      } else {
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

  private onUserStartedSpeaking(): void {
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

  private onUserFinishedSpeaking(transcript: string): void {
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

  private setListeningAnimation(active: boolean): void {
    // Show/hide wave animation - only visible when user is speaking
    if (this.listeningWaveAnimation) {
      this.listeningWaveAnimation.enabled = active;
    }
  }

  // ── Mic Pulse Animation ────────────────────────────────────────────────────

  private startMicPulse(): void {
    if (!this.micImage) return;

    if (!this.micOriginalScale) {
      this.micOriginalScale = this.micImage.getTransform().getLocalScale();
    }

    this.micPulseTime = 0;
    this.isMicPulsing = true;
  }

  private stopMicPulse(): void {
    this.isMicPulsing = false;

    // Reset to original scale
    if (this.micImage && this.micOriginalScale) {
      this.micImage.getTransform().setLocalScale(this.micOriginalScale);
    }
  }

  private updateMicPulse(): void {
    if (!this.isMicPulsing || !this.micImage || !this.micOriginalScale) return;

    this.micPulseTime += getDeltaTime();

    // Sine wave pulse
    var pulse = Math.sin(this.micPulseTime * this.pulseSpeed) * this.pulseScale;
    var scaleFactor = 1.0 + pulse;

    var newScale = new vec3(
      this.micOriginalScale.x * scaleFactor,
      this.micOriginalScale.y * scaleFactor,
      this.micOriginalScale.z * scaleFactor
    );

    this.micImage.getTransform().setLocalScale(newScale);
  }

  // ── Cloud Data Fetch ───────────────────────────────────────────────────────

  private async fetchCloudContext(): Promise<void> {
    if (!this.cloudManager) return;

    try {
      const context = await this.cloudManager.getAIContext();
      if (context) {
        this.cachedCloudContext = context;
        this.log('Cloud context loaded');
      }
    } catch (e) {
      this.log('Failed to fetch cloud context: ' + e);
    }
  }

  // ── Gemini Live Setup ──────────────────────────────────────────────────────

  private initGeminiLive(): void {
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
    this.geminiLive = Gemini.liveConnect();

    this.geminiLive.onOpen.add(() => {
      this.log('Gemini Live connected');
      this.setupSession();
    });

    this.geminiLive.onMessage.add((message: any) => {
      this.handleMessage(message);
    });

    this.geminiLive.onError.add((error: any) => {
      this.log('Gemini error: ' + error);
    });

    this.geminiLive.onClose.add((event: any) => {
      this.log('Gemini closed: ' + event.reason);
      this.isSessionReady = false;
    });
  }

  private setupSession(): void {
    const generationConfig: GeminiTypes.Common.GenerationConfig = {
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

    const sessionSetup: GeminiTypes.Live.Setup = {
      setup: {
        model: 'models/gemini-2.0-flash-live-preview-04-09',
        generation_config: generationConfig,
        system_instruction: {
          parts: [{ text: this.getFullInstructions() }]
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

  private handleMessage(message: any): void {
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
          } else {
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
          } else {
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
      message.toolCall.functionCalls.forEach((functionCall: any) => {
        this.handleFunctionCall(functionCall.name, functionCall.args);
      });
    }
  }

  // ── Function Call Handlers ─────────────────────────────────────────────────

  private handleFunctionCall(name: string, args: any): void {
    this.log('Function call: ' + name);

    if (!this.raceStateMachine) {
      this.log('RaceStateMachine not connected');
      this.sendFunctionResponse(name, 'Race controller not available');
      return;
    }

    const rsm = this.raceStateMachine as any;

    switch (name) {
      case 'pauseRace':
        if (rsm.state === 'RUNNING' || rsm.state === 'STATION') {
          rsm.togglePause();
          this.sendFunctionResponse(name, 'Race paused');
          this.log('Race paused via voice command');
        } else {
          this.sendFunctionResponse(name, 'Cannot pause - race is ' + rsm.state);
        }
        break;

      case 'resumeRace':
        if (rsm.state === 'PAUSED') {
          rsm.togglePause();
          this.sendFunctionResponse(name, 'Race resumed');
          this.log('Race resumed via voice command');
        } else {
          this.sendFunctionResponse(name, 'Cannot resume - race is ' + rsm.state);
        }
        break;

      case 'stopRace':
        if (rsm.state === 'RUNNING' || rsm.state === 'STATION' || rsm.state === 'PAUSED') {
          rsm.stopRace();
          this.sendFunctionResponse(name, 'Race stopped');
          this.log('Race stopped via voice command');
        } else {
          this.sendFunctionResponse(name, 'Cannot stop - race is ' + rsm.state);
        }
        break;

      default:
        this.log('Unknown function: ' + name);
        this.sendFunctionResponse(name, 'Unknown command');
    }
  }

  private sendFunctionResponse(functionName: string, response: string): void {
    if (!this.geminiLive) return;

    const message = {
      tool_response: {
        function_responses: [
          {
            name: functionName,
            response: { content: response }
          }
        ]
      }
    } as GeminiTypes.Live.ToolResponse;

    this.geminiLive.send(message);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Speak a motivational shout (called by MotivationalShouts)
   * Only works when toggle mode is OFF
   */
  speakShout(context: string): void {
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
    const shoutMessage: GeminiTypes.Live.ClientContent = {
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
   * Speak post-race summary (called when race finishes)
   */
  speakRaceSummary(raceData: {
    totalTime: number;
    splits: { name: string; duration: number }[];
    avgHR: number;
    peakHR: number;
    pbTime: number;
  }): void {
    if (!this.geminiLive || !this.isSessionReady) {
      this.log('Cannot speak summary: Gemini not ready');
      return;
    }

    // Format time as MM:SS
    const formatTime = (ms: number): string => {
      const totalSec = Math.floor(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return min + ':' + (sec < 10 ? '0' : '') + sec;
    };

    // Build summary context
    let context = 'Race completed in ' + formatTime(raceData.totalTime) + '. ';

    // Compare to PB
    if (raceData.pbTime > 0) {
      const diff = raceData.totalTime - raceData.pbTime;
      if (diff < 0) {
        context += 'NEW PERSONAL BEST! ' + formatTime(Math.abs(diff)) + ' faster than previous. ';
      } else if (diff < 30000) {
        context += 'Close to PB, only ' + formatTime(diff) + ' behind. ';
      } else {
        context += formatTime(diff) + ' behind personal best. ';
      }
    }

    // HR data
    if (raceData.avgHR > 0) {
      context += 'Average heart rate: ' + raceData.avgHR + ' BPM, peak: ' + raceData.peakHR + ' BPM. ';
    }

    // Find slowest and fastest splits
    if (raceData.splits.length > 0) {
      let slowest = raceData.splits[0];
      let fastest = raceData.splits[0];
      for (const split of raceData.splits) {
        if (split.duration > slowest.duration) slowest = split;
        if (split.duration < fastest.duration) fastest = split;
      }
      context += 'Fastest station: ' + fastest.name + ' (' + formatTime(fastest.duration) + '). ';
      context += 'Slowest station: ' + slowest.name + ' (' + formatTime(slowest.duration) + '). ';
    }

    this.log('Race summary context: ' + context);

    const summaryMessage: GeminiTypes.Live.ClientContent = {
      client_content: {
        turns: [
          {
            role: 'user',
            parts: [{ text: 'You are a supportive fitness coach. Give a brief post-race summary and feedback (2-3 sentences). Be encouraging but honest. Here is the data: ' + context }]
          }
        ],
        turn_complete: true
      }
    };

    this.geminiLive.send(summaryMessage);
  }

  /**
   * Start listening for voice input (legacy push-to-talk mode)
   */
  startListening(): void {
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

  private onPushToTalkComplete(transcript: string): void {
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
  stopListening(): void {
    if (!this.isRecording) return;

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
  interruptResponse(): void {
    if (this.dynamicAudioOutput) {
      this.dynamicAudioOutput.interruptAudioOutput();
    }
    this.isAISpeaking = false;
    this.isProcessing = false;
  }

  // ── Voice Processing ───────────────────────────────────────────────────────

  private sendToGemini(userQuery: string): void {
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

    const message: GeminiTypes.Live.ClientContent = {
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

  private buildContext(): string {
    var lines: string[] = [];
    lines.push('=== Current Status ===');

    // Race state
    if (this.raceStateMachine) {
      const state = this.raceStateMachine.state;
      const elapsed = this.raceStateMachine.elapsedMs;
      const config = (this.raceStateMachine as any).currentConfig;

      lines.push('Race: ' + state);
      if (state !== 'IDLE' && state !== 'FINISHED') {
        if (config) {
          // RUNNING = heading to this exercise, STATION = doing this exercise
          var exerciseLabel = (state === 'RUNNING') ? 'Next Exercise' : 'Current Exercise';
          lines.push(exerciseLabel + ': ' + config.name);
          lines.push('How to do it: ' + config.instruction);
        }
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

  private delayedCall(seconds: number, callback: () => void): void {
    const event = this.createEvent('DelayedCallbackEvent');
    event.bind(() => {
      callback();
    });
    (event as DelayedCallbackEvent).reset(seconds);
  }

  // ── Instructions Builder ──────────────────────────────────────────────────

  private getFullInstructions(): string {
    var instructions = this.BASE_INSTRUCTIONS;

    // Add extra instructions from scene if provided
    if (this.extraInstructions && this.extraInstructions.trim().length > 0) {
      instructions += '\n\n' + this.extraInstructions.trim();
    }

    // Add voice command capabilities
    instructions += '\n\nYou can control the race with voice commands. If user asks to pause, resume, or stop the race, use the appropriate function.';

    return instructions;
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[AICoach] ' + msg);
    }
  }
}
