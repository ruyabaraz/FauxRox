// ============================================================================
// AICoach.ts — Push-to-Talk AI Assistant for HYROX (Voice Response)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Features:
// - Push-to-talk voice input via ASR
// - Gemini Live for voice responses
// - Context-aware (race state, heart rate, friend data)
// ============================================================================

import { Gemini } from 'RemoteServiceGateway.lspkg/HostedExternal/Gemini';
import { GeminiTypes } from 'RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes';
import { DynamicAudioOutput } from 'RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput';
import { RaceStateMachine } from './RaceStateMachine';
import { HeartRateTracker } from './HeartRateTracker';
import { CloudManager } from './CloudManager';

@component
export class AICoach extends BaseScriptComponent {

  // ── Setup (same as ExampleGeminiLive) ──────────────────────────────────────

  @ui.separator
  @ui.label('Push-to-talk AI Coach with voice responses')
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

  @ui.separator
  @ui.group_start('AI Settings')
  @input
  @widget(new TextAreaWidget())
  instructions: string = `You are a HYROX fitness coach on AR glasses.
Keep responses SHORT (1-2 sentences) since user is exercising.
You have real-time race data, heart rate, and friend info.
Be encouraging but direct. Focus on actionable advice.`;

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
  @input debugPrint: boolean = true;
  @ui.group_end

  // ── State ──────────────────────────────────────────────────────────────────

  private asrModule: AsrModule = require('LensStudio:AsrModule');
  private geminiLive: any = null;
  private isRecording: boolean = false;
  private isProcessing: boolean = false;
  private isSessionReady: boolean = false;
  private completedTextDisplay: boolean = true;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    this.log('AICoach initialized');

    if (this.recordingIndicator) {
      this.recordingIndicator.enabled = false;
    }

    // Initialize on start
    this.createEvent('OnStartEvent').bind(() => {
      this.initGeminiLive();
    });
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
      if (this.textDisplay) {
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

    const sessionSetup: GeminiTypes.Live.Setup = {
      setup: {
        model: 'models/gemini-2.0-flash-live-preview-04-09',
        generation_config: generationConfig,
        system_instruction: {
          parts: [{ text: this.instructions }]
        },
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
        const b64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
        const audio = Base64.decode(b64Audio);
        this.dynamicAudioOutput.addAudioFrame(audio);
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
        this.log('AI response complete');
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start listening for voice input (call from wrist menu button)
   */
  startListening(): void {
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

    if (this.recordingIndicator) {
      this.recordingIndicator.enabled = true;
    }

    if (this.textDisplay) {
      this.textDisplay.text = 'Listening...';
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
  stopListening(): void {
    if (!this.isRecording) return;

    this.asrModule.stopTranscribing();
    this.isRecording = false;

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
    this.isProcessing = false;
  }

  // ── Voice Processing ───────────────────────────────────────────────────────

  private onVoiceInputComplete(transcript: string): void {
    this.isRecording = false;
    this.asrModule.stopTranscribing();

    if (this.recordingIndicator) {
      this.recordingIndicator.enabled = false;
    }

    if (!transcript || transcript.trim().length === 0) {
      if (this.textDisplay) {
        this.textDisplay.text = 'Didn\'t hear anything.';
      }
      return;
    }

    this.log('User: ' + transcript);
    this.sendToGemini(transcript);
  }

  private sendToGemini(userQuery: string): void {
    if (!this.geminiLive || !this.isSessionReady) {
      this.log('Gemini not ready');
      return;
    }

    this.isProcessing = true;
    this.completedTextDisplay = true;

    if (this.textDisplay) {
      this.textDisplay.text = '...';
    }

    // Build context
    const context = this.buildContext();
    const fullPrompt = context + '\n\nUser: ' + userQuery;

    this.log('Sending to Gemini...');

    // Send as text (Gemini will respond with voice)
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

    return lines.join('\n');
  }

  // ── Debug ──────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[AICoach] ' + msg);
    }
  }
}
