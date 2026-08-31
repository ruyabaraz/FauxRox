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
import { ProfileManager } from './ProfileManager';
import {
  SessionSemantics,
  semanticsFor,
  summaryPreamble,
} from './SessionSemantics';
import {
  SpeechGate,
  OUTPUT_SAMPLE_RATE,
} from './SpeechLifecycle';

import { spellDuration } from './TrainingAnalysis';

import {
  Space,
  Focus,
  ALL_SPACES,
  ALL_DURATIONS,
  ALL_FOCUSES,
  focusFitsSpace,
} from './AdaptiveSessionGenerator';

/**
 * Which surface is showing that the coach is listening.
 *
 * HUD is the coach's own indicator, on for as long as the athlete has it
 * switched on. PICKER is the session panel's, for one turn beside the
 * question it is answering. One microphone, two places it can be drawn, and
 * never both at once.
 */
export type ListeningSurface = 'HUD' | 'PICKER';

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
  @input @allowUndefined profileManager: ProfileManager;
  @ui.group_end

  // ── AI Settings ────────────────────────────────────────────────────────────

  // Base coach personality (always used, cannot be overridden by scene).
  //
  // Deliberately silent about whether this is a race or a training session.
  // Gemini Live takes the system instruction once, at connect time, and the
  // athlete has not chosen anything yet at that point - so the kind cannot
  // live here. It arrives per turn, from SessionSemantics.
  private readonly BASE_INSTRUCTIONS: string = `You are a HYROX fitness coach on AR glasses.
Keep responses SHORT (1-2 sentences) since user is exercising.
You have real-time session data, heart rate, and personal best info.
Every turn tells you the SESSION KIND. Use its words: a race is a race, a
training session is a session or a workout. Never call a training session a race,
even if the athlete does.
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

  /**
   * Who is allowed to be talking.
   *
   * Holds when the coach's own audio will have finished playing, and which
   * listening turn has already been answered. Both were missing, and the
   * coach spent a session interviewing itself.
   */
  private speech: SpeechGate = new SpeechGate();
  private shouldRestartListening: boolean = false;

  // Mute state (audio output only - AI still processes, just doesn't play sound)
  private _isMuted: boolean = false;

  // Cached cloud context (fetched async)
  private cachedCloudContext: string = '';

  // Mic pulse animation
  private micOriginalScale: vec3 = null;
  private micPulseTime: number = 0;
  private isMicPulsing: boolean = false;

  // Public getters for external state checks
  get isToggleOn(): boolean { return this._isToggleOn; }
  get isBusy(): boolean { return this.isAISpeaking || this.isProcessing || this.isRecording; }
  get isSpeaking(): boolean { return this.isAISpeaking; }
  get isMuted(): boolean { return this._isMuted; }

  /**
   * Toggle audio mute on/off (called from UI button)
   * When muted, AI still processes but audio doesn't play
   */
  toggleMute(): void {
    this._isMuted = !this._isMuted;
    this.log('Audio mute: ' + (this._isMuted ? 'ON (silent)' : 'OFF (audio enabled)'));

    // If muting while AI is speaking, interrupt current audio
    if (this._isMuted && this.isAISpeaking) {
      this.stopSpeaking();
    }
  }

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
    this.setRecordingIndicator(true);
    this.setListeningAnimation(false); // Hidden until user speaks

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
    this.speech.reset();

    // Stop ASR
    if (this.isRecording) {
      this.asrModule.stopTranscribing();
      this.isRecording = false;
    }

    // Stop animations
    this.stopMicPulse();

    // Hide indicator and wave animation
    this.setRecordingIndicator(false);
    this.setListeningAnimation(false);

    // Interrupt any AI speech
    this.stopSpeaking();

    if (this.textDisplay) {
      this.textDisplay.text = '';
    }
  }

  /**
   * Stop the coach mid-sentence and stop waiting for the rest of it.
   *
   * The only route to interruptAudioOutput. Interrupting without shortening
   * the deadline leaves the gate counting down audio that was thrown away,
   * and the coach stays deaf for the length of a sentence nobody heard.
   */
  private stopSpeaking(): void {
    if (this.dynamicAudioOutput) {
      this.dynamicAudioOutput.interruptAudioOutput();
    }
    this.speech.interrupt(getTime());
    this.isAISpeaking = false;
  }

  // ── Continuous Listening ──────────────────────────────────────────────────

  private startContinuousListening(): void {
    if (!this._isToggleOn) return;
    if (this.isRecording) return;

    this.log('Starting continuous listening...');
    this.isRecording = true;
    this.isUserSpeaking = false;

    // One listening session, one answer. The turn is opened here rather than
    // when the athlete starts speaking: an utterance short enough to arrive
    // as a single final event never raises a start, and a turn tied to the
    // start would throw it away.
    this.speech.openTurn();

    const asrSettings = AsrModule.AsrTranscriptionOptions.create();
    asrSettings.mode = AsrModule.AsrMode.HighAccuracy;
    asrSettings.silenceUntilTerminationMs = 1500; // Shorter for conversation flow

    asrSettings.onTranscriptionUpdateEvent.add((output) => {
      if (!this._isToggleOn) return;

      // Anything arriving while the coach is still audible is the coach.
      // In the editor there is no echo cancellation between the speaker and
      // the microphone, so its own voice and a real interruption are the
      // same signal - and being wrong in the other direction means the coach
      // answers itself, which is worse than making the athlete wait out a
      // sentence. The toggle and the wrist STOP button do not go through the
      // microphone and still work throughout.
      if (!this.speech.acceptsInput(getTime())) return;

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

    // Nothing to interrupt: the gate above only lets speech through once the
    // coach's audio has finished. This used to cut the coach off mid-word -
    // and since what triggered it was usually the coach itself, the fragment
    // it cut off came back as the next question.
    this.isProcessing = false;

    // Show animations
    this.startMicPulse();
    this.setListeningAnimation(true);
  }

  private onUserFinishedSpeaking(transcript: string): void {
    // Claim the turn first, before anything that can re-enter.
    //
    // stopTranscribing() can itself deliver one more final event, and the
    // same utterance was reaching Gemini twice: one "started speaking", two
    // "finished speaking", identical text, two sends. A guard set after the
    // stop call is set too late to catch that.
    if (!this.speech.claimFinal()) {
      this.log('Duplicate final for this turn - ignored');
      return;
    }

    this.log('User finished speaking');
    this.asrModule.stopTranscribing();
    this.isRecording = false;
    this.isUserSpeaking = false;

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

  // ── Who is showing the listening ────────────────────────────────────────
  //
  // Two surfaces, one microphone. The coach's own indicator belongs to the
  // HUD, where it means "the coach is on and can hear you" for the length of
  // a workout. The session panel has its own, where it means "this turn, for
  // this question" and sits beside the thing being answered.
  //
  // They are never both right. Whoever owns the turn draws it, and the other
  // one stays out of the way - which is what this is: an owner rather than a
  // caller reaching across and switching scene objects off.

  private _listeningSurface: ListeningSurface = 'HUD';

  /** True while the coach's own visuals are the ones that should be showing */
  private get ownsListeningUI(): boolean {
    return this._listeningSurface === 'HUD';
  }

  /**
   * Hand the drawing of it to somebody else, or take it back.
   *
   * Whatever is on screen right now goes with it: a surface that changes
   * hands mid-turn must not leave the old owner's indicator lit, which is the
   * duplicate this exists to prevent.
   */
  private setListeningSurface(surface: ListeningSurface): void {
    if (this._listeningSurface === surface) return;

    this._listeningSurface = surface;

    if (!this.ownsListeningUI) {
      this.clearOwnListeningUI();
      return;
    }

    // Back to the HUD, showing whatever is actually true right now.
    this.setRecordingIndicator(this._isToggleOn);
    this.setListeningAnimation(this.isUserSpeaking);
  }

  /** Everything of the coach's own, off, without claiming anything stopped */
  private clearOwnListeningUI(): void {
    if (this.recordingIndicator) this.recordingIndicator.enabled = false;
    if (this.listeningWaveAnimation) this.listeningWaveAnimation.enabled = false;

    this.isMicPulsing = false;
    if (this.micImage && this.micOriginalScale) {
      this.micImage.getTransform().setLocalScale(this.micOriginalScale);
    }
  }

  /** The coach is on and can hear you - HUD only */
  private setRecordingIndicator(on: boolean): void {
    if (!this.ownsListeningUI) return;
    if (this.recordingIndicator) this.recordingIndicator.enabled = on;
  }

  private setListeningAnimation(active: boolean): void {
    // Show/hide wave animation - only visible when user is speaking
    if (!this.ownsListeningUI) return;

    if (this.listeningWaveAnimation) {
      this.listeningWaveAnimation.enabled = active;
    }
  }

  // ── Mic Pulse Animation ────────────────────────────────────────────────────

  private startMicPulse(): void {
    if (!this.ownsListeningUI) return;
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
    this.dynamicAudioOutput.initialize(OUTPUT_SAMPLE_RATE);

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
          // Named for the session, not the race.
          //
          // The tool name is text the model reads, so calling this stopRace
          // taught it the word "race" even in a training session. The
          // descriptions also normalise the intent: the athlete's noun says
          // nothing about what is actually running - the app already knows
          // that - so "stop the race" during a workout still means stop this
          // session.
          {
            name: 'pauseSession',
            description: 'Pauses whatever is currently running - a race or a training session. Use when user says pause, hold, wait, or similar, whichever word they use for the activity.'
          },
          {
            name: 'resumeSession',
            description: 'Resumes the paused race or training session. Use when user says resume, continue, go, or similar.'
          },
          {
            name: 'stopSession',
            description: 'Stops and ends whatever is currently running - a race or a training session. Use when user says stop, end, quit, finish early, or similar. The athlete may call a training session a "race" out of habit; stop the session that is actually running.'
          },
          {
            name: 'prescribeSession',
            description: 'Build a training session for the athlete. Use after a session when they ask what to train, or when the verdict shows a clear limiter. You choose the constraints only - the app builds the actual workout from them, so never invent exercises, rep counts or distances.',
            parameters: {
              type: 'object',
              properties: {
                duration: {
                  type: 'string',
                  // The generator's own lists, not a copy of them. Two places
                  // to add a focus is how the coach came to be offering three
                  // of them while the picker offered four.
                  enum: ALL_DURATIONS as string[],
                  description: 'How long the session should be'
                },
                focus: {
                  type: 'string',
                  enum: ALL_FOCUSES as string[],
                  description: 'RUNNING for a run - intervals, threshold or an easy run - and only in a NORMAL space. ENGINE for rhythmic conditioning work, STRENGTH for loaded carries and lunges, MIXED for both'
                },
                space: {
                  type: 'string',
                  enum: ALL_SPACES as string[],
                  description: 'SMALL only if the athlete said they are short of space. Defaults to NORMAL. RUNNING is impossible in a SMALL space at any distance.'
                },
                reason: {
                  type: 'string',
                  description: 'One short line the athlete will read, e.g. "Burpees cost you the most time today."'
                }
              },
              required: ['duration', 'focus']
            }
          },
          {
            // The partial answer, kept apart from prescribeSession on
            // purpose. That one is a complete prescription and requires the
            // fields it needs; this one carries whatever the athlete actually
            // said. Requiring anything here would make the model invent the
            // rest before the app ever saw it, which is a silent default
            // moved one layer further from anywhere it could be checked.
            name: 'setSessionIntent',
            description: 'Report what the athlete just said about the session they want, while they are setting one up. Include ONLY the fields they actually said. Leave out anything they did not mention - never guess it. The app asks them for whatever is missing.',
            parameters: {
              type: 'object',
              properties: {
                space: {
                  type: 'string',
                  enum: ALL_SPACES as string[],
                  description: 'Only if they said how much room they have. SMALL is a room; NORMAL is a gym floor, a park, anywhere they can run.'
                },
                duration: {
                  type: 'string',
                  enum: ALL_DURATIONS as string[],
                  description: 'Only if they said how long they have. Roughly: SHORT is about a quarter of an hour, MEDIUM about half, FULL longer.'
                },
                focus: {
                  type: 'string',
                  enum: ALL_FOCUSES as string[],
                  description: 'Only if they said what they want to work on. RUNNING needs a NORMAL space. MIXED is also the right answer for "surprise me" or "whatever you think".'
                }
              }
            }
          },
          {
            name: 'compareWithUser',
            description: 'Compares the current user with another user by name. Use when user asks "how am I doing vs John" or "compare me to Sarah" or similar.',
            parameters: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the user to compare with'
                }
              },
              required: ['name']
            }
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
      // Play audio response (skip if muted)
      if (message?.serverContent?.modelTurn?.parts?.[0]?.inlineData?.mimeType?.startsWith('audio/pcm')) {
        this.isAISpeaking = true;
        if (!this._isMuted) {
          const b64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
          const audio = Base64.decode(b64Audio);
          this.dynamicAudioOutput.addAudioFrame(audio);

          // How long this frame will take to play. The output component is
          // started with play(-1), so isPlaying() is true from initialisation
          // onwards and cannot tell us when the coach stops - but the frame
          // is raw PCM16 at a known rate, so its byte count is its duration.
          this.speech.queueAudio(audio.length, getTime());
        }
      }

      // Handle interruption
      if (message.serverContent.interrupted) {
        this.isAISpeaking = false;
        this.stopSpeaking();
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

        // Reopen the microphone once the coach has actually stopped talking.
        //
        // turnComplete means the model finished generating; the audio it
        // generated is still in the queue and still playing. Reopening here
        // is what let the coach hear itself.
        if (this._isToggleOn && this.shouldRestartListening) {
          this.shouldRestartListening = false;
          this.delayedCall(
            this.speech.reopenDelay(getTime()),
            () => this.startContinuousListening()
          );
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

  // ── Session Semantics ─────────────────────────────────────────────────────

  /**
   * What the athlete is currently doing, in the words that belong to it.
   *
   * Pulled from the state machine rather than pushed in by it: the plan can
   * change between the picker and the finish panel, and a stale copy here
   * would be exactly the bug this module exists to kill.
   */
  private semantics(): SessionSemantics {
    var rsm = this.raceStateMachine as any;
    var kind = rsm && rsm.sessionKind ? rsm.sessionKind : 'RACE';
    return semanticsFor(kind);
  }

  // ── Function Call Handlers ─────────────────────────────────────────────────

  private handleFunctionCall(name: string, args: any): void {
    this.log('Function call: ' + name);

    if (!this.raceStateMachine) {
      this.log('RaceStateMachine not connected');
      this.sendFunctionResponse(name, 'Session controller not available');
      return;
    }

    const rsm = this.raceStateMachine as any;

    // What is actually running, in the words that belong to it. The engine
    // method names stay as they are - renaming those buys nothing and risks
    // a regression - but everything the model reads back is in the right
    // vocabulary.
    const words = this.semantics();
    const noun = words.noun;

    switch (name) {
      // The old race-named tools are kept as aliases. A live session that was
      // set up before this change still has the old schema in flight, and a
      // dropped function call would leave the athlete's "stop" unanswered.
      // Whether a command is possible is the state machine's judgement, not a
      // list of state names kept in sync by hand here. The list was wrong:
      // it left out APPROACHING_STATION, so an athlete walking up to a
      // station asked to stop and was told the session could not be stopped.
      case 'pauseSession':
      case 'pauseRace':
        if (rsm.isPausable) {
          rsm.pauseSession();
          this.sendFunctionResponse(name, words.nounTitle + ' paused');
          this.log(words.nounTitle + ' paused via voice command');
        } else if (rsm.isPaused) {
          this.sendFunctionResponse(name, 'Already paused');
        } else {
          this.sendFunctionResponse(name, 'Nothing to pause - no ' + noun + ' is running');
        }
        break;

      case 'resumeSession':
      case 'resumeRace':
        if (rsm.isPaused) {
          rsm.resumeSession();
          this.sendFunctionResponse(name, words.nounTitle + ' resumed');
          this.log(words.nounTitle + ' resumed via voice command');
        } else if (rsm.isUnderway) {
          this.sendFunctionResponse(name, 'Already running');
        } else {
          this.sendFunctionResponse(name, 'Nothing to resume - no ' + noun + ' is running');
        }
        break;

      case 'stopSession':
      case 'stopRace':
        if (rsm.isUnderway) {
          rsm.stopRace();
          this.sendFunctionResponse(name, words.nounTitle + ' stopped');
          this.log(words.nounTitle + ' stopped via voice command');
        } else {
          this.sendFunctionResponse(name, 'Nothing to stop - no ' + noun + ' is running');
        }
        break;

      case 'prescribeSession':
        this.handlePrescribeSession(args);
        break;

      case 'setSessionIntent':
        this.handleSetSessionIntent(args);
        break;

      case 'compareWithUser':
        this.handleCompareWithUser(args?.name || '');
        break;

      default:
        this.log('Unknown function: ' + name);
        this.sendFunctionResponse(name, 'Unknown command');
    }
  }

  /**
   * The coach prescribes by choosing parameters, never by writing a workout.
   *
   * Everything it sends is validated against the same closed sets the picker
   * offers, so a hallucinated exercise name or a request for 500 reps cannot
   * reach the athlete - the worst case is a sensible default. The session is
   * then built by the generator that the test suite covers.
   */
  private handlePrescribeSession(args: any): void {
    if (!this.onPrescribeCallback) {
      this.sendFunctionResponse('prescribeSession', 'Session picker not available');
      return;
    }

    var duration = this.oneOf(args?.duration, ALL_DURATIONS, 'MEDIUM');
    var focus = this.oneOf(args?.focus, ALL_FOCUSES, 'MIXED');
    var space = this.oneOf(args?.space, ALL_SPACES, 'NORMAL');

    // A room is a fact, not a preference. Where it cannot hold what was
    // asked for, nothing is prescribed and nothing is substituted: quietly
    // handing somebody engine work when they asked to run is the app
    // deciding for them, and they would find out by doing it.
    if (!focusFitsSpace(focus as Focus, space as Space)) {
      this.log('Refusing ' + focus + ' in a ' + space + ' space');
      this.sendFunctionResponse(
        'prescribeSession',
        'Not prescribed: ' + focus.toLowerCase() + ' needs more room than a ' +
        space.toLowerCase() + ' space. Tell the athlete running needs space in ' +
        'one short line, and ask what they would like instead.');
      return;
    }

    var reason = typeof args?.reason === 'string' ? args.reason.trim() : '';
    if (reason.length > 90) reason = reason.substring(0, 90);

    this.log('Prescribing: ' + space + ' / ' + duration + ' / ' + focus);
    this.onPrescribeCallback(space, duration, focus, reason);

    this.sendFunctionResponse(
      'prescribeSession',
      'Session ready and shown to the athlete: ' + duration + ' ' + focus +
      ' in a ' + space.toLowerCase() + ' space. Tell them briefly what it is and that they can start it.'
    );
  }

  /**
   * Part of an answer, from an athlete who is being asked.
   *
   * Nothing is filled in. A field the athlete did not mention arrives empty
   * and stays empty: the picker holds what was said and asks for the rest,
   * which is the whole difference between listening to somebody and guessing
   * at them.
   */
  private handleSetSessionIntent(args: any): void {
    if (!this.onSessionIntentCallback) {
      this.sendFunctionResponse('setSessionIntent', 'Session picker not open');
      return;
    }

    var space = this.oneOfOrNothing(args?.space, ALL_SPACES);
    var duration = this.oneOfOrNothing(args?.duration, ALL_DURATIONS);
    var focus = this.oneOfOrNothing(args?.focus, ALL_FOCUSES);

    if (!space && !duration && !focus) {
      this.sendFunctionResponse(
        'setSessionIntent',
        'Nothing usable in that. Ask them again in one short line.');
      return;
    }

    this.log('Heard: ' + (space || '-') + ' / ' + (duration || '-') + ' / ' +
             (focus || '-'));

    // What the picker says back is what is still missing, which is what the
    // coach should ask about next - one question, and only if there is one.
    var reply = this.onSessionIntentCallback(space, duration, focus);
    this.sendFunctionResponse('setSessionIntent', reply);
  }

  private onSessionIntentCallback:
    (space: string, duration: string, focus: string) => string = null;

  /**
   * Called by the picker while it is open, and cleared when it closes.
   *
   * The callback answers with what is still missing, so the loop is: the
   * athlete says something, the app holds it, and the coach is told what to
   * ask about next. Nothing here decides what a session is.
   */
  onSessionIntent(
    callback: (space: string, duration: string, focus: string) => string
  ): void {
    this.onSessionIntentCallback = callback;
  }

  /** A value the app understands, or nothing at all - never a fallback */
  private oneOfOrNothing(value: any, allowed: string[]): string {
    if (typeof value !== 'string') return '';

    var upper = value.toUpperCase().trim();
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === upper) return upper;
    }

    return '';
  }

  /** Accept a value only if it is one the app actually understands */
  private oneOf(value: any, allowed: string[], fallback: string): string {
    if (typeof value !== 'string') return fallback;

    var upper = value.toUpperCase().trim();
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === upper) return upper;
    }

    this.log('Ignoring unknown value "' + value + '", using ' + fallback);
    return fallback;
  }

  private onPrescribeCallback: (space: string, duration: string, focus: string, reason: string) => void = null;

  /** Called by RaceStateMachine so a prescription can reach the picker */
  onPrescribeSession(
    callback: (space: string, duration: string, focus: string, reason: string) => void
  ): void {
    this.onPrescribeCallback = callback;
  }

  private async handleCompareWithUser(targetName: string): Promise<void> {
    if (!targetName || targetName.length === 0) {
      this.sendFunctionResponse('compareWithUser', 'No name provided');
      return;
    }

    if (!this.cloudManager) {
      this.sendFunctionResponse('compareWithUser', 'Cloud not available');
      return;
    }

    this.log('Searching for user: ' + targetName);

    try {
      const targetRace = await this.cloudManager.searchUserByName(targetName);

      if (!targetRace) {
        this.sendFunctionResponse('compareWithUser', 'No user found with name "' + targetName + '" in leaderboard');
        return;
      }

      // Get current user's PB for comparison
      const myPB = await this.cloudManager.getPersonalBest();

      var response = 'Found ' + targetRace.displayName + ' with best time: ' + (targetRace.totalTime / 1000).toFixed(1) + 's.';

      if (myPB) {
        var diff = myPB.totalTime - targetRace.totalTime;
        if (diff < 0) {
          response += ' You are ' + (Math.abs(diff) / 1000).toFixed(1) + 's FASTER than them!';
        } else if (diff > 0) {
          response += ' They are ' + (diff / 1000).toFixed(1) + 's faster than you.';
        } else {
          response += ' You are tied!';
        }
      } else {
        response += ' Complete a race to compare your time.';
      }

      this.sendFunctionResponse('compareWithUser', response);
    } catch (e) {
      this.log('Compare error: ' + e);
      this.sendFunctionResponse('compareWithUser', 'Error searching for user');
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
   * Speak the summary when a session ends.
   *
   * Says nothing about a race unless one was actually run: the opening
   * clause, the kind of summary requested and the personal-best comparison
   * all come from the session's own semantics.
   */
  speakSessionSummary(raceData: {
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

    const words = this.semantics();

    // Build summary context. The kind goes first: the system instruction was
    // sent at connect time, before the athlete chose anything, so this is the
    // only place the model can learn what it is talking about.
    let context = words.aiContext + '\n';
    // Spelled out rather than as a clock. "0:48" has no units in it, and the
    // model read a forty-eight second session back to the athlete as
    // forty-eight minutes - which is not carelessness on its part, since
    // nothing in the sentence said which.
    context += words.summaryOpening + spellDuration(raceData.totalTime) + '. ';

    // Compare to PB - a race concept. A training session has no time to beat,
    // and offering one invites the model to invent a competition.
    if (words.countsForRanking && raceData.pbTime > 0) {
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

    // Where the time actually went.
    //
    // Prefer the verdict from RaceResultsController: it measures each split
    // against what was expected of it, so a station that is naturally long is
    // not mistaken for a weakness. Raw fastest/slowest is only a fallback for
    // when no verdict exists - a training session, or analysis unavailable.
    if (this.raceVerdictContext) {
      context += '\n' + this.raceVerdictContext + '\n';
    } else if (words.countsForRanking && raceData.splits.length > 0) {
      let slowest = raceData.splits[0];
      let fastest = raceData.splits[0];
      for (const split of raceData.splits) {
        if (split.duration > slowest.duration) slowest = split;
        if (split.duration < fastest.duration) fastest = split;
      }
      context += 'Longest split: ' + slowest.name + ' (' + formatTime(slowest.duration) + '). ';
      context += 'Shortest split: ' + fastest.name + ' (' + formatTime(fastest.duration) + '). ';
      context += 'Note: these are raw durations, not a judgement of performance. ';
    } else if (!words.countsForRanking) {
      // Never the raw fastest-and-slowest for a workout. Every split in one
      // is measuring something different - a prescribed hold, a deliberately
      // easy warm-up drill, a ladder round with its own rep count - so the
      // ranking has no shared axis and the model would read the longest one
      // as a weakness. Silence here is the honest answer; TrainingAnalysis
      // fills it when there is something real to say.
      context += 'No comparable measurements were recorded. Do not comment on ' +
                 'how fast or slow anything was. Acknowledge the work and stop there. ';
    }

    this.log(words.summaryKind + ' summary context: ' + context);

    const summaryMessage: GeminiTypes.Live.ClientContent = {
      client_content: {
        turns: [
          {
            role: 'user',
            parts: [{ text: summaryPreamble(words) + context }]
          }
        ],
        turn_complete: true
      }
    };

    this.geminiLive.send(summaryMessage);
  }

  // ── A turn the picker asked for ──────────────────────────────────────────
  //
  // The athlete pressed a microphone on the session panel, which is not the
  // same thing as turning the coach on. It is one turn, for one purpose, and
  // when it is over the coach goes back to being however it was found.

  /** True when listening was started by the picker rather than by the athlete */
  private _borrowedMic: boolean = false;

  /**
   * Listen, because the panel asked.
   *
   * The microphone, the turn-taking and the model are the same ones the HUD
   * uses - there is one coach. What changes hands is only which surface draws
   * the listening, because the panel's indicator sits beside the question
   * being answered and the HUD's sits wherever the HUD is. Two of them lit at
   * once would be the app saying the same thing twice in two places.
   *
   * Where the coach is already on, nothing is taken over except that
   * drawing, and it is handed straight back afterwards - the athlete had it
   * listening and it stays that way. Where it was off, it is turned on for
   * this and turned off after.
   *
   * @returns false when there is no way to listen, so the panel can say so
   *          rather than showing a microphone that does nothing
   */
  beginSessionTurn(surface?: ListeningSurface): boolean {
    if (!this.isSessionReady) {
      this.log('Session turn refused - coach not connected');
      return false;
    }

    this.setListeningSurface(surface || 'PICKER');

    if (this._isToggleOn) return true;

    this._borrowedMic = true;
    this.activateToggleMode();
    return true;
  }

  /**
   * Give it back the way it was found.
   *
   * The surface first, so that a coach the athlete had switched on shows its
   * own indicator again the moment the panel stops drawing one - and a coach
   * that was off is turned off with nothing of the panel's left lit.
   */
  endSessionTurn(): void {
    var borrowed = this._borrowedMic;
    this._borrowedMic = false;

    this.setListeningSurface('HUD');

    if (borrowed) this.deactivateToggleMode();
  }

  /** Which surface is currently drawing the listening */
  get listeningSurface(): ListeningSurface {
    return this._listeningSurface;
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

    this.setRecordingIndicator(true);

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
      this.setRecordingIndicator(false);
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
      this.setRecordingIndicator(false);
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
    this.setRecordingIndicator(false);

    this.log('Cancelled');
  }

  /**
   * Interrupt AI voice
   */
  interruptResponse(): void {
    this.stopSpeaking();
    this.isAISpeaking = false;
    this.isProcessing = false;
  }

  // ── Form Feedback (called by RaceStateMachine) ─────────────────────────────

  /**
   * Speak a short form reminder for the current exercise.
   * Called by RaceStateMachine when user's form needs correction.
   */
  speakFormReminder(exerciseName: string): void {
    if (!this.geminiLive || !this.isSessionReady) {
      this.log('Cannot speak form reminder - Gemini not ready');
      return;
    }

    if (this.isBusy) {
      this.log('Cannot speak form reminder - AI is busy');
      return;
    }

    // Send a system-style prompt for a very short form cue
    const prompt = '[SYSTEM: Give a 3-5 word form reminder for ' + exerciseName + '. Be encouraging. Example: "Get lower!" or "Deeper lunges!"]';

    this.log('Speaking form reminder for: ' + exerciseName);
    this.sendFormCue(prompt);
  }

  private sendFormCue(cuePrompt: string): void {
    if (!this.geminiLive) return;

    this.isProcessing = true;

    const message: GeminiTypes.Live.ClientContent = {
      client_content: {
        turns: [
          {
            role: 'user',
            parts: [{ text: cuePrompt }]
          }
        ],
        turn_complete: true
      }
    };

    this.geminiLive.send(message);
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

  /**
   * The verdict for the last finished race, already computed by
   * RaceResultsController. Narrate it - never recompute it.
   */
  private raceVerdictContext: string = '';

  /**
   * True when the analysis in raceVerdictContext is the training one.
   *
   * Kept separately from the session kind because the two can disagree for a
   * moment: the panel opens with the kind already switched but the context
   * from the session that just ended.
   */
  private analysisIsTraining: boolean = false;

  /** Called by RaceStateMachine once the results layer has a verdict */
  setSessionAnalysisContext(context: string): void {
    this.raceVerdictContext = context || '';
    this.analysisIsTraining = this.raceVerdictContext.indexOf('SESSION SHAPE:') === 0;
    this.log(this.raceVerdictContext
      ? (this.analysisIsTraining ? 'Training analysis received' : 'Race verdict received')
      : 'Session analysis cleared');
  }

  private buildContext(): string {
    var lines: string[] = [];

    // User profile section
    if (this.profileManager && this.profileManager.hasProfile()) {
      lines.push('=== User Profile ===');
      lines.push(this.profileManager.getAIContextString());
      lines.push('');
    }

    lines.push('=== Current Status ===');

    // What this is, before anything about how it is going. Every turn carries
    // it, because the system instruction could not.
    var words = this.semantics();
    var rsmAny = this.raceStateMachine as any;
    lines.push(words.aiContext);

    // Session state
    if (this.raceStateMachine) {
      const state = this.raceStateMachine.state;
      const elapsed = this.raceStateMachine.elapsedMs;
      const config = (this.raceStateMachine as any).currentConfig;

      lines.push(words.nounTitle + ': ' + state);
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

    // Heart rate with zone info
    if (this.heartRateTracker && this.heartRateTracker.isConnected) {
      var currentBPM = this.heartRateTracker.currentBPM;
      var zoneName = this.heartRateTracker.getZoneName(this.heartRateTracker.currentZone);
      var maxHR = this.profileManager ? this.profileManager.getMaxHeartRate() : 190;
      var pct = Math.round((currentBPM / maxHR) * 100);

      lines.push('HR: ' + currentBPM + ' BPM (' + pct + '% of max)');
      lines.push('Zone: ' + this.heartRateTracker.currentZone + ' - ' + zoneName);
      lines.push('Avg HR: ' + this.heartRateTracker.avgBPM + ' BPM');
      lines.push('Peak HR: ' + this.heartRateTracker.peakBPM + ' BPM');
    }

    // What this session has actually shown, so far.
    //
    // Without it the only per-station numbers in front of the model are the
    // personal-best splits of past races, and it answers "which station is
    // worst for me right now?" with a movement the athlete has not done
    // today. Measured beats remembered, and when nothing has been measured
    // yet this says so in as many words.
    var live = rsmAny && rsmAny.liveTrainingContext ? rsmAny.liveTrainingContext : '';
    if (live) {
      lines.push('');
      lines.push('=== This Session So Far ===');
      lines.push(live);
    }

    // Cloud data
    if (this.cachedCloudContext) {
      lines.push('');
      lines.push('=== Past Races (NOT this session) ===');
      lines.push(this.cachedCloudContext);

      // The label alone is not enough: these are the only per-station splits
      // in the whole context, so a question about now lands on them unless
      // the boundary is stated outright.
      lines.push(
        'These times are from earlier races and describe nothing about what ' +
        'the athlete is doing at this moment. Never answer a question about ' +
        'right now, today or this session from them. If asked which station ' +
        'is going badly and this session has measured nothing yet, say that ' +
        'plainly - do not reach back for a station from these.'
      );
    }

    // Coach's Verdict — the numbers are already worked out, so the model only
    // has to phrase them. Placed last so it is closest to the user's question.
    if (this.raceVerdictContext) {
      lines.push('');
      lines.push(this.raceVerdictContext);
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

    // Add personalization based on user profile
    if (this.profileManager && this.profileManager.hasProfile()) {
      var tone = this.profileManager.getCoachingTone();
      var goal = this.profileManager.getGoal();
      var name = this.profileManager.getDisplayName();

      instructions += '\n\nPRESCRIBING:';
      instructions += '\n- After a session, if they ask what to train or the verdict names a limiter, call prescribeSession.';
      instructions += '\n- Choose duration, focus and space only. Never list exercises, reps or distances yourself - the app builds those.';
      instructions += '\n- A slow station under high cardiovascular load suggests ENGINE; one without it suggests STRENGTH.';
      instructions += '\n- RUNNING needs a NORMAL space. Never prescribe it in a SMALL one - say running needs room and ask what they want instead.';
      instructions += '\n- While they are setting a session up, call setSessionIntent with ONLY what they said. Do not guess the rest; the app asks for it.';
      instructions += '\n- After setSessionIntent, ask at most one short question about what it says is missing, then stop.';

      instructions += '\n\nPERSONALIZATION:';
      instructions += '\n- User name: ' + name + ' (use their name occasionally)';

      // Tone adjustment
      switch (tone) {
        case 'encouraging':
          instructions += '\n- Coaching style: Be extra supportive and encouraging. Break down exercises simply. Celebrate small wins. User is a beginner.';
          break;
        case 'competitive':
          instructions += '\n- Coaching style: Be direct and push harder. Challenge the user. Use competitive language. User is an athlete.';
          break;
        default:
          instructions += '\n- Coaching style: Balanced - supportive but push when appropriate.';
      }

      // Goal-specific guidance
      switch (goal) {
        case 'finish_strong':
          instructions += '\n- Goal focus: Help them pace to finish confidently. Encourage consistency over speed.';
          break;
        case 'beat_pb':
          instructions += '\n- Goal focus: Push for personal best. Reference their PB times when available. Motivate to beat it.';
          break;
        case 'max_effort':
          instructions += '\n- Goal focus: All-out performance. Push hard every station. No holding back.';
          break;
        case 'pacing':
          instructions += '\n- Goal focus: Teach pacing strategy. Explain when to conserve and when to push.';
          break;
      }
    }

    // Add extra instructions from scene if provided
    if (this.extraInstructions && this.extraInstructions.trim().length > 0) {
      instructions += '\n\n' + this.extraInstructions.trim();
    }

    // Add voice command capabilities
    instructions += '\n\nYou can control the session with voice commands. If the user asks to pause, resume, or stop - whatever noun they use for it - call the matching function.';

    // Add HR zone coaching
    instructions += '\n\nHR ZONE COACHING:';
    instructions += '\n- Zone 1-2 (under 70%): "Good warm-up pace" or "You can push harder"';
    instructions += '\n- Zone 3 (70-80%): "Solid aerobic effort, sustainable pace"';
    instructions += '\n- Zone 4 (80-90%): "Strong effort! This is race pace"';
    instructions += '\n- Zone 5 (90%+): "Max effort! Only sustainable for short bursts. Recover soon."';
    instructions += '\nProactively mention HR zones during running segments. If user is in Zone 5 too long, suggest pacing down.';

    return instructions;
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[AICoach] ' + msg);
    }
  }
}
