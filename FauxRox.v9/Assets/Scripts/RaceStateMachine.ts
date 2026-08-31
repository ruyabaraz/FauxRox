// ============================================================================
// RaceStateMachine.ts — FauxRox Core Game Loop (HR Edition)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC follow-the-runner system with Heart Rate monitoring:
// - Stations spawn in front of player when run distance completes
// - Real-time heart rate display from BLE HR monitor
// - Camera-based distance tracking (no GPS)
// ============================================================================

import { StationMode, StationConfig, MotionType } from "./CourseManager";
import { HeartRateTracker, HRConnectionState, HRZone } from "./HeartRateTracker";
import { HandZoneDetector } from "./HandZoneDetector";
import { BLEConnectionUI } from "./BLEConnectionUI";
import { CloudManager, RaceRecord, SplitData } from "./CloudManager";
import { AICoach } from "./AICoach";
import { ProfileManager } from "./ProfileManager";
import { OnboardingUI } from "./OnboardingUI";
import { RunArrowGuide } from "./RunArrowGuide";
import { LeaderboardController } from "./LeaderboardController";
import { RaceResult, RaceSplit, makeRaceResult, makeRaceSplit } from "./RaceResult";
import { RaceResultsController } from "./RaceResultsController";
import {
  SessionSemantics,
  semanticsFor,
  finishTitle,
  isSessionUnderway,
  isSessionPausable,
  isSessionPaused,
} from "./SessionSemantics";
import { effortCueFor } from "./EffortCue";
import { RunningArchetype, RUNNING_TOPOLOGY } from "./RunningArchetype";
import { PathTracker } from "./PathTracker";
import { MovingClock } from "./MovingClock";
import { PaceMeter } from "./PaceMeter";
import {
  PaceTarget,
  formatPaceBand,
  formatPace,
} from "./PaceTarget";
import { SessionEligibility, eligibilityOf } from "./SessionEligibility";
import { Focus } from "./AdaptiveSessionGenerator";

import {
  EffortRecord,
  TrainingSummary,
  analyseTraining,
  raceRunSamples,
  runObservations,
  trainingAiContext,
  headlineFinding,
  shapeLine,
} from "./TrainingAnalysis";
import { SessionPickerUI } from "./SessionPickerUI";
import {
  isStationary,
  isRestStation,
  isRunOnlyStation,
  archetypeOf,
  RunPrescription,
  RunResult,
  hasRun,
  runMetresOf,
  runSecondsOf,
  runPaceSecPerKm,
  measuredPaceSecPerKm,
  formatRunClock,
  phaseAt,
  SessionBlock,
} from "./SessionTypes";

import {
  blockIntroCard,
  blockEyebrow,
  blockLines,
  workingPositionOf,
  introBody,
  introOpacity,
  worthIntroducing,
} from "./BlockIntro";
import { extractMovements } from "./TrainingHistory";

enum RaceState {
  IDLE        = 'IDLE',
  COUNTDOWN   = 'COUNTDOWN',
  RUNNING     = 'RUNNING',      // Running to reach distance target
  APPROACHING_STATION = 'APPROACHING_STATION',  // Walking to station gate
  APPROACHING_FINISH = 'APPROACHING_FINISH',    // Walking to finish gate
  STATION     = 'STATION',      // At workout station
  PAUSED      = 'PAUSED',
  FINISHED    = 'FINISHED',
}

@component
export class RaceStateMachine extends BaseScriptComponent {

  // ── References ────────────────────────────────────────────────────────────

  @input courseManagerScript: ScriptComponent;
  @input courseSetupScript: ScriptComponent;
  @input @allowUndefined heartRateTracker: HeartRateTracker;
  @input @allowUndefined bleConnectionUI: BLEConnectionUI;
  @input @allowUndefined heartRateHUD: SceneObject;  // Entire HR section - disabled if user says NO
  @input handZoneDetector: HandZoneDetector;
  @input camera: SceneObject;  // For player position and forward direction

  /** Arrow guide for run segments */
  @input @allowUndefined runArrowGuide: RunArrowGuide;

  /** Cloud manager for saving race data */
  @input @allowUndefined cloudManager: CloudManager;

  /** AI Coach reference - for checking if AI is speaking before playing SFX */
  @input @allowUndefined aiCoach: AICoach;

  // ── Onboarding References ───────────────────────────────────────────────

  /** Profile manager for user profile data */
  @input @allowUndefined profileManager: ProfileManager;

  /** Onboarding UI for first-launch profile setup */
  @input @allowUndefined onboardingUI: OnboardingUI;

  /**
   * Session picker. Optional: with nothing assigned the Lens keeps its
   * original behaviour and goes straight from the heart rate prompt to
   * calibration, running the full race.
   */
  @input @allowUndefined sessionPicker: SessionPickerUI;

  // ── UI Elements ───────────────────────────────────────────────────────────

  @input statusText: Text;
  @input timerText: Text;
  @input @allowUndefined timerBG: SceneObject;  // Parent of timerText - enable/disable this
  @input stationInfoText: Text;
  @input @allowUndefined countdownText: Text;   // Separate text for 3-2-1 countdown

  /** Countdown sound effects */
  @input @allowUndefined countdownBeepSound: AudioComponent;  // Plays ONCE at countdown start (SFX contains all beeps)
  @input @allowUndefined countdownGoSound: AudioComponent;    // Plays on GO!
  @input @allowUndefined instructionText: Text;

  /** Title image (FauxRox logo) - fades out after display */
  @input @allowUndefined titleImage: Image;

  /** Heart rate display text */
  @input @allowUndefined heartRateText: Text;

  /** HR zone indicator text */
  @input @allowUndefined hrZoneText: Text;

  /** HR connection status text - shown before race starts */
  @input @allowUndefined hrStatusText: Text;

  /** HR connected icon (beating heart) - shown instead of text when connected */
  @input @allowUndefined hrConnectedIcon: SceneObject;

  /** Station name text - displays current station name during workout */
  @input @allowUndefined stationNameText: Text;

  /** Station info background - synced with stationInfoText visibility */
  @input @allowUndefined stationInfoBG: SceneObject;

  /** Next station text - displays upcoming station name */
  @input @allowUndefined nextStationText: Text;

  /** Progress text - displays distance or rep count */
  @input @allowUndefined progressText: Text;

  /** Visual progress bar (from Orthographic Camera package) */
  @input @allowUndefined progressBar: ScriptComponent;

  /** Start button object - hidden after race starts */
  @input @allowUndefined startButtonObject: SceneObject;

  /** SkiErg motion guide animations - enabled only during SkiErg station */
  @input @allowUndefined skiergGuides: SceneObject;

  // ── Form Feedback Audio ────────────────────────────────────────────────────

  /** Audio cue for form reminder ("Get lower!", etc.) */
  @input @allowUndefined formReminderSound: AudioComponent;

  /** Audio cue for good form acknowledgment */
  @input @allowUndefined goodFormSound: AudioComponent;

  /** +1 Rep popup prefab - spawns on each good burpee rep */
  @input @allowUndefined repPopupPrefab: ObjectPrefab;

  // ── Finish Panel UI ─────────────────────────────────────────────────────────

  /** Finish panel container - shown on race finish/stop */
  @input @allowUndefined finishPanel: SceneObject;

  /** Finish status text - "FINISHED!" or "STOPPED" */
  @input @allowUndefined finishStatusText: Text;

  /** Finish total time text - large, prominent */
  @input @allowUndefined finishTotalTimeText: Text;

  /** PB Badge container - only shown when new PB achieved */
  @input @allowUndefined finishPBBadge: SceneObject;

  /** PB difference text - e.g. "-0:32" */
  @input @allowUndefined finishPBText: Text;

  /** Finish average HR text */
  @input @allowUndefined finishAvgHRText: Text;

  /** Finish peak HR text */
  @input @allowUndefined finishPeakHRText: Text;

  /** Which part of the session is running, e.g. "WARM-UP · A SKIPS + ..." */
  @input @allowUndefined blockLabelText: Text;

  /** How far in front of the athlete a training session is set up, cm */
  @input trainingZoneDistance: number = 180;

  /** "BLOCK 2/4   ROUND 3/5" — training progress, never a station count */
  @input @allowUndefined blockProgressText: Text;

  // ── Block intro ─────────────────────────────────────────────────────────
  //
  // What is coming, said once, before it starts. The movement list used to
  // sit in the middle of the view for as long as the block lasted; the
  // content was right and the timing was wrong. An athlete needs to know what
  // a set holds before it begins, and after that they need the space.
  //
  // Every field is optional. With none of them wired the panel behaves the
  // way it did - the whole label on the block line, and it stays.

  /** The card, shown and hidden as one */
  @input @allowUndefined blockIntroGroup: SceneObject;
  /** 'WARM-UP · BLOCK 1/4' */
  @input @allowUndefined blockIntroEyebrowText: Text;
  /** The movements, one per line */
  @input @allowUndefined blockIntroBodyText: Text;
  /** '4 ROUNDS · 3 MOVES · ~6 MIN' */
  @input @allowUndefined blockIntroFooterText: Text;
  /** 'Get ready', or how the running should feel */
  @input @allowUndefined blockIntroCueText: Text;

  /**
   * Something behind the card, so the text is read against a surface rather
   * than against a gym.
   *
   * A UIKit RoundedRectangle, or anything else that exposes a background
   * colour. It fades with the rest of the card: a panel that stays a beat
   * after its own text has gone is a rectangle floating in the room.
   */
  @input @allowUndefined blockIntroBackground: ScriptComponent;

  /** Split Insights - Fastest station text */
  @input @allowUndefined finishFastestText: Text;

  /** Split Insights - Needs work station text */
  @input @allowUndefined finishNeedsWorkText: Text;

  /** Race Again button - primary action */
  @input @allowUndefined finishRaceAgainButton: ScriptComponent;

  /** View Splits button - secondary action */
  @input @allowUndefined finishViewSplitsButton: ScriptComponent;

  /** View Leaderboard button - opens leaderboard panel */
  @input @allowUndefined finishViewLeaderboardButton: ScriptComponent;

  /** Leaderboard controller - handles leaderboard panel */
  @input @allowUndefined leaderboardController: LeaderboardController;

  /** Reset button on finish panel (legacy, can use finishRaceAgainButton instead) */
  @input @allowUndefined finishResetButton: ScriptComponent;

  // ── Splits Panel UI (separate from Finish Panel) ─────────────────────────────

  /** Splits panel container - separate panel shown when VIEW SPLITS pressed */
  @input @allowUndefined splitsPanel: SceneObject;

  /** Splits panel status text - "FINISHED!" or "STOPPED" */
  @input @allowUndefined splitsStatusText: Text;

  /** Splits panel time text - total race time */
  @input @allowUndefined splitsTimeText: Text;

  /** Splits panel list text - all split details */
  @input @allowUndefined splitsListText: Text;

  /** Splits panel Race Again button */
  @input @allowUndefined splitsRaceAgainButton: ScriptComponent;

  /** Splits panel Go Back button - returns to finish panel */
  @input @allowUndefined splitsGoBackButton: ScriptComponent;

  // ── Settings ──────────────────────────────────────────────────────────────

  @input countdownSeconds: number = 3;

  // ── Accessors ─────────────────────────────────────────────────────────────

  private cm(): any { return this.courseManagerScript as any; }
  private setup(): any { return this.courseSetupScript as any; }
  private camTransform: Transform = null;

  /**
   * The completion layer. Built lazily because it reads other components that
   * are not guaranteed to exist at onAwake time.
   *
   * This state machine produces an immutable RaceResult and hands it over -
   * it never interprets one. Everything that reads a verdict reads it from
   * here, so the finish panel and the coach cannot disagree.
   */
  private results(): RaceResultsController {
    if (!this._results) {
      this._results = new RaceResultsController({
        getHistory: () => this.cloudManager
          ? (this.cloudManager as any).getCachedHistory()
          : [],
        getModelBaselines: () => {
          var course = this.cm();
          return course && course.buildModelBaselines
            ? course.buildModelBaselines()
            : {};
        },
        getDisplayNames: () => {
          var course = this.cm();
          return course && course.getDisplayNameMap
            ? course.getDisplayNameMap()
            : {};
        },
        log: (message: string) => print('[RaceStateMachine] ' + message),
      });
    }
    return this._results;
  }

  private _results: RaceResultsController = null;

  /** True once the heart rate prompt has been answered this launch */
  private _bleAsked: boolean = false;

  // ── Accessory rep tracking ───────────────────────────────────────────────

  private _oscState: string = 'waiting_drop';
  private _oscReps: number = 0;
  private _oscTopY: number = 0;
  private _oscBottomY: number = 0;
  private _oscSidePos: vec3 = null;

  /** Head travel per rep when a station does not specify one, cm */
  private readonly DEFAULT_ACCESSORY_DROP_CM: number = 25;
  /** Sideways travel that counts as a hop, cm */
  private readonly LATERAL_HOP_CM: number = 30;

  /**
   * True when the loaded session should count for PB / leaderboard.
   * Defaults to true, so an unassigned or older CourseManager keeps the
   * original always-a-race behavior.
   */
  /** The course tuning this session is being run under */
  private currentConfigKey(): string {
    var course = this.cm();
    return course && course.getConfigKey ? course.getConfigKey() : '';
  }

  /** True when the editor replaced hand-tracked stations with timers */
  private get isPreviewSimplified(): boolean {
    var course = this.cm();
    return !!course && course.isPreviewSimplified === true;
  }

  /**
   * What this session is allowed to become - a leaderboard entry, a personal
   * best, an achievement, a line in the history the coach reads.
   *
   * One policy, asked in every place the answer matters, so the panel, the
   * cloud save and the personal-best check cannot disagree about whether the
   * same session counted.
   */
  private eligibility(completed: boolean): SessionEligibility {
    return eligibilityOf({
      kind: this.sessionKind,
      previewSimplified: this.isPreviewSimplified,
      completed: completed,
    });
  }

  /** Why the current session does not count, for logging */
  private nonRankingReason(): string {
    return this.eligibility(true).reason || 'not eligible';
  }

  /**
   * Whether this session counts - for the leaderboard, a personal best, the
   * race table.
   *
   * Not the same question as whether it IS a race, and the two must never be
   * asked with the same function. A race run in the editor preview is a race:
   * it has a start line, a gun and a countdown. It simply does not count.
   */
  private isRaceSession(): boolean {
    return this.eligibility(true).countsForRanking;
  }

  /**
   * What the session is.
   *
   * Everything the athlete sees and hears at the start of one belongs here -
   * the countdown, the beeps, the gun - because those are what a race is,
   * not a reward for it being eligible. Asking the eligibility question
   * instead took the countdown away from every race run in preview, which is
   * every race anybody tests.
   */
  private get isRace(): boolean {
    return this.sessionKind === 'RACE';
  }

  // ── State ──────────────────────────────────────────────────────────────────

  private _state: RaceState = RaceState.IDLE;
  private _raceStartTime: number = 0;
  private _stationStartTime: number = 0;
  private _currentStationIndex: number = -1;
  private _countdownRemaining: number = 0;
  private _pausedFromState: RaceState = RaceState.RUNNING;
  private _hrStatusMessage: string = '';
  private _hrConnected: boolean = false;

  // Pause tracking
  private _totalPausedTime: number = 0;      // Total ms spent paused
  private _pauseStartTime: number = 0;        // When current pause started

  // Split tracking
  private _splitNames: string[] = [];
  private _splitDurations: number[] = [];
  private _splitAvgHR: number[] = [];  // Average HR per split
  private _splitPeakHR: number[] = []; // Peak HR per split

  /**
   * The same splits, carrying what the plan asked of each one.
   *
   * A duration on its own cannot be interpreted: forty seconds is a result
   * for a set of burpees and a prescription for a plank. Recorded alongside
   * the name so the analysis never has to guess which it is looking at.
   */
  private _splitEfforts: EffortRecord[] = [];
  private _incompleteStations: string[] = [];  // Stations not completed (for splits panel)

  // Current station progress
  private _currentConfig: StationConfig = null;
  private _stationProgress: number = 0;
  private _stationRequirement: number = 0;
  private _stationCompleting: boolean = false;  // Guard against double completion

  // Run tracking (camera-based)
  /**
   * The run being served, and what has been observed of it.
   *
   * The prescription decides what ends the run; the two observations are
   * taken either way. A distance run finishes on the metre and the clock is
   * read; a timed run finishes on the clock and the path accumulator is
   * read. Both produce a pace, which is the reason the timed run is worth
   * having at all.
   */
  private _run: RunPrescription | undefined = undefined;
  private _runDistance: number = 0;

  /**
   * When the run began, on the race clock rather than the wall clock.
   *
   * The distinction did not matter while every run ended on a distance: the
   * accumulator only advances on frames the run is being served, so a pause
   * froze it for free. A run that ends on time has no such protection. Read
   * from the wall it would keep counting through the pause, and a fifteen
   * minute easy run would finish while the athlete stood still - and the
   * paused minutes would land in the pace as well.
   *
   * getRaceElapsedMsAt is the pause-aware clock this file already declares as
   * the single source of truth for elapsed time. This is one more thing
   * derived from it rather than a second clock to keep in step.
   */
  private _runStartedAtRaceMs: number = 0;

  /**
   * The clock a run written in minutes is measured against.
   *
   * A distance run stops on its own when the athlete stops - no ground, no
   * progress - and a time run has no such property. Read from the wall it
   * counts standing still as training, so a fifteen minute easy run finishes
   * with five minutes of it spent waiting at a crossing. This counts the
   * running.
   */
  private _runClock: MovingClock = new MovingClock();

  /** The stretch of the run last announced, so it is said once */
  private _announcedPhase: string = '';

  /**
   * The pace the athlete is running at, averaged over a short window.
   *
   * Fed only while the run's clock is running, so the two agree about what
   * counts as moving and a stop freezes the reading rather than sending it
   * somewhere absurd.
   */
  private _paceMeter: PaceMeter = new PaceMeter();

  /**
   * The part of the run the session is measured on.
   *
   * Everything, unless the run has a stretch that says it does not count -
   * the settling minutes of an easy run, which are deliberately slower than
   * the run. Averaging them in would report a pace nobody was asked to hold,
   * and a fade computed from them would find the athlete speeding up and call
   * it inconsistency.
   */
  private _countedMetres: number = 0;
  private _countedMovingSeconds: number = 0;
  private _lastPlayerPos: vec3 = null;

  // START line crossing detection
  private _waitingForStartLineCross: boolean = false;
  private _startLinePos: vec3 = null;
  private _startLineForward: vec3 = null;

  // Station gate crossing detection (APPROACHING_STATION state)
  private _gatePos: vec3 = null;
  private _gateForward: vec3 = null;
  private _previousGateDot: number = 1;  // For crossing detection (start positive = behind gate)
  private readonly GATE_HALF_WIDTH: number = 100;  // 100cm = half gate width
  private readonly PROXIMITY_FALLBACK: number = 70; // 70cm fallback distance

  // Title fade out
  private _titleFading: boolean = false;
  private _titleAlpha: number = 1.0;
  private readonly TITLE_DISPLAY_TIME: number = 3.0;
  private readonly TITLE_FADE_DURATION: number = 0.5;

  // Personal Best tracking for end screen
  private _cachedPersonalBest: RaceRecord = null;
  private _isNewPB: boolean = false;

  // StatusText zoom animation
  private _statusAnimating: boolean = false;
  private _statusAnimTime: number = 0;
  private _statusAnimPhase: 'in' | 'out' = 'in';
  private _statusOriginalScale: vec3 = null;
  private readonly STATUS_ZOOM_DURATION: number = 0.15;
  private readonly STATUS_ZOOM_SCALE: number = 1.3;

  // SkiErg guide fadeout
  private _skiergGuidesActive: boolean = false;
  private _skiergGuidesFading: boolean = false;

  // ── Form Detection State ────────────────────────────────────────────────────

  // Camera Y tracking for form detection
  private _cameraYHistory: number[] = [];
  private readonly CAMERA_Y_HISTORY_SIZE: number = 30;  // ~0.5s at 60fps

  // Burpee form state
  private _burpeeState: 'waiting_drop' | 'waiting_rise' | 'waiting_jump' = 'waiting_drop';
  private _burpeeDropY: number = 0;
  private _burpeeGoodReps: number = 0;
  private _burpeeJumpStartPos: vec3 = null;  // Position when rise completes
  private _burpeeJumpForward: vec3 = null;   // Forward direction at jump start
  private readonly BURPEE_JUMP_DISTANCE: number = 10;  // 50cm forward = valid jump
  private _burpeeLastFeedbackTime: number = 0;
  private _burpeeStationStartTime: number = -1;  // When burpee station started (-1 = not started)
  private readonly BURPEE_FEEDBACK_COOLDOWN: number = 2.0;  // seconds between UI feedback
  private readonly BURPEE_FIRST_FEEDBACK_DELAY: number = 3.0;  // Wait before first feedback

  // Lunge form state
  private _lungeBounceCount: number = 0;
  private _lungeLastPeakY: number = 0;
  private _lungeLastValleyY: number = 0;
  private _lungeDirection: 'rising' | 'falling' = 'rising';

  // Form feedback timing
  private _lastFormReminderTime: number = 0;
  private readonly FORM_REMINDER_COOLDOWN: number = 10.0;  // seconds between AI voice reminders (longer = less spam)

  // Thresholds (in cm)
  private readonly BURPEE_DROP_THRESHOLD: number = 20;   // Head must drop 20cm
  private readonly LUNGE_BOUNCE_THRESHOLD: number = 10;  // 10cm bounce = lunge detected
  private _skiergGuidesAlpha: number = 1.0;
  private readonly SKIERG_GUIDE_FADE_DURATION: number = 0.5;

  // Heart rate tracking for current split
  private _splitHRReadings: number[] = [];
  private _splitPeakBPM: number = 0;

  // Countdown zoom punch animation
  private _countdownAnimating: boolean = false;
  private _countdownAnimTime: number = 0;
  private _countdownOriginalScale: vec3 = null;
  private _lastCountdownNum: number = -1;
  private readonly COUNTDOWN_ZOOM_DURATION: number = 0.3;
  private readonly COUNTDOWN_ZOOM_SCALE: number = 1.5;
  private readonly COUNTDOWN_GO_ZOOM_SCALE: number = 0.8;  // GO! için daha küçük

  // Station name zoom punch animation
  private _stationNameAnimating: boolean = false;
  private _stationNameAnimTime: number = 0;
  private _stationNameOriginalScale: vec3 = null;
  private readonly STATION_NAME_ZOOM_DURATION: number = 0.3;
  private readonly STATION_NAME_ZOOM_SCALE: number = 1.4;

  // Rep popup animation (+1 floating text)
  private _repPopupInstance: SceneObject = null;
  private _repPopupAnimating: boolean = false;
  private _repPopupAnimTime: number = 0;
  private _repPopupStartPos: vec3 = null;
  private _repPopupStartScale: vec3 = null;
  private readonly REP_POPUP_POP_DURATION: number = 0.3;    // Quick pop in
  private readonly REP_POPUP_FLOAT_DURATION: number = 1.2;  // Float up and fade
  private readonly REP_POPUP_TOTAL_DURATION: number = 1.5;  // Total animation time
  private readonly REP_POPUP_FLOAT_DISTANCE: number = 50;   // cm to float up
  private readonly REP_POPUP_POP_SCALE: number = 1.3;       // Pop scale multiplier

  // ── Public Getters ─────────────────────────────────────────────────────────

  get state(): string { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get currentConfig(): StationConfig | null { return this._currentConfig; }

  /** True when in a two-handed exercise (ZONE_HIT mode) - hide wrist menu */
  get isZoneHitActive(): boolean {
    return this._state === RaceState.STATION &&
           this._currentConfig !== null &&
           this._currentConfig.mode === StationMode.ZONE_HIT;
  }
  get splits(): { name: string; duration: number }[] {
    const result: { name: string; duration: number }[] = [];
    for (let i = 0; i < this._splitNames.length; i++) {
      result.push({ name: this._splitNames[i], duration: this._splitDurations[i] });
    }
    return result;
  }
  get elapsedMs(): number {
    return this.getRaceElapsedMsAt(getTime() * 1000);
  }

  // ── Time Calculation Helper ─────────────────────────────────────────────────
  // Single source of truth for all elapsed time calculations (pause-aware)

  private getRaceElapsedMsAt(now: number): number {
    if (this._raceStartTime === 0) return 0;

    var paused = this._totalPausedTime;

    // Include active pause duration (not yet added to _totalPausedTime)
    if (this._state === RaceState.PAUSED && this._pauseStartTime > 0) {
      paused += now - this._pauseStartTime;
    }

    return Math.max(0, now - this._raceStartTime - paused);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    if (this.camera) {
      this.camTransform = this.camera.getTransform();
    }

    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));

    // Hide SkiErg guides initially
    if (this.skiergGuides) {
      this.skiergGuides.enabled = false;
    }

    // Hide finish panel initially
    if (this.finishPanel) {
      this.finishPanel.enabled = false;
    }

    // Hide finish sub-elements initially
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = false;
    }

    // Hide splits panel initially
    if (this.splitsPanel) {
      this.splitsPanel.enabled = false;
    }

    // Hide HR connected icon initially
    if (this.hrConnectedIcon) {
      this.hrConnectedIcon.enabled = false;
    }

    // Bind finish buttons
    this.createEvent('OnStartEvent').bind(() => {
      this.bindFinishButtons();
    });

    // Tell the cloud which course is loaded, so a personal best comes from
    // the same one rather than from whichever race happened to be quickest.
    if (this.cloudManager) {
      (this.cloudManager as any).currentConfigKey = this.currentConfigKey();
    }

    this.setUIIdle();
    this.showTitle();
    this.bindCoachPrescriptions();

    print('[RaceStateMachine] Init — IDLE (HR Edition)');
  }

  /**
   * Let the coach open the picker with a session already dialled in. It only
   * chooses constraints; the generator builds the workout and the athlete
   * still has to press START, so nothing happens behind their back.
   */
  private bindCoachPrescriptions(): void {
    if (!this.aiCoach || !this.sessionPicker) return;

    var coach = this.aiCoach as any;
    if (!coach.onPrescribeSession) return;

    coach.onPrescribeSession((space: string, duration: string, focus: string, reason: string) => {
      print('[RaceStateMachine] Coach prescribed ' + duration + '/' + focus + ' (' + space + ')');

      var finishWasOpen = this.finishPanel ? this.finishPanel.enabled : false;

      this.hideFinishPanel();
      this.sessionPicker.applyPrescription(space as any, duration as any, focus as any, reason);

      // The coach interrupted the results screen, so there is somewhere to go
      // back to. In the normal pre-race flow there is not, and the button
      // stays hidden rather than doing nothing.
      if (finishWasOpen) {
        this.sessionPicker.setBackTarget(() => {
          if (this.finishPanel) this.finishPanel.enabled = true;
        });
      }
    });
  }

  private bindFinishButtons(): void {
    // Legacy reset button
    if (this.finishResetButton) {
      var btn = this.finishResetButton as any;
      if (btn.onTriggerUp && btn.onTriggerUp.add) {
        btn.onTriggerUp.add(() => {
          this.resetRace();
        });
        print('[RaceStateMachine] Finish reset button bound');
      }
    }

    // Race Again button (primary action)
    if (this.finishRaceAgainButton) {
      var raceAgainBtn = this.finishRaceAgainButton as any;
      if (raceAgainBtn.onTriggerUp && raceAgainBtn.onTriggerUp.add) {
        raceAgainBtn.onTriggerUp.add(() => {
          this.resetRace();
        });
        print('[RaceStateMachine] Race Again button bound');
      }
    }

    // View Splits button (opens splits panel)
    if (this.finishViewSplitsButton) {
      var viewSplitsBtn = this.finishViewSplitsButton as any;
      if (viewSplitsBtn.onTriggerUp && viewSplitsBtn.onTriggerUp.add) {
        viewSplitsBtn.onTriggerUp.add(() => {
          this.showSplitsPanel();
        });
        print('[RaceStateMachine] View Splits button bound');
      }
    }

    // View Leaderboard button (opens leaderboard panel)
    if (this.finishViewLeaderboardButton) {
      var viewLeaderboardBtn = this.finishViewLeaderboardButton as any;
      if (viewLeaderboardBtn.onTriggerUp && viewLeaderboardBtn.onTriggerUp.add) {
        viewLeaderboardBtn.onTriggerUp.add(() => {
          this.showLeaderboardPanel();
        });
        print('[RaceStateMachine] View Leaderboard button bound');
      }
    }

    // Splits Panel - Race Again button
    if (this.splitsRaceAgainButton) {
      var splitsRaceAgainBtn = this.splitsRaceAgainButton as any;
      if (splitsRaceAgainBtn.onTriggerUp && splitsRaceAgainBtn.onTriggerUp.add) {
        splitsRaceAgainBtn.onTriggerUp.add(() => {
          this.hideSplitsPanel();
          this.hideFinishPanel();
          this.resetRace();
        });
        print('[RaceStateMachine] Splits Race Again button bound');
      }
    }

    // Splits Panel - Go Back button
    if (this.splitsGoBackButton) {
      var splitsGoBackBtn = this.splitsGoBackButton as any;
      if (splitsGoBackBtn.onTriggerUp && splitsGoBackBtn.onTriggerUp.add) {
        splitsGoBackBtn.onTriggerUp.add(() => {
          this.hideSplitsPanel();
        });
        print('[RaceStateMachine] Splits Go Back button bound');
      }
    }
  }

  // ── Splits Panel Functions ─────────────────────────────────────────────────

  private showSplitsPanel(): void {
    // Hide finish panel
    if (this.finishPanel) {
      this.finishPanel.enabled = false;
    }

    // Show splits panel
    if (this.splitsPanel) {
      this.splitsPanel.enabled = true;
    }

    // Populate content
    this.populateSplitsPanel();
    print('[RaceStateMachine] Splits panel shown');
  }

  private hideSplitsPanel(): void {
    // Hide splits panel
    if (this.splitsPanel) {
      this.splitsPanel.enabled = false;
    }

    // Show finish panel
    if (this.finishPanel) {
      this.finishPanel.enabled = true;
    }
    print('[RaceStateMachine] Splits panel hidden, back to finish');
  }

  private showLeaderboardPanel(): void {
    if (!this.leaderboardController) {
      print('[RaceStateMachine] LeaderboardController not assigned');
      return;
    }

    // Hide finish panel while showing leaderboard
    if (this.finishPanel) {
      this.finishPanel.enabled = false;
    }

    // Show leaderboard with callbacks
    this.leaderboardController.show(
      // onClose - Go Back pressed
      () => {
        if (this.finishPanel) {
          this.finishPanel.enabled = true;
        }
      },
      // onRaceAgain - Race Again pressed
      () => {
        this.hideFinishPanel();
        this.resetRace();
      }
    );
    print('[RaceStateMachine] Leaderboard panel shown');
  }

  private populateSplitsPanel(): void {
    // Copy status text from finish panel
    if (this.splitsStatusText && this.finishStatusText) {
      this.splitsStatusText.text = this.finishStatusText.text;
    }

    // Copy time text from finish panel
    if (this.splitsTimeText && this.finishTotalTimeText) {
      this.splitsTimeText.text = this.finishTotalTimeText.text;
    }

    // Build splits list
    if (this.splitsListText) {
      var lines = '';

      // Completed splits with ✓
      for (var i = 0; i < this._splitNames.length; i++) {
        var name = this._splitNames[i];
        var time = this.formatTimeSplit(this._splitDurations[i]);
        var hr = this._splitAvgHR[i] > 0 ? this._splitAvgHR[i] + ' BPM' : '--';

        // Format: ✓ Run 1         0:45    125 BPM
        var paddedName = name.length < 14 ? name + ' '.repeat(14 - name.length) : name;
        lines += '✓ ' + paddedName + time + '    ' + hr + '\n';
      }

      // Incomplete stations with ○
      for (var j = 0; j < this._incompleteStations.length; j++) {
        var incompleteName = this._incompleteStations[j];
        var paddedIncompleteName = incompleteName.length < 14 ? incompleteName + ' '.repeat(14 - incompleteName.length) : incompleteName;
        lines += '○ ' + paddedIncompleteName + '--      --\n';
      }

      this.splitsListText.text = lines;
    }
  }

  // ── Heart Rate Monitor Setup ──────────────────────────────────────────────

  private initHeartRateMonitor(): void {
    // Asked once per launch. Racing again should not re-open a hardware
    // prompt the athlete already answered - the strap has not changed.
    if (this._bleAsked) {
      print('[RaceStateMachine] Heart rate already answered — skipping prompt');
      this.onBLEFlowComplete();
      return;
    }
    this._bleAsked = true;

    // If no HeartRateTracker or BLEConnectionUI, skip to floor calibration
    if (isNull(this.heartRateTracker) || isNull(this.bleConnectionUI)) {
      print('[RaceStateMachine] No HR setup — skipping to floor calibration');
      this.onBLEFlowComplete();
      return;
    }

    // Register BPM update callback
    this.heartRateTracker.onBPMUpdate((bpm: number, zone: HRZone) => {
      this.onHeartRateUpdate(bpm, zone);
    });

    // Show BLE connection dialog
    print('[RaceStateMachine] Showing BLE connection dialog');
    this.bleConnectionUI.show((connected: boolean) => {
      if (connected) {
        print('[RaceStateMachine] HR Monitor connected');
        this._hrStatusMessage = '';  // No text, using icon
        this._hrConnected = true;
      } else {
        print('[RaceStateMachine] HR Monitor disabled by user');
        this._hrStatusMessage = '';
        this._hrConnected = false;
      }

      // BLE flow complete — start floor calibration
      this.onBLEFlowComplete();
    });
  }

  private onBLEFlowComplete(): void {
    print('[RaceStateMachine] BLE flow complete — starting floor calibration');

    // Enable UI elements
    if (this.instructionText) {
      this.instructionText.getSceneObject().enabled = true;
    }
    if (this.stationInfoText) {
      this.stationInfoText.getSceneObject().enabled = true;
    }

    // Show HR connected icon or hide status text
    if (this._hrConnected && this.hrConnectedIcon) {
      // Show beating heart icon
      this.hrConnectedIcon.enabled = true;
      this.startHeartPulse();
      if (this.hrStatusText) {
        this.hrStatusText.getSceneObject().enabled = false;
      }
    } else {
      // Hide icon, hide text (no HR)
      if (this.hrConnectedIcon) {
        this.hrConnectedIcon.enabled = false;
      }
      if (this.hrStatusText) {
        this.hrStatusText.getSceneObject().enabled = false;
      }
    }

    this.proceedToCourseSetup();
  }

  /**
   * Ask what the athlete is doing before setting up the floor.
   *
   * Order matters: choosing a session calls CourseManager.loadPlan, which
   * clears whatever is currently placed in the world. Picking after the START
   * line exists would destroy it and leave the Start button dead, so the
   * choice has to come first.
   */
  private showSessionPicker(): void {
    if (!this.sessionPicker) {
      print('[RaceStateMachine] No session picker — running the full race');
      this.initHeartRateMonitor();
      return;
    }

    // The draw, refreshed every time the picker opens.
    //
    // It moves when the athlete finishes a session and when they abandon one,
    // and at no other time - so toggling the options in here is stable, but
    // pressing STOP and coming back is not the same workout again.
    if (this.profileManager) {
      this.sessionPicker.setSeed(this.profileManager.getTrainingSeed());
      this.sessionPicker.setRecentMovements(this.profileManager.getRecentMovements());
    }

    this.sessionPicker.onSessionStart(() => this.onSessionChosen());
    this.sessionPicker.show();

    // Coming from onboarding, going back means correcting the profile - a
    // mistyped name has no other route back once the panel closes.
    if (this.onboardingUI) {
      this.sessionPicker.setBackTarget(() => {
        print('[RaceStateMachine] Back to onboarding');
        this.showOnboarding();
      });
    }

    // The picker carries its own heading — leave the world-space instruction
    // text alone so it is not competing with the panel.
    if (this.instructionText) {
      this.instructionText.text = '';
    }

    print('[RaceStateMachine] Session picker shown');
  }

  private onSessionChosen(): void {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    print('[RaceStateMachine] Session chosen: ' + (plan ? plan.title : 'unknown'));

    this.initHeartRateMonitor();
  }

  /**
   * Place the floor and the START line. On a repeat run the floor is already
   * known, but the START line was just destroyed by loadPlan, so it has to be
   * put back rather than skipped.
   */
  private proceedToCourseSetup(): void {
    var setup = this.setup();

    if (setup && setup.isCalibrated) {
      print('[RaceStateMachine] Already calibrated — replacing START line');

      var replaced = setup.respawnStartLine ? setup.respawnStartLine(this.camera) : false;
      if (!replaced) {
        print('[RaceStateMachine] Could not replace START line — recalibrating');
        if (setup.startCalibration) setup.startCalibration();
        return;
      }

      if (this.startButtonObject) {
        this.startButtonObject.enabled = true;
      }
      if (this.instructionText) {
        this.instructionText.text = 'Pinch Start to begin.';
      }
      return;
    }

    if (setup && typeof setup.startCalibration === 'function') {
      setup.startCalibration();
    } else {
      print('[RaceStateMachine] WARNING: CourseSetup not available for calibration');
    }
  }

  // ── Heart Pulse Animation ────────────────────────────────────────────────

  private _heartPulseActive: boolean = false;
  private _heartOriginalScale: vec3 = null;
  private _heartPulseTime: number = 0;
  private readonly HEART_PULSE_SPEED: number = 1.2;  // Pulses per second (resting HR feel)
  private readonly HEART_PULSE_SCALE: number = 0.15;

  private startHeartPulse(): void {
    if (!this.hrConnectedIcon) return;

    this._heartOriginalScale = this.hrConnectedIcon.getTransform().getLocalScale();
    this._heartPulseActive = true;
    this._heartPulseTime = 0;
  }

  private stopHeartPulse(): void {
    this._heartPulseActive = false;
    if (this.hrConnectedIcon && this._heartOriginalScale) {
      this.hrConnectedIcon.getTransform().setLocalScale(this._heartOriginalScale);
    }
  }

  private updateHeartPulse(dt: number): void {
    if (!this._heartPulseActive || !this.hrConnectedIcon || !this._heartOriginalScale) return;

    this._heartPulseTime += dt;

    // Double-beat pattern like real heart
    var t = this._heartPulseTime * this.HEART_PULSE_SPEED * Math.PI * 2;
    var beat1 = Math.max(0, Math.sin(t));
    var beat2 = Math.max(0, Math.sin(t + 0.5));
    var pulse = (beat1 + beat2 * 0.6) * this.HEART_PULSE_SCALE;

    var scale = 1.0 + pulse;
    this.hrConnectedIcon.getTransform().setLocalScale(this._heartOriginalScale.uniformScale(scale));
  }

  private onHeartRateUpdate(bpm: number, _zone: HRZone): void {
    if (this.heartRateText) {
      this.heartRateText.text = bpm.toString();
    }

    // Track for current split
    if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
      this._splitHRReadings.push(bpm);
      if (bpm > this._splitPeakBPM) {
        this._splitPeakBPM = bpm;
      }
    }
  }

  // ── Title Display & Fade Out ────────────────────────────────────────────────

  private showTitle(): void {
    if (this.instructionText) {
      this.instructionText.getSceneObject().enabled = false;
    }
    if (this.stationInfoText) {
      this.stationInfoText.getSceneObject().enabled = false;
    }
    if (this.stationInfoBG) {
      this.stationInfoBG.enabled = false;
    }
    if (this.hrStatusText) {
      this.hrStatusText.getSceneObject().enabled = false;
    }
    // Hide HR display until race starts
    if (this.heartRateText) {
      this.heartRateText.getSceneObject().enabled = false;
    }
    if (this.hrZoneText) {
      this.hrZoneText.getSceneObject().enabled = false;
    }

    if (!this.titleImage) {
      this.onTitleFadeComplete();
      return;
    }

    this.titleImage.enabled = true;
    this._titleAlpha = 1.0;
    this.setTitleAlpha(1.0);

    var fadeDelay = this.createEvent('DelayedCallbackEvent');
    fadeDelay.bind(() => {
      this._titleFading = true;
    });
    (fadeDelay as DelayedCallbackEvent).reset(this.TITLE_DISPLAY_TIME);
  }

  private updateTitleFade(dt: number): void {
    if (!this._titleFading || !this.titleImage) return;

    this._titleAlpha -= dt / this.TITLE_FADE_DURATION;

    if (this._titleAlpha <= 0) {
      this._titleAlpha = 0;
      this._titleFading = false;
      this.titleImage.enabled = false;
      this.onTitleFadeComplete();
    }

    this.setTitleAlpha(this._titleAlpha);
  }

  private onTitleFadeComplete(): void {
    print('[RaceStateMachine] Title fade complete');

    // Check if onboarding is needed
    if (this.needsOnboarding()) {
      print('[RaceStateMachine] Onboarding required, showing onboarding UI');
      this.showOnboarding();
      return;
    }

    // Already has profile, continue to BLE flow
    this.continueAfterOnboarding();
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  /**
   * Always show onboarding so user can adjust settings (goal changes per session)
   */
  /**
   * Only on a first launch. The profile is who the athlete is, which does not
   * change between sessions — asking again every time turned starting a race
   * into three questionnaires once the session picker joined the flow.
   */
  private needsOnboarding(): boolean {
    if (!this.profileManager || !this.onboardingUI) {
      return false;
    }
    return !this.profileManager.hasProfile();
  }

  /**
   * Show onboarding UI flow
   */
  private showOnboarding(): void {
    if (!this.onboardingUI) {
      print('[RaceStateMachine] WARNING: OnboardingUI not assigned, skipping');
      this.continueAfterOnboarding();
      return;
    }

    // Get display name from CloudManager if available
    var snapUserName = '';
    if (this.cloudManager) {
      snapUserName = this.cloudManager.displayName || '';
    }

    // Show onboarding UI
    this.onboardingUI.show(snapUserName, (profile: any) => {
      this.onOnboardingComplete(profile);
    });
  }

  /**
   * Called when onboarding flow completes
   */
  private onOnboardingComplete(profile: any): void {
    print('[RaceStateMachine] Onboarding complete');

    // Update HeartRateTracker with personalized maxHR
    if (profile && this.profileManager && this.heartRateTracker) {
      var maxHR = this.profileManager.getMaxHeartRate();
      this.heartRateTracker.updateMaxHeartRate(maxHR);
      print('[RaceStateMachine] MaxHR set to: ' + maxHR);
    }

    // Set display name in CloudManager from profile
    if (this.cloudManager && this.profileManager) {
      var profileName = this.profileManager.getDisplayName();
      if (profileName && profileName !== 'Guest' && profileName !== 'Athlete') {
        this.cloudManager.setDisplayName(profileName);
      }
    }

    // Continue to BLE flow
    this.continueAfterOnboarding();
  }

  /**
   * Continue startup flow after onboarding (or if already onboarded)
   */
  /**
   * Who you are, then what you are doing, then the hardware.
   *
   * The two questions belong next to each other; the heart rate prompt is a
   * hardware step and sits with the other physical setup just before
   * calibration, rather than splitting the questions in half.
   */
  private continueAfterOnboarding(): void {
    print('[RaceStateMachine] Continuing to session picker');
    this.showSessionPicker();
  }

  /**
   * Get ProfileManager reference (for AI Coach and other systems)
   */
  getProfileManager(): ProfileManager | null {
    return this.profileManager;
  }

  private setTitleAlpha(alpha: number): void {
    if (!this.titleImage) return;
    var color = this.titleImage.mainPass.baseColor;
    this.titleImage.mainPass.baseColor = new vec4(color.r, color.g, color.b, alpha);
  }

  // ── StatusText Zoom Animation ─────────────────────────────────────────────

  private triggerStatusZoom(): void {
    if (!this.statusText) return;

    if (this._statusOriginalScale === null) {
      this._statusOriginalScale = this.statusText.getSceneObject().getTransform().getLocalScale();
    }

    this._statusAnimating = true;
    this._statusAnimTime = 0;
    this._statusAnimPhase = 'in';
  }

  private updateStatusZoom(dt: number): void {
    if (!this._statusAnimating || !this.statusText) return;

    this._statusAnimTime += dt;
    var transform = this.statusText.getSceneObject().getTransform();

    if (this._statusAnimPhase === 'in') {
      var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
      var scale = 1 + (this.STATUS_ZOOM_SCALE - 1) * t;
      transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));

      if (t >= 1) {
        this._statusAnimPhase = 'out';
        this._statusAnimTime = 0;
      }
    } else {
      var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
      var scale = this.STATUS_ZOOM_SCALE - (this.STATUS_ZOOM_SCALE - 1) * t;
      transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));

      if (t >= 1) {
        transform.setLocalScale(this._statusOriginalScale);
        this._statusAnimating = false;
      }
    }
  }

  private updateSkiergGuidesFade(dt: number): void {
    if (!this._skiergGuidesFading || !this.skiergGuides) return;

    this._skiergGuidesAlpha -= dt / this.SKIERG_GUIDE_FADE_DURATION;

    if (this._skiergGuidesAlpha <= 0) {
      this._skiergGuidesAlpha = 0;
      this._skiergGuidesFading = false;
      this._skiergGuidesActive = false;
      this.skiergGuides.enabled = false;
      print('[RaceStateMachine] SkiErg guides hidden');
      return;
    }

    // Apply alpha to both child guide animations
    for (var i = 0; i < this.skiergGuides.getChildrenCount(); i++) {
      var child = this.skiergGuides.getChild(i);
      var image = child.getComponent('Component.Image') as Image;
      if (image) {
        var color = image.mainPass.baseColor;
        image.mainPass.baseColor = new vec4(color.r, color.g, color.b, this._skiergGuidesAlpha);
      }
    }
  }

  private startSkiergGuidesFadeout(): void {
    if (!this.skiergGuides || !this._skiergGuidesActive) return;

    this._skiergGuidesFading = true;
    print('[RaceStateMachine] SkiErg guides fading out');
  }

  private showSkiergGuides(): void {
    if (!this.skiergGuides) return;

    this._skiergGuidesActive = true;
    this._skiergGuidesFading = false;
    this._skiergGuidesAlpha = 1.0;
    this.skiergGuides.enabled = true;

    // Reset alpha to 1 for all children
    for (var i = 0; i < this.skiergGuides.getChildrenCount(); i++) {
      var child = this.skiergGuides.getChild(i);
      var image = child.getComponent('Component.Image') as Image;
      if (image) {
        var color = image.mainPass.baseColor;
        image.mainPass.baseColor = new vec4(color.r, color.g, color.b, 1.0);
      }
    }

    print('[RaceStateMachine] SkiErg guides shown');
  }

  private hideSkiergGuides(): void {
    if (!this.skiergGuides) return;

    this._skiergGuidesActive = false;
    this._skiergGuidesFading = false;
    this.skiergGuides.enabled = false;
  }

  // ── Finish Panel ────────────────────────────────────────────────────────────

  private showFinishPanel(completed: boolean, totalMs: number, hrStats: { avgBPM: number, peakBPM: number }, incompleteStations: string[]): void {
    // Show the panel
    if (this.finishPanel) {
      this.finishPanel.enabled = true;
    }

    // Hide splits panel initially (shown via VIEW SPLITS button)
    if (this.splitsPanel) {
      this.splitsPanel.enabled = false;
    }

    // Headline, in the session's own words. A training session that ends says
    // SESSION COMPLETE, not FINISHED!, and the button under it offers a NEW
    // SESSION rather than another race.
    var words = this.sessionSemantics;

    if (this.finishStatusText) {
      this.finishStatusText.text = finishTitle(words, completed);
    }

    this.applyRetryLabel(words);

    // A training session has no standing. Offering VIEW LEADERBOARD next to
    // SESSION COMPLETE says the workout was scored against other people, and
    // it was not.
    this.setButtonVisible(this.finishViewLeaderboardButton, words.countsForRanking);

    // Total time - large, prominent (just the time, no label)
    if (this.finishTotalTimeText) {
      this.finishTotalTimeText.text = this.formatTime(totalMs);
    }

    // HR stats - compact format for the two boxes
    if (this.finishAvgHRText) {
      this.finishAvgHRText.text = hrStats.avgBPM > 0 ? hrStats.avgBPM.toString() : '--';
    }
    if (this.finishPeakHRText) {
      this.finishPeakHRText.text = hrStats.peakBPM > 0 ? hrStats.peakBPM.toString() : '--';
    }

    // Calculate and show split insights
    this.populateSplitInsights();

    // Store incomplete stations for VIEW SPLITS panel
    this.storeIncompleteStations(incompleteStations);

    // Check for Personal Best (async)
    this.checkAndShowPB(totalMs);
  }

  /**
   * The two lines a training session can honestly fill.
   *
   * Top line is the shape of the work - how much of it was working and how
   * much was resting, which is a fact about the session rather than a verdict
   * on the athlete. Bottom line is the one measured change, if there was one,
   * and is left blank rather than filled with the longest split.
   */
  private populateTrainingInsights(): void {
    var summary = this.analyseTrainingSession();

    if (this.finishFastestText) {
      this.finishFastestText.text = shapeLine(summary);
    }

    if (this.finishNeedsWorkText) {
      this.finishNeedsWorkText.text = headlineFinding(summary);
    }
  }

  /**
   * Calculate and display split insights (Fastest / Needs Work)
   */
  private populateSplitInsights(): void {
    if (this._splitNames.length === 0) {
      if (this.finishFastestText) this.finishFastestText.text = '';
      if (this.finishNeedsWorkText) this.finishNeedsWorkText.text = '';
      return;
    }

    // A race is ranked; a training session is not. Fastest-and-slowest needs
    // every split to be measuring the same thing, and in a workout they are
    // not: the holds are prescriptions, the warm-up is deliberately easy and
    // the ladder changes the reps every round on purpose.
    if (this.isTrainingSession) {
      this.populateTrainingInsights();
      return;
    }

    // Find fastest and slowest splits (excluding RUN segments for fair comparison)
    var fastestIdx = -1;
    var slowestIdx = -1;
    var fastestTime = Number.MAX_VALUE;
    var slowestTime = 0;

    for (var i = 0; i < this._splitNames.length; i++) {
      var name = this._splitNames[i];
      var duration = this._splitDurations[i];

      // Skip RUN segments - only compare workout stations
      if (name.toLowerCase().indexOf('run') === 0) continue;

      if (duration < fastestTime) {
        fastestTime = duration;
        fastestIdx = i;
      }
      if (duration > slowestTime) {
        slowestTime = duration;
        slowestIdx = i;
      }
    }

    // Fastest split
    if (this.finishFastestText) {
      if (fastestIdx >= 0) {
        var fastName = this._splitNames[fastestIdx].toUpperCase();
        var fastTimeStr = this.formatTimeSplit(this._splitDurations[fastestIdx]);
        this.finishFastestText.text = 'Fastest:  ' + fastName + '  ' + fastTimeStr;
      } else {
        this.finishFastestText.text = '';
      }
    }

    // Needs work — the verdict's limiter, not simply the slowest station.
    // A burpee station taking longer than a squat station is expected; what
    // matters is which split ran long against what was expected of it today.
    if (this.finishNeedsWorkText) {
      var limiterLine = this._results ? this._results.limiterLine : '';

      if (limiterLine) {
        this.finishNeedsWorkText.text = 'Needs work:  ' + limiterLine;
      } else if (this._results && this._results.hasVerdict) {
        // A verdict exists and found nothing worth flagging
        this.finishNeedsWorkText.text = '';
      } else if (slowestIdx >= 0 && slowestIdx !== fastestIdx) {
        // No verdict available (training session, or analysis unavailable) —
        // fall back to the original slowest-split line rather than show nothing
        var slowName = this._splitNames[slowestIdx].toUpperCase();
        var diff = this._splitDurations[slowestIdx] - fastestTime;
        this.finishNeedsWorkText.text =
          'Needs work:  ' + slowName + '  +' + this.formatTimeSplit(diff);
      } else {
        this.finishNeedsWorkText.text = '';
      }
    }
  }

  /**
   * Format split time as M:SS (e.g., "0:41")
   */
  private formatTimeSplit(ms: number): string {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  /**
   * Check Personal Best and show PB badge if new record
   */
  private checkAndShowPB(currentTotalMs: number): void {
    // Hide PB badge initially
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = false;
    }

    // Training sessions, and preview-simplified races, don't set a PB
    if (!this.isRaceSession()) {
      print('[RaceStateMachine] ' + this.nonRankingReason() + ' - skipping PB check');
      return;
    }

    // Need CloudManager to check PB
    if (!this.cloudManager) {
      print('[RaceStateMachine] No CloudManager - skipping PB check');
      return;
    }

    // Fetch personal best async
    var cloud = this.cloudManager as any;
    if (cloud.getPersonalBest) {
      cloud.getPersonalBest(this.currentConfigKey()).then((pb: RaceRecord) => {
        if (!pb) {
          // First completed race - this IS the PB!
          this._isNewPB = true;
          this._cachedPersonalBest = null;
          this.showPBBadge(0, true); // First race, no comparison
          print('[RaceStateMachine] First race completed - NEW PB!');
          return;
        }

        this._cachedPersonalBest = pb;
        var diff = currentTotalMs - pb.totalTime;

        if (diff < 0) {
          // New PB!
          this._isNewPB = true;
          this.showPBBadge(diff, false);
          print('[RaceStateMachine] NEW PB! Beat previous by ' + Math.abs(diff) + 'ms');
        } else {
          // Not a PB
          this._isNewPB = false;
          print('[RaceStateMachine] Not a PB. Previous best: ' + pb.totalTime + 'ms');
        }
      }).catch((e: any) => {
        print('[RaceStateMachine] PB check error: ' + e);
      });
    }
  }

  /**
   * Show PB badge with difference text
   */
  private showPBBadge(diffMs: number, isFirstRace: boolean): void {
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = true;
    }

    if (this.finishPBText) {
      if (isFirstRace) {
        this.finishPBText.text = 'NEW PB';
      } else {
        // Format difference as -M:SS (e.g., "-0:32")
        var absDiff = Math.abs(diffMs);
        var diffStr = '-' + this.formatTimeSplit(absDiff);
        this.finishPBText.text = 'NEW PB  ' + diffStr;
      }
    }
  }

  /**
   * Store incomplete stations for splits panel
   */
  private storeIncompleteStations(incompleteStations: string[]): void {
    this._incompleteStations = incompleteStations || [];
  }

  private hideFinishPanel(): void {
    if (this.finishPanel) {
      this.finishPanel.enabled = false;
    }
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = false;
    }

    // Also hide splits panel
    if (this.splitsPanel) {
      this.splitsPanel.enabled = false;
    }

    // Reset PB state
    this._isNewPB = false;
    this._cachedPersonalBest = null;
  }

  // ── Cloud Save ──────────────────────────────────────────────────────────────

  private saveRaceToCloud(totalMs: number, completed: boolean, hrStats: { avgBPM: number, peakBPM: number }): void {
    // Training sessions must not reach the race table - getLeaderboard() and
    // getPersonalBest() read from it and would both be corrupted.
    if (!this.isRaceSession()) {
      print('[RaceStateMachine] ' + this.nonRankingReason() + ' - skipping cloud save');
      return;
    }

    if (!this.cloudManager) {
      print('[RaceStateMachine] Cloud save skipped - no CloudManager');
      return;
    }

    // Check if guest mode (skip cloud save)
    var isGuest = this.profileManager ? this.profileManager.isGuest() : false;

    // Build splits data
    var splits: SplitData[] = [];
    for (var i = 0; i < this._splitNames.length; i++) {
      splits.push({
        name: this._splitNames[i],
        duration: this._splitDurations[i],
        avgHR: this._splitAvgHR[i] || 0
      });
    }

    // Stamped with what the session actually was, so the boundary can apply
    // the rule itself rather than taking this method's word for it.
    var record: RaceRecord = {
      totalTime: totalMs,
      completed: completed,
      splits: splits,
      avgHR: hrStats.avgBPM,
      peakHR: hrStats.peakBPM,
      sessionKind: this.sessionKind,
      previewSimplified: this.isPreviewSimplified,
      configKey: this.currentConfigKey(),
    };

    this.cloudManager.saveRace(record, isGuest).then((success) => {
      if (success) {
        print('[RaceStateMachine] Race saved to cloud');
      } else {
        print('[RaceStateMachine] Cloud save failed');
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  startRace(): void {
    if (this._state !== RaceState.IDLE && this._state !== RaceState.FINISHED) {
      print('[RaceStateMachine] Cannot start from ' + this._state);
      return;
    }

    var course = this.cm();
    if (!course || !course.isReady) {
      print('[RaceStateMachine] ERROR: CourseManager not ready!');
      return;
    }

    // Reset state
    this._splitNames = [];
    this._splitDurations = [];
    this._splitAvgHR = [];
    this._splitPeakHR = [];
    this._splitEfforts = [];
    this._incompleteStations = [];
    this._currentStationIndex = -1;
    this._stationProgress = 0;
    this._stationPath.reset();
    this._stationRequirement = 0;
    this._stationCompleting = false;
    this._currentConfig = null;
    this._run = undefined;
    this._runDistance = 0;
    this._runStartedAtRaceMs = 0;
    this._runPath.reset();
    this._lastPlayerPos = null;
    this._countdownRemaining = this.countdownSeconds;
    this._lastCountdownNum = -1;
    this._countdownAnimating = false;
    this._totalPausedTime = 0;
    this._pauseStartTime = 0;
    this._waitingForStartLineCross = false;
    this._startLinePos = null;
    this._startLineForward = null;
    this._announcedBlock = -1;
    this._blockBannerUntil = 0;
    this.clearTrainingAnchor();
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Start HR session
    if (this.heartRateTracker) {
      this.heartRateTracker.startSession();
    }

    // Clear instruction text
    if (this.instructionText) {
      this.instructionText.text = '';
    }

    // Hide start button after race starts
    if (this.startButtonObject) {
      this.startButtonObject.enabled = false;
    }

    // Hide HR status text, show HR display (keep heart icon beating)
    if (this.hrStatusText) {
      this.hrStatusText.getSceneObject().enabled = false;
    }
    // hrConnectedIcon stays visible and beating during race
    if (this.heartRateText) {
      this.heartRateText.getSceneObject().enabled = true;
    }
    if (this.hrZoneText) {
      this.hrZoneText.getSceneObject().enabled = true;
    }

    // Show progress bar
    if (this.progressBar) {
      this.progressBar.getSceneObject().enabled = true;
    }

    // A training session has no start line and no gun. Skipping the countdown
    // state entirely rather than running it with zero seconds - a single frame
    // of it was still enough to flash "GO!" and start the beeps.
    //
    // Asked of what the session is, never of what it will count as. A race in
    // preview does not count and is still a race, and it starts the way one
    // starts.
    if (!this.isRace) {
      if (this.countdownText) {
        this.countdownText.getSceneObject().enabled = false;
      }
      if (this.stationInfoBG) {
        this.stationInfoBG.enabled = true;
      }

      this._raceStartTime = getTime() * 1000;
      this._state = RaceState.RUNNING;
      this.setTrainingAnchor();

      print('[RaceStateMachine] Training session — starting without a countdown');
      this.startFirstStation();
      return;
    }

    // Show countdown text
    if (this.countdownText) {
      this.countdownText.getSceneObject().enabled = true;
    }

    // Play countdown beep sound ONCE (SFX contains all beeps)
    this.playCountdownBeep();

    this._state = RaceState.COUNTDOWN;
    print('[RaceStateMachine] Countdown started');
  }

  /**
   * Flip between paused and running.
   *
   * A toggle is a button's idea, not a command's. The wrist menu has one
   * button for both, so this stays - but it is written in terms of the two
   * commands rather than the other way round, because a voice command must
   * be idempotent: "pause, pause" has to leave the session paused, and with
   * a toggle underneath it left the session running.
   */
  togglePause(): void {
    if (this.isPaused) {
      this.resumeSession();
    } else {
      this.pauseSession();
    }
  }

  /** Pause. Already paused is success, not a second toggle. */
  pauseSession(): void {
    if (!this.isPausable) return;
    this.applyPause();
  }

  /** Resume. Already running is success. */
  resumeSession(): void {
    if (!this.isPaused) return;
    this.applyResume();
  }

  private applyPause(): void {
    // PAUSE
    this._pausedFromState = this._state;
    this._pauseStartTime = getTime() * 1000;
    this._state = RaceState.PAUSED;

    // Pause hand zone detection
    if (this.handZoneDetector) {
      this.handZoneDetector.stopDetection();
    }

    if (this.statusText) {
      this.statusText.text = 'PAUSED';
    }
    print('[RaceStateMachine] PAUSED');
  }

  private applyResume(): void {
    // RESUME
    var pauseDuration = (getTime() * 1000) - this._pauseStartTime;
    this._totalPausedTime += pauseDuration;
    this._pauseStartTime = 0;
    this._state = this._pausedFromState;

    // Reset camera position tracking to avoid distance jump
    this._lastPlayerPos = null;

    // Resume hand zone detection if we were in STATION
    if (this._pausedFromState === RaceState.STATION && this.handZoneDetector) {
      this.handZoneDetector.resumeDetection(
        (repCount) => {
          this._stationProgress = repCount;
          this.updateStationUI();
        }
      );
    }

    // Restore UI based on which state we're resuming to
    if (this._pausedFromState === RaceState.RUNNING) {
      if (this.stationNameText) {
        this.stationNameText.text = 'RUN';
      }
      this.setStatusLine('');
    } else if (this._pausedFromState === RaceState.APPROACHING_STATION && this._currentConfig) {
      // Only DISTANCE mode uses APPROACHING_STATION
      if (this.stationNameText) {
        this.stationNameText.text = this._currentConfig.name;
      }
      this.setStatusLine('Cross station line');
    } else if (this._pausedFromState === RaceState.APPROACHING_FINISH) {
      if (this.stationNameText) {
        this.stationNameText.text = 'FINISH';
      }
      this.setStatusLine('Cross the finish line!');
    } else if (this._pausedFromState === RaceState.STATION && this._currentConfig) {
      if (this.stationNameText) {
        this.stationNameText.text = this._currentConfig.name;
      }
      this.setStatusLine('');
    }
    print('[RaceStateMachine] RESUMED → ' + this._pausedFromState);
  }

  resetRace(): void {
    // Stop hand zone detection
    if (this.handZoneDetector) {
      this.handZoneDetector.stopDetection();
    }

    // Stop arrow guide
    this.stopRunArrowGuide();

    // Hide SkiErg guides
    this.hideSkiergGuides();

    // Clean up rep popup
    if (this._repPopupInstance && !isNull(this._repPopupInstance)) {
      this._repPopupInstance.destroy();
      this._repPopupInstance = null;
      this._repPopupAnimating = false;
    }

    // Hide finish panel
    this.hideFinishPanel();

    // End HR session
    if (this.heartRateTracker) {
      this.heartRateTracker.endSession();
    }

    // Reset course
    var course = this.cm();
    if (course) {
      course.resetCourse();
    }

    this._state = RaceState.IDLE;
    this._raceStartTime = 0;
    this._currentStationIndex = -1;
    this._splitNames = [];
    this._splitDurations = [];
    this._splitAvgHR = [];
    this._splitPeakHR = [];
    this._splitEfforts = [];
    this._incompleteStations = [];
    this._stationProgress = 0;
    this._stationPath.reset();
    this._stationCompleting = false;
    this._currentConfig = null;
    this._run = undefined;
    this._runDistance = 0;
    this._runStartedAtRaceMs = 0;
    this._runPath.reset();
    this._lastPlayerPos = null;
    this._totalPausedTime = 0;
    this._pauseStartTime = 0;
    this._waitingForStartLineCross = false;
    this._startLinePos = null;
    this._startLineForward = null;
    this._gatePos = null;
    this._gateForward = null;
    this._previousGateDot = 1;
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Reset form detection state
    this.resetFormState();

    // Reset progress bar
    if (this.progressBar) {
      (this.progressBar as any).setProgress(0);
    }

    // Respawn START line
    this.respawnStartLine();

    // Re-enable HR status text, hide HR display
    if (this.hrStatusText) {
      this.hrStatusText.getSceneObject().enabled = true;
    }
    if (this.heartRateText) {
      this.heartRateText.getSceneObject().enabled = false;
    }
    if (this.hrZoneText) {
      this.hrZoneText.getSceneObject().enabled = false;
    }

    this.setUIIdle();
    print('[RaceStateMachine] Reset');

    // Show onboarding first, start button will show AFTER onboarding completes
    if (this.needsOnboarding()) {
      // Hide start button during onboarding
      if (this.startButtonObject) {
        this.startButtonObject.enabled = false;
      }
      if (this.instructionText) {
        this.instructionText.text = '';
      }
      this.showOnboarding();
    } else if (this.sessionPicker) {
      // Racing again is a chance to train something different, so the picker
      // comes back with the previous choice still selected — one pinch to
      // repeat, or change it.
      if (this.startButtonObject) {
        this.startButtonObject.enabled = false;
      }
      this.showSessionPicker();
    } else {
      // No picker - show start button immediately
      if (this.startButtonObject) {
        this.startButtonObject.enabled = true;
      }
      if (this.instructionText) {
        this.instructionText.text = 'Pinch Start to begin.';
      }
    }
  }

  /** Manually trigger HR scan (can be called from StartTrigger) */
  scanForHRMonitor(): void {
    if (this.heartRateTracker && !this.heartRateTracker.isConnected) {
      this.heartRateTracker.startScan();
    }
  }

  private respawnStartLine(): void {
    var course = this.cm();
    if (!course) return;

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();
    course.spawnStationInFrontOfPlayer(0, playerPos, playerForward);
    print('[RaceStateMachine] START line respawned');
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  private onUpdate(): void {
    var dt = getDeltaTime();

    // Always update animations
    this.updateTitleFade(dt);
    this.updateStatusZoom(dt);
    this.updateSkiergGuidesFade(dt);
    this.updateRepPopup(dt);
    this.updateStationNameZoom(dt);
    this.updateHeartPulse(dt);

    // Driven from the frame rather than a delayed callback, so a card that is
    // up when the session is paused or ended goes with it instead of
    // reappearing on top of whatever came next.
    this.updateBlockIntro();

    if (this._state === RaceState.COUNTDOWN) {
      this.updateCountdown(dt);
      return;
    }

    if (this._state === RaceState.RUNNING) {
      this.updateTimerUI();

      // Check for START line crossing before tracking distance
      if (this._waitingForStartLineCross) {
        this.checkStartLineCrossing();
        this.updateRunningUI();
        return;
      }

      var movedThisFrame = this.trackRunDistance();

      // The clock is fed what the tracker credited rather than a speed of its
      // own, so the two agree on what counts as moving by construction.
      // Fed only while the clock is running, so standing still never enters
      // the average as very slow running.
      if (!this._runClock.isStopped) {
        this._paceMeter.update(movedThisFrame, dt);

        if (this.runStretchCounts()) {
          this._countedMetres += movedThisFrame;
          this._countedMovingSeconds += dt;
        }
      }

      if (this._runClock.update(movedThisFrame, dt)) {
        print('[RaceStateMachine] Run clock ' +
              (this._runClock.isStopped ? 'held — athlete stopped' : 'running again') +
              ' at ' + this._runClock.movingSeconds.toFixed(1) + 's');
      }

      // Check if the run is complete
      if (this.runIsComplete()) {
        this.onRunComplete();
        return;
      }

      this.updateRunningUI();
      return;
    }

    if (this._state === RaceState.APPROACHING_STATION) {
      this.updateTimerUI();
      this.checkStationGateCrossing();
      // Only update UI if still approaching (not crossed yet)
      if (this._state === RaceState.APPROACHING_STATION) {
        this.updateApproachingUI();
      }
      return;
    }

    if (this._state === RaceState.APPROACHING_FINISH) {
      this.updateTimerUI();
      this.checkFinishGateCrossing();
      return;
    }

    if (this._state === RaceState.STATION) {
      this.updateTimerUI();
      if (this._currentConfig) {
        this.updateStationProgress(dt);
      }
      return;
    }
  }

  // ── Countdown ──────────────────────────────────────────────────────────────

  private updateCountdown(dt: number): void {
    this._countdownRemaining -= dt;

    // Update countdown zoom animation
    this.updateCountdownZoom(dt);

    // Show timer BG during countdown
    if (this.timerBG && !this.timerBG.enabled) {
      this.timerBG.enabled = true;
    }
    if (this.timerText) {
      this.timerText.text = '00:00';
    }

    // Show countdown in separate countdownText (or fallback to statusText)
    var countdownTarget = this.countdownText || this.statusText;
    var num = Math.ceil(this._countdownRemaining);

    // Detect number change to trigger effects
    if (num !== this._lastCountdownNum) {
      this._lastCountdownNum = num;

      if (countdownTarget) {
        countdownTarget.text = num > 0 ? num.toString() : 'GO!';
      }

      // Trigger zoom punch
      this.triggerCountdownZoom();

      // The start gun belongs to a race - to every race, including the ones
      // that will not count for anything.
      if (num <= 0 && this.isRace) {
        this.playCountdownGo();
      }
    }

    if (this._countdownRemaining <= 0) {
      this._raceStartTime = getTime() * 1000;

      // Delay hiding countdown text to show "GO!" briefly
      var hideDelay = this.createEvent('DelayedCallbackEvent');
      hideDelay.bind(() => {
        if (this.countdownText) {
          this.countdownText.getSceneObject().enabled = false;
        }
      });
      (hideDelay as DelayedCallbackEvent).reset(0.5);

      // Show station info BG after countdown
      if (this.stationInfoBG) {
        this.stationInfoBG.enabled = true;
      }
      this.startFirstStation();
      print('[RaceStateMachine] GO!');
    }
  }

  // ── Countdown Animation ─────────────────────────────────────────────────────

  private triggerCountdownZoom(): void {
    var target = this.countdownText || this.statusText;
    if (!target) return;

    if (this._countdownOriginalScale === null) {
      this._countdownOriginalScale = target.getSceneObject().getTransform().getLocalScale();
    }

    // GO! için daha küçük scale kullan
    var zoomScale = this._lastCountdownNum <= 0 ? this.COUNTDOWN_GO_ZOOM_SCALE : this.COUNTDOWN_ZOOM_SCALE;

    // Start big, animate to normal
    var transform = target.getSceneObject().getTransform();
    transform.setLocalScale(this._countdownOriginalScale.uniformScale(zoomScale));

    this._countdownAnimating = true;
    this._countdownAnimTime = 0;
  }

  private updateCountdownZoom(dt: number): void {
    if (!this._countdownAnimating) return;

    var target = this.countdownText || this.statusText;
    if (!target || this._countdownOriginalScale === null) return;

    this._countdownAnimTime += dt;
    var t = Math.min(1, this._countdownAnimTime / this.COUNTDOWN_ZOOM_DURATION);

    // Ease out - starts fast, slows down
    var eased = 1 - Math.pow(1 - t, 3);

    // GO! için daha küçük scale kullan
    var zoomScale = this._lastCountdownNum <= 0 ? this.COUNTDOWN_GO_ZOOM_SCALE : this.COUNTDOWN_ZOOM_SCALE;

    // Interpolate from zoom scale to 1.0
    var scale = zoomScale - (zoomScale - 1) * eased;
    var transform = target.getSceneObject().getTransform();
    transform.setLocalScale(this._countdownOriginalScale.uniformScale(scale));

    if (t >= 1) {
      transform.setLocalScale(this._countdownOriginalScale);
      this._countdownAnimating = false;
    }
  }

  private playCountdownBeep(): void {
    if (this.countdownBeepSound && !isNull(this.countdownBeepSound)) {
      this.countdownBeepSound.play(1);
    }
  }

  private playCountdownGo(): void {
    if (this.countdownGoSound && !isNull(this.countdownGoSound)) {
      this.countdownGoSound.play(1);
    }
  }

  // ── Station Name Zoom Animation ─────────────────────────────────────────────

  private triggerStationNameZoom(): void {
    if (!this.stationNameText) return;

    if (this._stationNameOriginalScale === null) {
      this._stationNameOriginalScale = this.stationNameText.getSceneObject().getTransform().getLocalScale();
    }

    // Start big, animate to normal
    var transform = this.stationNameText.getSceneObject().getTransform();
    transform.setLocalScale(this._stationNameOriginalScale.uniformScale(this.STATION_NAME_ZOOM_SCALE));

    this._stationNameAnimating = true;
    this._stationNameAnimTime = 0;
  }

  private updateStationNameZoom(dt: number): void {
    if (!this._stationNameAnimating || !this.stationNameText) return;

    this._stationNameAnimTime += dt;
    var t = Math.min(1, this._stationNameAnimTime / this.STATION_NAME_ZOOM_DURATION);

    // Ease out
    var eased = 1 - Math.pow(1 - t, 3);

    var scale = this.STATION_NAME_ZOOM_SCALE - (this.STATION_NAME_ZOOM_SCALE - 1) * eased;
    var transform = this.stationNameText.getSceneObject().getTransform();
    transform.setLocalScale(this._stationNameOriginalScale.uniformScale(scale));

    if (t >= 1) {
      transform.setLocalScale(this._stationNameOriginalScale);
      this._stationNameAnimating = false;
    }
  }

  // ── Rep Popup Animation (+1 floating text) ─────────────────────────────────

  private spawnRepPopup(): void {
    if (!this.repPopupPrefab || !this.camTransform) {
      print('[RepPopup] No prefab or camera');
      return;
    }

    // Destroy previous popup if still animating
    if (this._repPopupInstance && !isNull(this._repPopupInstance)) {
      this._repPopupInstance.destroy();
    }

    // Spawn prefab
    this._repPopupInstance = this.repPopupPrefab.instantiate(null);

    // Position in front of player (world space)
    var camPos = this.camTransform.getWorldPosition();
    var camForward = this.camTransform.back; // Spectacles camera looks down -Z
    var spawnPos = new vec3(
      camPos.x + camForward.x * 80,  // 80cm in front
      camPos.y,                       // Same height as eyes
      camPos.z + camForward.z * 80
    );

    var transform = this._repPopupInstance.getTransform();
    transform.setWorldPosition(spawnPos);

    // Face the camera (billboard effect)
    var lookDir = new vec3(
      camPos.x - spawnPos.x,
      0,
      camPos.z - spawnPos.z
    ).normalize();
    var angle = Math.atan2(lookDir.x, lookDir.z);
    transform.setWorldRotation(quat.fromEulerAngles(0, angle, 0));

    // Store start values for animation
    this._repPopupStartPos = spawnPos;
    this._repPopupStartScale = transform.getLocalScale();

    // Start small (will pop up)
    transform.setLocalScale(this._repPopupStartScale.uniformScale(0.3));

    // Start animation
    this._repPopupAnimating = true;
    this._repPopupAnimTime = 0;

    print('[RepPopup] Spawned at ' + spawnPos.x.toFixed(0) + ', ' + spawnPos.y.toFixed(0) + ', ' + spawnPos.z.toFixed(0));
  }

  private updateRepPopup(dt: number): void {
    if (!this._repPopupAnimating || !this._repPopupInstance || isNull(this._repPopupInstance)) {
      return;
    }

    this._repPopupAnimTime += dt;
    var t = this._repPopupAnimTime / this.REP_POPUP_TOTAL_DURATION;

    if (t >= 1) {
      // Animation complete - destroy
      this._repPopupInstance.destroy();
      this._repPopupInstance = null;
      this._repPopupAnimating = false;
      return;
    }

    var transform = this._repPopupInstance.getTransform();

    // Phase 1: Pop in (0 to POP_DURATION)
    if (this._repPopupAnimTime < this.REP_POPUP_POP_DURATION) {
      var popT = this._repPopupAnimTime / this.REP_POPUP_POP_DURATION;
      // Ease out elastic-ish: overshoot then settle
      var eased = 1 - Math.pow(1 - popT, 3);
      var scale = 0.3 + (this.REP_POPUP_POP_SCALE - 0.3) * eased;
      transform.setLocalScale(this._repPopupStartScale.uniformScale(scale));
    }
    // Phase 2: Float up and fade (POP_DURATION to end)
    else {
      var floatT = (this._repPopupAnimTime - this.REP_POPUP_POP_DURATION) / this.REP_POPUP_FLOAT_DURATION;
      floatT = Math.min(1, floatT);

      // Ease out for smooth deceleration
      var eased = 1 - Math.pow(1 - floatT, 2);

      // Float up
      var floatOffset = this.REP_POPUP_FLOAT_DISTANCE * eased;
      var newPos = new vec3(
        this._repPopupStartPos.x,
        this._repPopupStartPos.y + floatOffset,
        this._repPopupStartPos.z
      );
      transform.setWorldPosition(newPos);

      // Scale down slightly while floating
      var shrinkScale = this.REP_POPUP_POP_SCALE * (1 - eased * 0.3);
      transform.setLocalScale(this._repPopupStartScale.uniformScale(shrinkScale));

      // Fade out via material alpha (if available)
      this.setRepPopupAlpha(1 - eased);
    }
  }

  private setRepPopupAlpha(alpha: number): void {
    if (!this._repPopupInstance || isNull(this._repPopupInstance)) return;

    // Try to find Text3D or RenderMeshVisual to set alpha
    var text3d = this._repPopupInstance.getComponent('Component.Text3D');
    if (text3d) {
      var color = (text3d as any).textFill?.color;
      if (color) {
        (text3d as any).textFill.color = new vec4(color.r, color.g, color.b, alpha);
      }
      return;
    }

    // Fallback: try RenderMeshVisual
    var rmv = this._repPopupInstance.getComponent('Component.RenderMeshVisual');
    if (rmv) {
      var mat = (rmv as RenderMeshVisual).mainMaterial;
      if (mat && mat.mainPass) {
        var baseColor = mat.mainPass.baseColor;
        mat.mainPass.baseColor = new vec4(baseColor.r, baseColor.g, baseColor.b, alpha);
      }
    }
  }

  // ── Station Flow ───────────────────────────────────────────────────────────

  private startFirstStation(): void {
    var course = this.cm();
    if (!course) return;

    // Get START line position and forward direction for crossing detection
    var startStation = course.getActiveStation();
    if (startStation) {
      this._startLinePos = startStation.getTransform().getWorldPosition();
      var startForward = startStation.getTransform().forward;
      this._startLineForward = new vec3(startForward.x, 0, startForward.z).normalize();
    }

    // Set up first station config
    this._currentStationIndex = 1;
    this._currentConfig = course.getStationConfig(1);

    if (!this._currentConfig) {
      print('[RaceStateMachine] ERROR: No config for station 1');
      return;
    }

    // The opening block, announced here rather than by prepareForNextStation.
    //
    // Station one is reached from here and never from there, so moving the
    // announcement onto the next-station path silently skipped the first
    // block: the athlete finished the first warm-up drill before being told
    // there was a warm-up.
    this.enterBlockIfChanged();
    this.resetStationDisplay();

    // Set run target but DON'T start tracking yet
    if (hasRun(this._currentConfig.run)) {
      this.beginRun(this._currentConfig.run);
      this._runPath.reset();
      this._lastPlayerPos = null;

      // Every session begins by crossing the START line, an easy run
      // included. I had exempted the continuous run on the grounds that
      // nothing was laid out ahead of it, and that was simply wrong - the
      // line is spawned two metres in front during calibration, for every
      // session there is. What the exemption produced was a marker that
      // appeared and instantly faded while the log announced it had been
      // crossed, which is worse than either having a gate or not.
      //
      // It is a start gate and not a destination: what the athlete crosses to
      // begin, rather than something they are running towards.
      this._waitingForStartLineCross = true;

      this._state = RaceState.RUNNING;
      if (this.stationNameText) {
        this.stationNameText.text = this.runningPanelName();
        this.triggerStationNameZoom();
      }
      this.setStatusLine('');
      this.triggerStatusZoom();

      print('[RaceStateMachine] Waiting for START line crossing...');
      this.updateRunningUI();
    } else {
      course.fadeOutAndDestroy(() => {
        this.spawnStationAndApproach();
      });
    }
  }

  private onStartLineCrossed(): void {
    print('[RaceStateMachine] START line crossed! Beginning distance tracking.');

    this._waitingForStartLineCross = false;
    this._startLinePos = null;
    this._startLineForward = null;

    // Reset camera tracking position
    this._lastPlayerPos = null;

    // Reset HR tracking for this split
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Arrows point at the next station. A run written to the clock has none -
    // it ends when the time is up, wherever the athlete happens to be.
    if (this._run && this._run.kind === 'DISTANCE') {
      this.startRunArrowGuide();
    }

    // Fade out START line
    var course = this.cm();
    if (course) {
      course.fadeOutAndDestroy(() => {
        print('[RaceStateMachine] START line faded out');
      });
    }

    print('[RaceStateMachine] RUN ' + this.runPrescriptionLabel() +
          (isRunOnlyStation(this._currentConfig)
            ? '' : ' to ' + this._currentConfig.name));
  }

  private checkStartLineCrossing(): void {
    if (!this._startLinePos || !this._startLineForward) {
      this.onStartLineCrossed();
      return;
    }

    var playerPos = this.getPlayerPosition();

    var toPlayer = new vec3(
      playerPos.x - this._startLinePos.x,
      0,
      playerPos.z - this._startLinePos.z
    );

    var dot = toPlayer.x * this._startLineForward.x + toPlayer.z * this._startLineForward.z;

    if (dot < 0) {
      this.onStartLineCrossed();
    }
  }

  private checkStationGateCrossing(): void {
    if (!this._gatePos || !this._gateForward) {
      this.onStationGateCrossed();
      return;
    }

    var playerPos = this.getPlayerPosition();

    // Vector from gate to player (horizontal only)
    var toPlayer = new vec3(
      playerPos.x - this._gatePos.x,
      0,
      playerPos.z - this._gatePos.z
    );

    // Current dot product (positive = in front of gate, negative = behind/past)
    var currentDot = toPlayer.x * this._gateForward.x + toPlayer.z * this._gateForward.z;

    // Lateral distance (perpendicular to gate forward)
    var gateRight = new vec3(-this._gateForward.z, 0, this._gateForward.x);
    var lateralDist = Math.abs(toPlayer.x * gateRight.x + toPlayer.z * gateRight.z);

    // PRIMARY: Plane crossing within gate width
    var crossedPlane = this._previousGateDot > 0 && currentDot <= 0;
    var withinGateWidth = lateralDist < this.GATE_HALF_WIDTH;

    if (crossedPlane && withinGateWidth) {
      print('[RaceStateMachine] Gate crossed via plane detection');
      this.onStationGateCrossed();
      return;
    }

    // FALLBACK: Very close proximity (safety net)
    var distance = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.z * toPlayer.z);
    if (distance < this.PROXIMITY_FALLBACK) {
      print('[RaceStateMachine] Gate crossed via proximity fallback (' + distance.toFixed(0) + 'cm)');
      this.onStationGateCrossed();
      return;
    }

    // Update previous dot for next frame
    this._previousGateDot = currentDot;
  }

  private onStationGateCrossed(): void {
    print('[RaceStateMachine] Station gate crossed: ' + this._currentConfig.name);

    this._gatePos = null;
    this._gateForward = null;
    this._previousGateDot = 1;
    this._lastPlayerPos = null;

    // Clear "Cross station line" text
    this.setStatusLine('');

    // Now enter station mode
    this.enterStationMode();
  }

  private checkFinishGateCrossing(): void {
    if (!this._gatePos || !this._gateForward) {
      this.onFinishGateCrossed();
      return;
    }

    var playerPos = this.getPlayerPosition();

    // Vector from gate to player (horizontal only)
    var toPlayer = new vec3(
      playerPos.x - this._gatePos.x,
      0,
      playerPos.z - this._gatePos.z
    );

    // Current dot product (positive = in front of gate, negative = behind/past)
    var currentDot = toPlayer.x * this._gateForward.x + toPlayer.z * this._gateForward.z;

    // Lateral distance (perpendicular to gate forward)
    var gateRight = new vec3(-this._gateForward.z, 0, this._gateForward.x);
    var lateralDist = Math.abs(toPlayer.x * gateRight.x + toPlayer.z * gateRight.z);

    // PRIMARY: Plane crossing within gate width
    var crossedPlane = this._previousGateDot > 0 && currentDot <= 0;
    var withinGateWidth = lateralDist < this.GATE_HALF_WIDTH;

    if (crossedPlane && withinGateWidth) {
      print('[RaceStateMachine] FINISH gate crossed via plane detection');
      this.onFinishGateCrossed();
      return;
    }

    // FALLBACK: Very close proximity (safety net)
    var distance = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.z * toPlayer.z);
    if (distance < this.PROXIMITY_FALLBACK) {
      print('[RaceStateMachine] FINISH gate crossed via proximity (' + distance.toFixed(0) + 'cm)');
      this.onFinishGateCrossed();
      return;
    }

    // Update previous dot for next frame
    this._previousGateDot = currentDot;
  }

  private onFinishGateCrossed(): void {
    print('[RaceStateMachine] FINISH LINE CROSSED!');

    this._gatePos = null;
    this._gateForward = null;
    this._previousGateDot = 1;

    // Clear status text
    this.setStatusLine('');

    // Now finish the race
    this.finishRace();
  }

  /**
   * The panel while the athlete walks up to a station.
   *
   * Every readout here is written each frame rather than once on entering the
   * state, and that is the point. Zeroing the bar at the transition was tried
   * first and it still came up full: the athlete saw the next movement's name
   * over the last one's finished bar. I could not find the second writer by
   * reading, and chasing it is the wrong shape of fix anyway - approaching a
   * station is a state in which that station's work has not started, so its
   * progress is zero by definition, not by whoever last wrote to it.
   *
   * Same for what comes next. Left to whatever the previous station set, it
   * named a movement two ahead of the one being walked to.
   */
  private updateApproachingUI(): void {
    if (this._blockIntroShowing) {
      // Held, and said the moment the card is gone.
      this.setStatusLine('Cross station line');
      return;
    }

    // Only called for DISTANCE mode stations
    this.setStatusLine('Cross station line');
    if (this.stationNameText) {
      this.stationNameText.text = this._currentConfig ? this._currentConfig.name : '';
    }
    if (this.progressText) {
      this.progressText.text = '';
    }
    if (this.progressBar) {
      (this.progressBar as any).setProgress(0);
    }
    if (this.nextStationText) {
      var course = this.cm();
      var afterIdx = this._currentStationIndex + 1;
      var after = course && afterIdx < course.stationCount
        ? course.getStationConfig(afterIdx)
        : null;
      this.nextStationText.text = after ? 'Next: ' + after.name : 'Next: FINISH';
    }
  }

  /**
   * Show the next movement in the training zone.
   *
   * Only movements that stay put belong in a fixed zone. A bear crawl, a
   * carry, a burpee broad jump all travel: pinning them to an anchor would
   * leave the athlete metres away from the next exercise and walking back.
   * Those keep the course behaviour of spawning ahead, and the zone follows
   * the athlete afterwards.
   *
   * Rest never becomes a place at all. Walking to a rest station was the
   * clearest sign that a gym session had been squeezed into a race course.
   *
   * @returns true when this station was handled here
   */
  private presentTrainingStation(course: any): boolean {
    if (!this._currentConfig) return false;

    // A travelling movement left the athlete somewhere new
    if (this._lastTrainingMoved) {
      this.setTrainingAnchor();
      this._lastTrainingMoved = false;
    }

    if (this._currentConfig.prefabType === 'REST') {
      course.destroyActiveStation();
      this.enterStationMode();
      return true;
    }

    if (!isStationary(this._currentConfig)) {
      // Let the course path place it ahead, and re-anchor once it is done
      this._lastTrainingMoved = true;
      return false;
    }

    if (!this._trainingAnchorPos) this.setTrainingAnchor();
    if (!this._trainingAnchorPos) return false;

    course.spawnStationAtAnchor(
      this._currentStationIndex,
      this._trainingAnchorPos,
      this._trainingAnchorForward
    );

    // Nothing to walk to, so nothing to approach - the movement starts now
    this.enterStationMode();
    return true;
  }

  /** True when the movement just shown travels, so the zone must follow */
  private _lastTrainingMoved: boolean = false;

  private prepareForNextStation(): void {
    var course = this.cm();
    if (!course) return;

    this._currentStationIndex++;

    if (this._currentStationIndex >= course.stationCount) {
      this.finishRace();
      return;
    }

    this._currentConfig = course.getStationConfig(this._currentStationIndex);

    if (!this._currentConfig) {
      print('[RaceStateMachine] ERROR: No config for station ' + this._currentStationIndex);
      return;
    }

    // The block starts here, before its first instruction is carried out.
    //
    // This used to hang off entering a station, which is not the same moment:
    // a block whose first item is a run announced itself once the run was
    // already over, so the athlete heard "the real work begins - 6m run and
    // then the carry" having just done the 6m run.
    this.enterBlockIfChanged();

    // The bar belongs to whatever the panel is naming. It used to be reset
    // only when the work started, so the moment the next movement's name
    // appeared it was still showing the previous one finished at 100%.
    this.resetStationDisplay();

    // Training ends when the work ends. There is no line to cross, because
    // there was never a course laid out to cross it on.
    if (this._currentConfig.isFinish && this.isTrainingSession) {
      course.destroyActiveStation();
      print('[RaceStateMachine] Training session complete');
      this.finishRace();
      return;
    }

    // Check if this is the finish marker (not a workout station)
    if (this._currentConfig.isFinish) {
      // Spawn FINISH prefab for visual effect
      var playerPos = this.getPlayerPosition();
      var playerForward = this.getPlayerForward();
      course.spawnStationInFrontOfPlayer(this._currentStationIndex, playerPos, playerForward);

      // Store gate position for crossing detection
      this._gatePos = new vec3(
        playerPos.x + playerForward.x * 200,  // 2m ahead
        playerPos.y,
        playerPos.z + playerForward.z * 200
      );
      this._gateForward = new vec3(playerForward.x, 0, playerForward.z).normalize();
      this._previousGateDot = 1;

      // Enter APPROACHING_FINISH state - wait for user to cross
      this._state = RaceState.APPROACHING_FINISH;
      if (this.stationNameText) {
        this.stationNameText.text = 'FINISH';
        this.triggerStationNameZoom();
      }
      this.setStatusLine('Cross the finish line!');
      this.triggerStatusZoom();

      print('[RaceStateMachine] APPROACHING_FINISH - cross the line!');
      return;
    }

    // Check if there's a run before this station
    if (hasRun(this._currentConfig.run)) {
      this.beginRun(this._currentConfig.run);

      // Reset HR tracking for this split
      this._splitHRReadings = [];
      this._splitPeakBPM = 0;

      // A timed run has no destination, so there is nothing to point at. The
      // arrows exist to say "the next station is that way"; on a fifteen
      // minute easy run they would be pointing at a spot the athlete runs
      // straight past four minutes in.
      if (this._currentConfig.run.kind === 'DISTANCE') {
        this.startRunArrowGuide();
      }

      this._state = RaceState.RUNNING;
      if (this.stationNameText) {
        this.stationNameText.text = 'RUN';
        this.triggerStationNameZoom();
      }
      this.clearStatusUnlessBanner();
      print('[RaceStateMachine] RUN ' + this.runPrescriptionLabel() +
            (isRestStation(this._currentConfig)
              ? '' : ' to ' + this._currentConfig.name));
      this.updateRunningUI();
    } else {
      this.spawnStationAndApproach();
    }
  }

  private onRunComplete(): void {
    var result = this.runResult();
    var pace = runPaceSecPerKm(result);

    // The prescription named here is the executed one, which in the editor is
    // the preview override and not what the session asked for. Saying so is
    // the same separation the plan log makes, in the one place a number gets
    // printed next to a measurement and could be mistaken for it.
    var cm = this.cm();
    var executed = cm && cm.isPreviewSimplified ? ' executed' : ' prescribed';

    var stood = result.elapsedSeconds - result.movingSeconds;

    print('[RaceStateMachine] Run complete! ran ' +
          result.distanceMetres.toFixed(1) + 'm in ' +
          result.movingSeconds.toFixed(1) + 's moving' +
          (stood > 1 ? ' (+' + stood.toFixed(1) + 's stood still)' : '') +
          ' (' + this.runPrescriptionLabel() + executed + ')' +
          (pace === null ? '' : ' — ' + this.formatTime(pace * 1000) + '/km'));

    // The part the session is measured on, when it is not the whole run.
    //
    // The line above said "measured" for the whole thing, which now means
    // something narrower: an easy run's settling minutes are excluded, so the
    // number the analysis reads is not the number that was printed. One word
    // for two quantities in the one place they appear together.
    var counted = measuredPaceSecPerKm(result);
    if (counted !== null && Math.abs(counted - (pace === null ? counted : pace)) > 1) {
      print('[RaceStateMachine]   measured on ' +
            result.measured.distanceMetres.toFixed(1) + 'm in ' +
            result.measured.movingSeconds.toFixed(1) + 's — ' +
            this.formatTime(counted * 1000) + '/km  (settling excluded)');
    }

    // Stop arrow guide
    this.stopRunArrowGuide();

    // Record split with HR data
    // A run is named for where it leads, which is right in a race - the run
    // to the ski erg is the run to the ski erg. In an interval session what
    // follows every rep is the recovery walk, so eight intervals all came
    // back as "Run to WALK": the work named after the rest. Here the run is
    // the movement, so it is named as one.
    var runName = isRunOnlyStation(this._currentConfig)
      ? this._currentConfig.name
      : isRestStation(this._currentConfig)
        ? this.runPrescriptionLabel() + ' RUN'
        : 'Run to ' + this._currentConfig.name;
    var runDuration = this.calculateSplitDuration();
    this._splitNames.push(runName);
    this._splitDurations.push(runDuration);
    this._splitAvgHR.push(this.calculateSplitAvgHR());
    this._splitPeakHR.push(this._splitPeakBPM);

    // The distance recorded is the one that was measured, not the one that
    // was asked for - and for a timed run those are not even the same kind of
    // number. Pace is distance over time either way, so the analysis reads
    // the observation and never the prescription.
    this.recordEffort(
      runName, 'RUN', 'RUN',
      this._run && this._run.kind === 'TIME' ? this._run.seconds : result.distanceMetres,
      runDuration, result);

    print('[RaceStateMachine] ' + runName + ': ' + (runDuration / 1000).toFixed(1) + 's, Avg HR: ' + this._splitAvgHR[this._splitAvgHR.length - 1]);

    // A run is the one thing that legitimately moves a training session, so
    // the zone is re-placed where the athlete actually ended up.
    if (this.isTrainingSession) {
      this.setTrainingAnchor();
    }

    // Where the run was the whole station there is nothing to arrive at. The
    // engine's ordinary path spawns the station the run led to and waits for
    // the athlete to reach it, and for a continuous easy run that station is
    // an empty marker with no way to complete: the session stopped there.
    if (isRunOnlyStation(this._currentConfig)) {
      this._run = undefined;
      this._runDistance = 0;
      this._runStartedAtRaceMs = 0;
      this._runPath.reset();
      this._splitHRReadings = [];
      this._splitPeakBPM = 0;

      var done = this.cm();
      if (done) {
        done.fadeOutAndDestroy(() => { this.prepareForNextStation(); });
      } else {
        this.prepareForNextStation();
      }
      return;
    }

    // Clear run state
    this._run = undefined;
    this._runDistance = 0;
    this._runStartedAtRaceMs = 0;
    this._runPath.reset();
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Spawn station and wait for gate crossing
    this.spawnStationAndApproach();
  }

  private spawnStationAndApproach(): void {
    var course = this.cm();
    if (!course) return;

    if (this.isTrainingSession && this.presentTrainingStation(course)) {
      return;
    }

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();

    var spawnReferencePos = new vec3(
      playerPos.x + playerForward.x * 200,
      playerPos.y,
      playerPos.z + playerForward.z * 200
    );

    course.spawnStationInFrontOfPlayer(this._currentStationIndex, spawnReferencePos, playerForward);

    // Only use APPROACHING_STATION for DISTANCE mode (sled push, etc.)
    // Rep-based stations (ZONE_HIT, REPS, TIMED) enter immediately
    if (this._currentConfig.mode !== StationMode.DISTANCE) {
      this.enterStationMode();
      return;
    }

    // Set up gate plane for crossing detection (DISTANCE mode only)
    var activeStation = course.getActiveStation();
    if (activeStation) {
      this._gatePos = activeStation.getTransform().getWorldPosition();
      var fwd = activeStation.getTransform().forward;
      this._gateForward = new vec3(fwd.x, 0, fwd.z).normalize();
      this._previousGateDot = 1;  // Start positive (behind gate)

      this._state = RaceState.APPROACHING_STATION;
      print('[RaceStateMachine] APPROACHING_STATION: ' + this._currentConfig.name);
    } else {
      // Fallback: enter immediately if no station
      this.enterStationMode();
    }
  }

  /**
   * Zero the progress readout for a movement that has not started yet.
   *
   * Called when the panel starts naming a new movement, which is earlier than
   * when its work begins - there is a run, or a walk to the station, in
   * between. Without it the bar sat full under the new name.
   */
  private resetStationDisplay(): void {
    if (this.progressText) this.progressText.text = '';
    if (this.progressBar) (this.progressBar as any).setProgress(0);
  }

  private enterStationMode(): void {
    this._stationStartTime = getTime() * 1000;
    this._stationProgress = 0;
    this._repsBeforeStation = 0;
    this._stationPath.reset();
    this._stationRequirement = this._currentConfig.requirement;
    this._stationCompleting = false;  // Reset completion guard
    this._lastPlayerPos = null;

    // Reset HR tracking for this split
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Reset form detection state for DISTANCE stations
    this.resetFormState();

    // Start hand zone detection for ZONE_HIT stations
    if (this._currentConfig.mode === StationMode.ZONE_HIT) {
      if (this.handZoneDetector && this._currentConfig.motionType) {
        var stationPos: vec3 = null;
        var targetObject: SceneObject = null;

        if (this._currentConfig.motionType === MotionType.OVERHEAD_REACH) {
          var course = this.cm();
          var activeStation = course?.getActiveStation();
          if (activeStation) {
            stationPos = activeStation.getTransform().getWorldPosition();
            // Find target sphere child (for squat press, wallball, etc.)
            targetObject = this.findTargetSphere(activeStation);
          }
        }

        this.handZoneDetector.startDetection(
          this._currentConfig.motionType as any,
          (repCount: number) => {
            // Anything done while the block card is up was done before the
            // movement was asked for. The detector counts from where it is,
            // so what it had counted by then is subtracted rather than the
            // detector being restarted underneath itself.
            if (this._blockIntroShowing) {
              this._repsBeforeStation = repCount;
              return;
            }

            // Fade out SkiErg guides on first rep
            if (repCount === 1 && this._skiergGuidesActive) {
              this.startSkiergGuidesFadeout();
            }

            // Show +1 popup for each rep
            this.spawnRepPopup();
            this.playGoodFormSound();

            this._stationProgress = repCount - this._repsBeforeStation;
            this.updateStationUI();

            if (this._stationProgress >= this._stationRequirement) {
              this.completeCurrentStation();
            }
          },
          null,
          stationPos,
          targetObject
        );
      }
    }

    // Show SkiErg guides if this is a SkiErg station
    var stationName = this._currentConfig.name.toUpperCase();
    if (stationName.indexOf('SKIERG') >= 0 || stationName.indexOf('SKI ERG') >= 0) {
      this.showSkiergGuides();
    } else {
      this.hideSkiergGuides();
    }

    this._state = RaceState.STATION;

    if (this.stationNameText) {
      this.stationNameText.text = this._currentConfig.name;
      this.triggerStationNameZoom();
    }

    if (this.nextStationText) {
      this.nextStationText.text = '';
    }

    this.clearStatusUnlessBanner();

    print('[RaceStateMachine] Entered: ' + this._currentConfig.name);
    this.updateStationUI();
  }

  // ── Station Progress ───────────────────────────────────────────────────────

  private updateStationProgress(dt: number): void {
    if (!this._currentConfig) return;

    // Nothing counts while the block is being introduced. The athlete is
    // reading what they are about to do, not doing it.
    if (this._blockIntroShowing) return;

    var mode = this._currentConfig.mode;

    switch (mode) {
      case StationMode.TIMED:
        this._stationProgress += dt;
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.DISTANCE:
        this.trackStationDistance();
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.REPS:
        // Burpee uses camera-based rep detection (drop/rise/jump)
        this.trackBurpeeReps();
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.VERTICAL_REPS:
      case StationMode.LATERAL_REPS:
        this.trackOscillationReps(mode === StationMode.LATERAL_REPS);
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      // ZONE_HIT is handled by callback in handZoneDetector
    }

    this.updateStationUI();
  }

  private trackStationDistance(): void {
    // Camera-based distance tracking
    var playerPos = this.getPlayerPosition();
    if (!playerPos) return;

    // Get raw camera Y for form detection (not floor-adjusted)
    var cameraY = this.camTransform ? this.camTransform.getWorldPosition().y : playerPos.y;
    this.updateCameraYHistory(cameraY);

    this._stationProgress += this.travelledThisFrame(this._stationPath);

    // Form detection based on station type
    if (this._currentConfig) {
      var stationName = this._currentConfig.name.toUpperCase();
      if (stationName.indexOf('BURPEE') >= 0) {
        this.checkBurpeeForm(cameraY);
      } else if (stationName.indexOf('LUNGE') >= 0) {
        this.checkLungeForm(cameraY);
      }
    }
  }

  /**
   * Track burpee reps using camera-based detection (hard gate)
   * Requires: DROP (head down 40cm) → RISE → JUMP (forward 50cm)
   */
  private trackBurpeeReps(): void {
    if (!this.camTransform) return;

    var cameraY = this.camTransform.getWorldPosition().y;
    this.updateCameraYHistory(cameraY);

    // Run the burpee form state machine
    this.checkBurpeeForm(cameraY);

    // Use good reps as station progress
    this._stationProgress = this._burpeeGoodReps;
  }

  /**
   * Count accessory reps from head movement.
   *
   * A press up, an air squat and a sit up are all the same shape to the
   * camera: the head drops by some amount and comes back. The amount differs
   * enormously between them, so each station carries its own dropCm.
   *
   * Deliberately separate from the burpee tracker. That one is tuned on the
   * device and gates on forward travel; reusing it here would either break the
   * burpee or make every accessory require a jump.
   *
   * @param lateral also require a sideways hop, for burpee over dumbbell
   */
  private trackOscillationReps(lateral: boolean): void {
    if (!this.camTransform || !this._currentConfig) return;

    var pos = this.camTransform.getWorldPosition();
    var dropNeeded = this._currentConfig.dropCm > 0
      ? this._currentConfig.dropCm
      : this.DEFAULT_ACCESSORY_DROP_CM;

    switch (this._oscState) {
      case 'waiting_drop':
        // Track the highest point so far - that is the top of the rep
        if (pos.y > this._oscTopY) this._oscTopY = pos.y;

        if (this._oscTopY - pos.y >= dropNeeded) {
          this._oscState = lateral ? 'waiting_rise_lateral' : 'waiting_rise';
          this._oscBottomY = pos.y;
          this._oscSidePos = new vec3(pos.x, 0, pos.z);
        }
        break;

      case 'waiting_rise':
        // Back up most of the way down counts as a completed rep
        if (pos.y - this._oscBottomY >= dropNeeded * 0.8) {
          this.completeOscillationRep(pos);
        }
        break;

      case 'waiting_rise_lateral':
        if (pos.y - this._oscBottomY >= dropNeeded * 0.8) {
          this._oscState = 'waiting_hop';
          this._oscSidePos = new vec3(pos.x, 0, pos.z);
        }
        break;

      case 'waiting_hop':
        var dx = pos.x - this._oscSidePos.x;
        var dz = pos.z - this._oscSidePos.z;

        if (Math.sqrt(dx * dx + dz * dz) >= this.LATERAL_HOP_CM) {
          this.completeOscillationRep(pos);
        }
        break;
    }

    this._stationProgress = this._oscReps;
  }

  private completeOscillationRep(pos: vec3): void {
    this._oscReps++;
    this._oscState = 'waiting_drop';
    this._oscTopY = pos.y;

    this.showBurpeeFeedback('+1');
    this.playGoodFormSound();

    print('[FormDetect] Accessory rep #' + this._oscReps +
          ' (' + this._currentConfig.name + ')');
  }

  private resetOscillationState(): void {
    this._oscState = 'waiting_drop';
    this._oscReps = 0;
    this._oscBottomY = 0;
    this._oscSidePos = null;
    this._oscTopY = this.camTransform
      ? this.camTransform.getWorldPosition().y
      : 0;
  }

  // ── Form Detection ──────────────────────────────────────────────────────────

  private updateCameraYHistory(cameraY: number): void {
    this._cameraYHistory.push(cameraY);
    if (this._cameraYHistory.length > this.CAMERA_Y_HISTORY_SIZE) {
      this._cameraYHistory.shift();
    }
  }

  private resetFormState(): void {
    this.resetOscillationState();
    this._cameraYHistory = [];
    this._burpeeState = 'waiting_drop';
    this._burpeeDropY = 0;
    this._burpeeGoodReps = 0;
    this._burpeeJumpStartPos = null;
    this._burpeeJumpForward = null;
    this._burpeeLastFeedbackTime = 0;
    this._burpeeStationStartTime = getTime();
    this._lungeBounceCount = 0;
    this._lungeDirection = 'rising';

    // Initialize peak/valley Y from current camera position
    if (this.camTransform) {
      var currentY = this.camTransform.getWorldPosition().y;
      this._lungeLastPeakY = currentY;
      this._lungeLastValleyY = currentY;
    } else {
      this._lungeLastPeakY = 0;
      this._lungeLastValleyY = 0;
    }
  }

  private checkBurpeeForm(cameraY: number): void {
    if (this._cameraYHistory.length < 5) return;

    var startY = this._cameraYHistory[0];
    var now = getTime();
    var canShowFeedback = (now - this._burpeeLastFeedbackTime) >= this.BURPEE_FEEDBACK_COOLDOWN;
    var stationElapsed = this._burpeeStationStartTime > 0 ? (now - this._burpeeStationStartTime) : 0;

    switch (this._burpeeState) {
      case 'waiting_drop':
        // Waiting for user to drop down (head goes low)
        if (startY - cameraY > this.BURPEE_DROP_THRESHOLD) {
          this._burpeeDropY = cameraY;
          this._burpeeState = 'waiting_rise';
          this.showBurpeeFeedback('DROP!');
          print('[FormDetect] Burpee: DROP detected');
        } else if (canShowFeedback && stationElapsed > this.BURPEE_FIRST_FEEDBACK_DELAY) {
          // Show feedback after initial delay (even for first rep)
          this.showBurpeeFeedback('GET LOWER');
          this._burpeeLastFeedbackTime = now;
        }
        break;

      case 'waiting_rise':
        // Waiting for user to rise back up
        if (cameraY - this._burpeeDropY > this.BURPEE_DROP_THRESHOLD * 0.7) {
          // Record position and forward direction when rise completes
          if (this.camTransform) {
            var pos = this.camTransform.getWorldPosition();
            this._burpeeJumpStartPos = new vec3(pos.x, pos.y, pos.z);
            // Get flat forward direction (Spectacles camera looks down -Z, so use back)
            var fwd = this.camTransform.back;
            this._burpeeJumpForward = new vec3(fwd.x, 0, fwd.z).normalize();
          }
          this._burpeeState = 'waiting_jump';
          this.showBurpeeFeedback('JUMP!');
          print('[FormDetect] Burpee: RISE detected, waiting for forward jump');
        }
        break;

      case 'waiting_jump':
        // Waiting for forward displacement (jump in facing direction)
        if (this._burpeeJumpStartPos !== null && this._burpeeJumpForward !== null && this.camTransform) {
          var currentPos = this.camTransform.getWorldPosition();
          var dx = currentPos.x - this._burpeeJumpStartPos.x;
          var dz = currentPos.z - this._burpeeJumpStartPos.z;

          // Project movement onto forward direction (dot product)
          var forwardDist = dx * this._burpeeJumpForward.x + dz * this._burpeeJumpForward.z;

          // DEBUG: Log forward distance
          print('[Burpee DEBUG] forwardDist=' + forwardDist.toFixed(1) + ' dx=' + dx.toFixed(1) + ' dz=' + dz.toFixed(1));

          if (forwardDist >= this.BURPEE_JUMP_DISTANCE) {
            this._burpeeGoodReps++;
            print('[FormDetect] Burpee: GOOD REP #' + this._burpeeGoodReps + ' (forward: ' + forwardDist.toFixed(0) + 'cm)');
            this.showBurpeeFeedback('+1');
            this.playGoodFormSound();
            this._burpeeState = 'waiting_drop';
            this._burpeeJumpStartPos = null;
            this._burpeeJumpForward = null;
            // Reset start Y for next rep
            this._cameraYHistory = [cameraY];
          } else if (canShowFeedback) {
            // Not jumping forward enough
            this.showBurpeeFeedback('JUMP FORWARD');
            this._burpeeLastFeedbackTime = now;
          }
        }
        break;
    }
  }

  private showBurpeeFeedback(msg: string): void {
    // Use animated popup for +1 rep count
    if (msg === '+1') {
      this.spawnRepPopup();
      print('[Burpee] +1 (popup)');
      return;
    }

    // Use instructionText for other feedback (DROP!, JUMP!, etc.)
    if (this.instructionText) {
      this.instructionText.text = msg;
    }
    print('[Burpee] ' + msg);
  }

  private checkLungeForm(cameraY: number): void {
    if (this._cameraYHistory.length < 10) return;

    var currentTime = getTime();

    // Detect vertical bounce pattern (head goes down during lunge)
    if (this._lungeDirection === 'rising') {
      if (cameraY < this._lungeLastPeakY - this.LUNGE_BOUNCE_THRESHOLD) {
        // Started falling - found a peak
        this._lungeDirection = 'falling';
        this._lungeLastValleyY = cameraY;
      } else if (cameraY > this._lungeLastPeakY) {
        this._lungeLastPeakY = cameraY;
      }
    } else {
      // falling
      if (cameraY > this._lungeLastValleyY + this.LUNGE_BOUNCE_THRESHOLD) {
        // Started rising - found a valley, count bounce
        this._lungeBounceCount++;
        this._lungeDirection = 'rising';
        this._lungeLastPeakY = cameraY;
        print('[FormDetect] Lunge: BOUNCE #' + this._lungeBounceCount);

        // Every 3 bounces, play positive feedback
        if (this._lungeBounceCount % 3 === 0) {
          this.playGoodFormSound();
        }
      } else if (cameraY < this._lungeLastValleyY) {
        this._lungeLastValleyY = cameraY;
      }
    }

    // If user has traveled distance without bounces, remind them
    var expectedBounces = Math.floor(this._stationProgress * 2);  // ~2 lunges per meter
    if (expectedBounces > 3 && this._lungeBounceCount < expectedBounces * 0.3) {
      this.playFormReminder();
    }
  }

  private isAIBusy(): boolean {
    if (this.aiCoach && !isNull(this.aiCoach)) {
      return (this.aiCoach as any).isBusy === true;
    }
    return false;
  }

  private playFormReminder(): void {
    var currentTime = getTime();
    if (currentTime - this._lastFormReminderTime < this.FORM_REMINDER_COOLDOWN) return;

    // Skip if AI is speaking/processing/recording
    if (this.isAIBusy()) {
      print('[FormDetect] Skipping form reminder - AI is busy');
      return;
    }

    this._lastFormReminderTime = currentTime;

    // Prefer AI coach voice for form reminders
    if (this.aiCoach && !isNull(this.aiCoach)) {
      var exerciseName = this._currentConfig?.name || 'exercise';
      (this.aiCoach as any).speakFormReminder(exerciseName);
      print('[FormDetect] AI coach speaking form reminder for: ' + exerciseName);
      return;
    }

    // Fallback to SFX if AI coach not available
    if (this.formReminderSound && !isNull(this.formReminderSound)) {
      this.formReminderSound.play(1);
      print('[FormDetect] Playing form reminder SFX (fallback)');
    }
  }

  private playGoodFormSound(): void {
    // Skip SFX if AI is speaking/processing/recording
    if (this.isAIBusy()) {
      print('[FormDetect] Skipping good form sound - AI is busy');
      return;
    }

    if (this.goodFormSound && !isNull(this.goodFormSound)) {
      this.goodFormSound.play(1);
    }
  }

  // ── Run Tracking (Camera-based) ───────────────────────────────────────────

  /** @returns metres credited this frame */
  private trackRunDistance(): number {
    var moved = this.travelledThisFrame(this._runPath);
    this._runDistance += moved;
    return moved;
  }

  /** Start serving a run, whichever way it was asked for */
  private beginRun(run: RunPrescription): void {
    this._run = run;
    this._runDistance = 0;
    this._runStartedAtRaceMs = this.getRaceElapsedMsAt(getTime() * 1000);
    this._runPath.reset();
    this._runClock.reset();
    this._paceMeter.reset();
    this._countedMetres = 0;
    this._countedMovingSeconds = 0;
    this._announcedPhase = '';
    this._lastPlayerPos = null;
  }

  /** Seconds of running since the run began, pauses excluded */
  private runElapsedSeconds(): number {
    var now = this.getRaceElapsedMsAt(getTime() * 1000);
    return Math.max(0, now - this._runStartedAtRaceMs) / 1000;
  }

  /**
   * Whether the run is over - on the ground or on the clock, according to
   * what it asked for. This is the whole of the difference between the two
   * kinds at runtime; everything else about them is identical.
   */
  private runIsComplete(): boolean {
    if (!hasRun(this._run)) return false;

    return this._run.kind === 'TIME'
      ? this._runClock.movingSeconds >= this._run.seconds
      : this._runDistance >= this._run.metres;
  }

  /**
   * What the panel calls the running.
   *
   * A run that leads somewhere is "RUN" - it is the gap between two things,
   * and the thing it leads to is named next. A run that is the session is
   * named for the stretch of it the athlete is in: an easy run opens by
   * settling and then it is just easy, and saying so is the whole of what
   * absorbing the warm-up left behind for the athlete to notice.
   */
  private runningPanelName(): string {
    if (!isRunOnlyStation(this._currentConfig)) return 'RUN';

    var phase = phaseAt(this._run, this._runClock.movingSeconds);
    return phase ? phase.label : this._currentConfig.name;
  }

  /**
   * Say once, in the log, when the run changes character.
   *
   * The transition is the whole of what absorbing the warm-up left for the
   * athlete to notice, and it happens silently by design - nothing spawns,
   * nothing ends. Which also means that from a log alone there is no way to
   * tell it happened at all, and "I saw it on screen" is not something a test
   * or a bug report can carry.
   */
  private reportPhaseChange(): void {
    var phase = phaseAt(this._run, this._runClock.movingSeconds);
    var label = phase ? phase.label : '';

    if (label === this._announcedPhase) return;

    if (this._announcedPhase !== '' && label !== '') {
      print('[RaceStateMachine] Run phase: ' + this._announcedPhase + ' → ' +
            label + ' at ' + this._runClock.movingSeconds.toFixed(1) + 's');
    }

    this._announcedPhase = label;
  }

  /**
   * The line under the run: how to run it.
   *
   * Three cases, in order. A prescribed pace band with the athlete's current
   * pace beside it, where they have an anchor to have been prescribed from.
   * The stretch cue, where the run changes character partway through. And
   * otherwise the archetype's effort target, which is what a coach says when
   * they do not know your pace - which is most of the time, and is a real
   * prescription rather than the absence of one.
   *
   * Nothing here can fail. A pace outside the band is not a miss; the band is
   * where the athlete is trying to be, and telling them they are outside it
   * is the whole of what showing it achieves.
   */
  private runningGuidance(): string {
    var target = this.runPaceTarget();

    if (target) {
      var current = this._paceMeter.secPerKm;
      return 'TARGET ' + formatPaceBand(target) +
             (current === null ? '' : '   ·   ' + formatPace(current) + ' /km');
    }

    if (isRunOnlyStation(this._currentConfig)) {
      var phase = phaseAt(this._run, this._runClock.movingSeconds);
      if (phase) return phase.cue;
    }

    return this.archetypeEffortShort();
  }

  /** Whether the stretch of the run being served is one the session measures */
  private runStretchCounts(): boolean {
    var phase = phaseAt(this._run, this._runClock.movingSeconds);
    return phase ? phase.counts : true;
  }

  /** The band this run was prescribed at, or null - which is the usual case */
  private runPaceTarget(): PaceTarget | null {
    var config = this._currentConfig;
    return config && config.paceTarget ? config.paceTarget : null;
  }

  /** The archetype's effort target at panel length, or '' */
  private archetypeEffortShort(): string {
    var config = this._currentConfig;
    if (!config || !config.archetype) return '';

    var topology = RUNNING_TOPOLOGY[config.archetype as RunningArchetype];
    return topology ? topology.effortShort : '';
  }

  /** What the run asked for, in its own unit: "400m" or "12:00" */
  private runPrescriptionLabel(): string {
    if (!hasRun(this._run)) return 'none';
    return this._run.kind === 'TIME'
      ? formatRunClock(this._run.seconds)
      : this._run.metres + 'm';
  }

  /**
   * What the run produced.
   *
   * Both numbers, always. One of them is the prescription restated and the
   * other is a measurement, and which is which depends on the kind - so a
   * caller that wants pace does not need to know which kind it was.
   */
  private runResult(): RunResult {
    var whole = {
      movingSeconds: this._runClock.movingSeconds,
      elapsedSeconds: this.runElapsedSeconds(),
      distanceMetres: this._runDistance,
    };

    // A run with no preparatory stretch is measured on all of itself, which
    // is every run but the easy one.
    var counted = this._countedMovingSeconds > 0
      ? { movingSeconds: this._countedMovingSeconds, distanceMetres: this._countedMetres }
      : { movingSeconds: whole.movingSeconds, distanceMetres: whole.distanceMetres };

    return {
      measured: counted,
      movingSeconds: whole.movingSeconds,
      elapsedSeconds: whole.elapsedSeconds,
      distanceMetres: whole.distanceMetres,
    };
  }

  /**
   * Metres the athlete covered since the last frame, once the tracker has
   * been given a chance to disbelieve it.
   *
   * Raw frame-to-frame addition credits head jitter, the jump when tracking
   * is reacquired, and any relocalisation that moves the origin. All three
   * inflate the distance in the athlete's favour, which is the direction that
   * matters: a carry that finishes itself while somebody stands still is not
   * a carry.
   */
  private travelledThisFrame(tracker: PathTracker): number {
    var playerPos = this.getPlayerPosition();

    return tracker.update({
      x: playerPos ? playerPos.x : 0,
      z: playerPos ? playerPos.z : 0,
      dt: getDeltaTime(),
      valid: !!playerPos && this.hasCameraPose(),
    });
  }

  /**
   * Whether the head pose can be believed this frame.
   *
   * Spectacles does not hand us a tracking-quality flag here, so this is what
   * can be checked: a transform that exists and a position that is not the
   * origin, which is where an untracked camera sits.
   */
  private hasCameraPose(): boolean {
    if (!this.camTransform) return false;

    var p = this.camTransform.getWorldPosition();
    if (!p) return false;

    return !(p.x === 0 && p.y === 0 && p.z === 0);
  }

  /** Distance covered during a run segment */
  private _runPath: PathTracker = new PathTracker();
  /** Distance covered during a travelling station */
  private _stationPath: PathTracker = new PathTracker();

  // ── Station Completion ─────────────────────────────────────────────────────

  private completeCurrentStation(): void {
    // Guard against double completion (called multiple times before state changes)
    if (this._stationCompleting) {
      return;
    }
    this._stationCompleting = true;

    var name = this._currentConfig ? this._currentConfig.name : 'Station';
    var mode = this._currentConfig ? this._currentConfig.mode : null;
    var duration = this.calculateSplitDuration();

    // Stop hand zone detection for ZONE_HIT stations
    if (mode === StationMode.ZONE_HIT) {
      if (this.handZoneDetector) {
        this.handZoneDetector.stopDetection();
      }
    }

    // Hide SkiErg guides when station completes
    this.hideSkiergGuides();

    // Clear feedback text (e.g., burpee "+1")
    if (this.instructionText) this.instructionText.text = '';

    // Clean up any active rep popup
    if (this._repPopupInstance && !isNull(this._repPopupInstance)) {
      this._repPopupInstance.destroy();
      this._repPopupInstance = null;
      this._repPopupAnimating = false;
    }

    // Record split with HR data
    this._splitNames.push(name);
    this._splitDurations.push(duration);
    this._splitAvgHR.push(this.calculateSplitAvgHR());
    this._splitPeakHR.push(this._splitPeakBPM);

    this.recordEffort(
      name,
      this._currentConfig ? this._currentConfig.prefabType : '',
      mode ? String(mode) : '',
      this._stationRequirement,
      duration
    );

    print('[RaceStateMachine] ' + name + ' COMPLETE — ' + (duration / 1000).toFixed(1) + 's, Avg HR: ' + this._splitAvgHR[this._splitAvgHR.length - 1]);

    // Reset HR tracking
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Fade out current station and prepare for next
    var course = this.cm();
    if (course) {
      course.fadeOutAndDestroy(() => {
        this.prepareForNextStation();
      });
    } else {
      this.prepareForNextStation();
    }
  }

  private finishRace(): void {
    var totalMs = this.getRaceElapsedMsAt(getTime() * 1000);
    this._state = RaceState.FINISHED;

    // End HR session
    var hrStats = { avgBPM: 0, peakBPM: 0 };
    if (this.heartRateTracker) {
      hrStats = this.heartRateTracker.endSession();
    }

    // Clear running UI
    this.hideBlockIntro();
    if (this.blockLabelText) this.blockLabelText.text = '';
    if (this.blockProgressText) this.blockProgressText.text = '';
    this.setStatusLine('');
    if (this.stationNameText) this.stationNameText.text = '';
    if (this.nextStationText) this.nextStationText.text = '';
    if (this.progressText) this.progressText.text = '';
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.stationInfoBG) this.stationInfoBG.enabled = false;
    if (this.timerText) this.timerText.text = '';
    if (this.timerBG) this.timerBG.enabled = false;
    if (this.instructionText) this.instructionText.text = '';

    this.recordTrainingOutcome(true);
    this.recordRacePaceEvidence();

    // Interpret the race before the panel reads it
    this.publishRaceResult(totalMs, true, hrStats, null);

    // Show finish panel
    this.showFinishPanel(true, totalMs, hrStats, null);

    // Save to cloud
    this.saveRaceToCloud(totalMs, true, hrStats);

    print('[RaceStateMachine] FINISHED ' + (totalMs / 1000).toFixed(1) + 's');
    if (hrStats.avgBPM > 0) {
      print('[RaceStateMachine] Avg HR: ' + hrStats.avgBPM + ', Peak HR: ' + hrStats.peakBPM);
    }
  }

  /** Stop race early - shows summary with incomplete stations */
  stopRace(): void {
    // The same rule the coach asks about, asked here too.
    //
    // Keeping a second list of live states in this method was the bug: the
    // coach's guard was fixed and this one was not, so the model called
    // stopSession from APPROACHING_STATION, this refused, and the athlete
    // was told the session could not be stopped while standing in front of
    // the station they were about to do.
    if (!this.isUnderway) {
      print('[RaceStateMachine] Nothing to stop - state is ' + this._state);
      return;
    }

    var totalMs = this.getRaceElapsedMsAt(getTime() * 1000);
    this._state = RaceState.FINISHED;

    // Stop hand zone detection
    if (this.handZoneDetector) {
      this.handZoneDetector.stopDetection();
    }

    // Hide SkiErg guides
    this.hideSkiergGuides();

    // End HR session
    var hrStats = { avgBPM: 0, peakBPM: 0 };
    if (this.heartRateTracker) {
      hrStats = this.heartRateTracker.endSession();
    }

    // Nothing was trained, but this session has been seen and thrown away, so
    // the next draw has to be a different one.
    this.recordTrainingOutcome(false);

    // Fade out current station
    var course = this.cm();
    if (course) {
      course.fadeOutAndDestroy(() => {});
    }

    // Build incomplete stations list
    var incompleteStations: string[] = [];
    if (course) {
      var totalStations = course.stationCount;
      var nextIdx = this._currentStationIndex;
      for (var k = nextIdx; k < totalStations; k++) {
        var config = course.getStationConfig(k);
        if (config) {
          incompleteStations.push(config.name);
        }
      }
    }

    // Clear running UI
    this.hideBlockIntro();
    if (this.blockLabelText) this.blockLabelText.text = '';
    if (this.blockProgressText) this.blockProgressText.text = '';
    this.setStatusLine('');
    if (this.stationNameText) this.stationNameText.text = '';
    if (this.nextStationText) this.nextStationText.text = '';
    if (this.progressText) this.progressText.text = '';
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.stationInfoBG) this.stationInfoBG.enabled = false;
    if (this.timerText) this.timerText.text = '';
    if (this.timerBG) this.timerBG.enabled = false;
    if (this.instructionText) this.instructionText.text = '';

    // Interpret the race before the panel reads it
    this.publishRaceResult(totalMs, false, hrStats, incompleteStations);

    // Show finish panel
    this.showFinishPanel(false, totalMs, hrStats, incompleteStations);

    // Save to cloud (incomplete)
    this.saveRaceToCloud(totalMs, false, hrStats);

    print('[RaceStateMachine] STOPPED at ' + (totalMs / 1000).toFixed(1) + 's');
  }


  // ── Race Result ────────────────────────────────────────────────────────────

  /**
   * Snapshot the race as an immutable value and hand it to the results layer.
   * Called before the finish panel is shown so the panel can read the verdict.
   */
  private publishRaceResult(
    totalMs: number,
    completed: boolean,
    hrStats: { avgBPM: number, peakBPM: number },
    incompleteStations: string[]
  ): void {
    var splits: RaceSplit[] = [];
    for (var i = 0; i < this._splitNames.length; i++) {
      splits.push(makeRaceSplit(
        this._splitNames[i],
        this._splitDurations[i],
        this._splitAvgHR[i] || 0,
        this._splitPeakHR[i] || 0
      ));
    }

    var course = this.cm();
    var plan = course ? course.activePlan : null;

    var result: RaceResult = makeRaceResult({
      finishedAtMs: getTime() * 1000,
      totalMs: totalMs,
      completed: completed,
      splits: splits,
      avgHR: hrStats ? hrStats.avgBPM : 0,
      peakHR: hrStats ? hrStats.peakBPM : 0,
      maxHR: this.profileManager ? this.profileManager.getMaxHeartRate() : 0,
      configKey: course && course.getConfigKey ? course.getConfigKey() : '',
      sessionKind: plan ? plan.kind : 'RACE',
      sessionTitle: plan ? plan.title : '',
      countsForRanking: this.isRaceSession(),
      incompleteStations: incompleteStations || [],
    });

    this.results().process(result);
    this.pushVerdictToCoach();
    this.pushLimiterToPicker();
  }

  /**
   * Give the coach the same reading the panel shows. The AI narrates it; it
   * never recomputes it.
   *
   * A race gets the verdict - splits measured against what was expected of
   * them. A training session gets the training analysis instead, which is a
   * different question with different answers available, not a degraded
   * version of the same one.
   */
  private pushVerdictToCoach(): void {
    if (!this.aiCoach) return;

    var coach = this.aiCoach as any;
    if (!coach.setSessionAnalysisContext) return;

    var context = this.isTrainingSession
      ? trainingAiContext(this.analyseTrainingSession())
      : this.results().aiContext;

    coach.setSessionAnalysisContext(context);
  }

  /**
   * Say which part of the session the athlete has arrived at.
   *
   * The state machine walks a flat list of stations, so without this a warm-up
   * drill is indistinguishable from the work: the same panel, the same voice,
   * no sense of having finished anything. Announced once per block, on screen
   * and out loud.
   */
  private enterBlockIfChanged(): void {
    if (!this._currentConfig) return;

    var blockIndex = this._currentConfig.blockIndex;
    if (blockIndex === undefined || blockIndex === this._announcedBlock) return;

    var previous = this._announcedBlock;
    this._announcedBlock = blockIndex;

    var scheme = this._currentConfig.blockScheme || '';
    var label = this._currentConfig.blockLabel || '';

    this.showBlockIntro(blockIndex);
    this.showBlockLabel(this.blockLineFor(blockIndex, label));

    var coach = this.aiCoach as any;
    if (!coach || !coach.speakShout) {
      print('[RaceStateMachine] Block ' + blockIndex + ': ' + label);
      return;
    }

    if (scheme === 'WARMUP') {
      coach.speakShout(
        'The athlete is starting a training session with a warm-up: ' + label +
        '. In one short sentence tell them to start easy and loosen up, and say ' +
        'that this is the warm-up.'
      );
    } else if (previous >= 0 && this.wasWarmup(previous)) {
      // The one moment the effort cue belongs: the athlete is about to start
      // working and has been told what to do but not how hard to do it.
      coach.speakShout(
        'The warm-up is done. The working set starts now: ' + label +
        '. Tell them the real work begins and give them this effort target in ' +
        'the same breath, in one or two short sentences: ' + this.effortCue()
      );
    } else if (previous < 0 && this.isTrainingSession) {
      // A session that opens without a warm-up has no warm-up-is-over moment
      // to hang the effort cue on, and it is the session that needs it most:
      // an easy run absorbs its warm-up, so the only thing standing between
      // the athlete and running it too hard is being told not to.
      //
      // It was getting "next block, tell them what is coming" - a line
      // written for the third block of a session, said to somebody who has
      // not started one.
      coach.speakShout(
        'The athlete is starting a training session: ' + label +
        '. Tell them it begins now and give them this effort target in the ' +
        'same breath, in one or two short sentences: ' + this.effortCue()
      );
    } else if (scheme === 'EMOM' || label.indexOf('Finisher') === 0) {
      coach.speakShout(
        'Last block, the finisher: ' + label +
        '. In one short sentence tell them this is the last one.'
      );
    } else {
      coach.speakShout(
        'Next block: ' + label + '. In one short sentence tell them what is coming.'
      );
    }

    print('[RaceStateMachine] Block ' + blockIndex + ' (' + scheme + '): ' + label);
  }

  /**
   * How hard this session is meant to feel.
   *
   * Effort rather than pace: pace has to be anchored to the athlete's own
   * threshold, and until that is either asked for or measured, any number
   * would be invented. A seven out of ten is a seven for everybody.
   */
  private effortCue(): string {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    if (!plan || plan.kind !== 'TRAINING') return '';

    // An archetype knows how hard it is meant to feel, and the focus does
    // not: RUNNING covers an easy run and a set of fast repetitions, and it
    // was telling the athlete to hold seven out of ten through a session
    // whose whole point is that no repetition is run tired.
    var block = this._currentConfig;
    if (block && block.archetype) {
      var topology = RUNNING_TOPOLOGY[block.archetype as RunningArchetype];
      if (topology && topology.effortCue) return topology.effortCue;
    }

    return effortCueFor(this.trainingFocus()).spoken;
  }

  /**
   * Whether the session warmed the athlete up inside its own first block.
   *
   * Read from the plan rather than inferred from the absence of a warm-up in
   * the efforts: "no warm-up recorded" and "the warm-up was the first two
   * minutes of the run" are different things, and only one of them is worth
   * telling somebody about.
   */
  private sessionWarmsItself(): boolean {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    if (!plan || !plan.blocks || plan.blocks.length === 0) return false;

    return plan.blocks[0].selfWarming === true;
  }

  /** The focus the loaded session was generated from, read off its id */
  private trainingFocus(): Focus {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    var id = plan && plan.id ? plan.id : '';

    if (id.indexOf('-running-') >= 0) return 'RUNNING';
    if (id.indexOf('-engine-') >= 0) return 'ENGINE';
    if (id.indexOf('-strength-') >= 0) return 'STRENGTH';
    return 'MIXED';
  }

  /**
   * Put the block on screen.
   *
   * blockLabelText is an optional input, and an optional input that is simply
   * not wired fails silently - which is what happened: the coach announced
   * every block out loud while the panel said nothing at all, and nothing in
   * the log explained why. So it warns once and falls back to the status line,
   * which is always wired. A missing wire should cost polish, not the
   * information.
   */
  private showBlockLabel(label: string): void {
    var text = label ? label.toUpperCase() : '';

    if (this.blockLabelText) {
      this.blockLabelText.text = text;
      return;
    }

    if (!this._warnedBlockLabel) {
      this._warnedBlockLabel = true;
      print('[RaceStateMachine] WARN: blockLabelText is not wired; ' +
            'showing block names on the status line instead');
    }

    if (this.statusText) {
      this.statusText.text = text;
      this.triggerStatusZoom();
      this._blockBannerUntil = getTime() + RaceStateMachine.BLOCK_BANNER_SECONDS;
    }
  }

  // ── Block intro ─────────────────────────────────────────────────────────

  /** The block the card is describing, and when it went up */
  private _blockIntroStartedAt: number = 0;
  private _blockIntroShowing: boolean = false;

  /**
   * Repetitions the detector had counted before the movement was asked for.
   *
   * Subtracted rather than restarting the detector, which is holding state of
   * its own about where the hands are and would have to find it again.
   */
  private _repsBeforeStation: number = 0;

  /** The blocks of the loaded session, or an empty list */
  private planBlocks(): SessionBlock[] {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    return plan && plan.blocks ? plan.blocks : [];
  }

  /**
   * The short line that stays up during the work.
   *
   * Falls back to the full label where the card is not wired: without
   * somewhere to have shown the movements, shortening the line would lose
   * them entirely.
   */
  private blockLineFor(blockIndex: number, label: string): string {
    if (!this.blockIntroBodyText) return label;

    var blocks = this.planBlocks();
    var block = blocks.length > blockIndex ? blocks[blockIndex] : null;
    if (!block) return label;

    // Counted among the blocks that are the session. A warm-up is what
    // happens before it and comes back unnumbered.
    var at = workingPositionOf(blocks, blockIndex);

    var lines = blockLines(block, at.index, at.count, 1, 1, !!this.blockProgressText);
    return lines.label || label;
  }

  /**
   * Put the card up.
   *
   * Nothing happens where it is not wired, and nothing happens for a block
   * with nothing to say about it - a card that appears for everything is one
   * nobody reads by the third time.
   */
  private showBlockIntro(blockIndex: number): void {
    if (!this.blockIntroBodyText && !this.blockIntroGroup) return;

    var blocks = this.planBlocks();
    var block = blocks.length > blockIndex ? blocks[blockIndex] : null;
    if (!block) return;

    var at = workingPositionOf(blocks, blockIndex);
    var card = blockIntroCard(block, at.index, at.count);
    if (!worthIntroducing(card)) return;

    this.setText(this.blockIntroEyebrowText, card.eyebrow);
    this.setText(this.blockIntroBodyText, introBody(card));
    this.setText(this.blockIntroFooterText, card.footer);
    this.setText(this.blockIntroCueText, card.cue);

    this.setBlockIntroAlpha(1);
    this.setBlockIntroVisible(true);

    this._blockIntroStartedAt = getTime();
    this._blockIntroShowing = true;

    // Anything the status line was about to say waits its turn.
    if (this.statusText && this._statusLine) this.statusText.text = '';

    this.setActiveHudVisible(false);
  }

  /**
   * Take it down again, over the last half second of its life.
   *
   * Driven from the frame loop rather than a delayed callback: a session that
   * is paused, or ended, in the middle of a card must not have it reappear
   * two seconds later on top of something else.
   */
  private updateBlockIntro(): void {
    if (!this._blockIntroShowing) return;

    var elapsed = getTime() - this._blockIntroStartedAt;
    var opacity = introOpacity(elapsed);

    if (opacity <= 0) {
      this.hideBlockIntro();
      return;
    }

    this.setBlockIntroAlpha(opacity);
  }

  private hideBlockIntro(): void {
    var wasShowing = this._blockIntroShowing;

    this._blockIntroShowing = false;
    this.setBlockIntroAlpha(1);
    this.setBlockIntroVisible(false);
    this.setActiveHudVisible(true);

    // Whatever was waiting behind it, now that there is room for it.
    this.renderStatusLine();

    // The work starts now rather than three seconds ago.
    //
    // The athlete spent the card reading it, and a movement whose clock was
    // running while they read is a movement they were given less of. Only the
    // station's own clock moves: the session clock is how long they have been
    // here, which includes reading.
    if (wasShowing && this._state === RaceState.STATION) {
      this._stationStartTime = getTime() * 1000;
      this._stationProgress = 0;
      this._stationPath.reset();
    }
  }

  /**
   * Everything the card is standing in for, while it is up.
   *
   * Hidden rather than drawn behind: the first three seconds of a block had
   * the movement list and the movement's own readouts on top of each other,
   * which is two answers to "what am I doing" at the moment somebody is
   * asking it for the first time.
   *
   * The block name and the position go too. The card is saying both, in
   * bigger type, and a card that has to compete with a smaller copy of its
   * own heading is not introducing anything.
   *
   * The session clock stays. It is how long they have been training, which
   * is true while they read.
   */
  private setActiveHudVisible(visible: boolean): void {
    this.setTextVisible(this.blockLabelText, visible);
    this.setTextVisible(this.blockProgressText, visible);

    this.setTextVisible(this.stationNameText, visible);
    this.setTextVisible(this.stationInfoText, visible);
    this.setTextVisible(this.progressText, visible);
    this.setTextVisible(this.nextStationText, visible);

    if (this.stationInfoBG && !isNull(this.stationInfoBG)) {
      this.stationInfoBG.enabled = visible;
    }

    if (this.progressBar) {
      var bar = this.progressBar.getSceneObject();
      if (!isNull(bar)) bar.enabled = visible;
    }
  }

  // ── The status line, while a card is in front of it ─────────────────────
  //
  // "Cross station line" and the block's movement list were landing in the
  // same place at the same time, and the athlete got both on top of each
  // other at exactly the moment they needed to read one of them.
  //
  // They are also in the right order already: what the set holds, and then
  // where to stand for it. So the line waits, and says itself the moment the
  // card is gone.

  /** What the status line would say if nothing were in front of it */
  private _statusLine: string = '';

  private setStatusLine(text: string): void {
    this._statusLine = text || '';

    // Clearing is immediate and unconditional. Held back, it would come back
    // on its own the next time a card went away - saying "cross station line"
    // to somebody already standing at the station.
    if (!this._statusLine) {
      if (this.statusText) this.statusText.text = '';
      return;
    }

    this.renderStatusLine();
  }

  /**
   * Show whatever the line is waiting to say.
   *
   * Only ever writes something it was given. The status line is borrowed by
   * the block banner where no block label is wired, and re-asserting an empty
   * string here would wipe it mid-sentence.
   */
  private renderStatusLine(): void {
    if (!this.statusText) return;
    if (!this._statusLine) return;

    this.statusText.text = this._blockIntroShowing ? '' : this._statusLine;
  }

  private setBlockIntroVisible(visible: boolean): void {
    if (this.blockIntroGroup && !isNull(this.blockIntroGroup)) {
      this.blockIntroGroup.enabled = visible;
      return;
    }

    // No group to hide, so the fields hide themselves.
    this.setTextVisible(this.blockIntroEyebrowText, visible);
    this.setTextVisible(this.blockIntroBodyText, visible);
    this.setTextVisible(this.blockIntroFooterText, visible);
    this.setTextVisible(this.blockIntroCueText, visible);
  }

  private setBlockIntroAlpha(alpha: number): void {
    this.setTextAlpha(this.blockIntroEyebrowText, alpha);
    this.setTextAlpha(this.blockIntroBodyText, alpha);
    this.setTextAlpha(this.blockIntroFooterText, alpha);
    this.setTextAlpha(this.blockIntroCueText, alpha);
    this.setBackdropAlpha(alpha);
  }

  /** What the card's backdrop looked like before anything faded it */
  private _backdropColor: vec4 = null;
  private _backdropBorderColor: vec4 = null;

  /**
   * Fade the surface with the words on it.
   *
   * Its own opacity is read once and kept, so a fade never compounds: taken
   * from the live value each time, three seconds of fading would leave the
   * panel a little more transparent on every block until it was gone.
   */
  private setBackdropAlpha(alpha: number): void {
    var backdrop = this.blockIntroBackground as any;
    if (!backdrop) return;

    try {
      if (backdrop.backgroundColor) {
        if (!this._backdropColor) this._backdropColor = backdrop.backgroundColor;

        var base = this._backdropColor;
        backdrop.backgroundColor = new vec4(base.r, base.g, base.b, base.a * alpha);
      }

      if (backdrop.border && backdrop.borderColor) {
        if (!this._backdropBorderColor) this._backdropBorderColor = backdrop.borderColor;

        var edge = this._backdropBorderColor;
        backdrop.borderColor = new vec4(edge.r, edge.g, edge.b, edge.a * alpha);
      }
    } catch (e) {
      // A backdrop that cannot fade still appears and disappears on time
    }
  }

  /** Fade where the text supports it; where it does not, it simply goes */
  private setTextAlpha(text: Text, alpha: number): void {
    if (!text) return;

    try {
      var fill = (text as any).textFill;
      if (fill && fill.color) {
        var c = fill.color;
        fill.color = new vec4(c.r, c.g, c.b, alpha);
      }
    } catch (e) {
      // An older Text without a fill still appears and disappears on time
    }
  }

  private setText(text: Text, value: string): void {
    if (text) text.text = value;
  }

  private setTextVisible(text: Text, visible: boolean): void {
    if (!text) return;

    try {
      var obj = text.getSceneObject();
      if (!isNull(obj)) obj.enabled = visible;
    } catch (e) {
      // Nothing to show or hide
    }
  }

  /**
   * Clear the status line, unless it is currently carrying a block name.
   *
   * The first thing a new block does is start its first instruction, and that
   * instruction wipes the status line on the same frame. Without this the
   * borrowed banner would be gone before it was ever drawn.
   */
  private clearStatusUnlessBanner(): void {
    if (!this.statusText) return;
    if (getTime() < this._blockBannerUntil) return;

    this.setStatusLine('');
  }

  /** Roughly how long the coach takes to say the block out loud */
  private static readonly BLOCK_BANNER_SECONDS: number = 4;

  private _blockBannerUntil: number = 0;
  private _warnedBlockLabel: boolean = false;

  /**
   * Record what the plan asked of a split, alongside how long it took.
   *
   * Both numbers are needed and neither is enough: the analysis divides one
   * by the other to get a rate, and a rate is the only quantity in a training
   * session that the plan did not already decide.
   */
  private recordEffort(
    name: string,
    prefabType: string,
    mode: string,
    prescribed: number,
    durationMs: number,
    run?: RunResult
  ): void {
    var config = this._currentConfig;
    var pace = run ? measuredPaceSecPerKm(run) : null;

    this._splitEfforts.push({
      paceSecPerKm: pace === null ? undefined : pace,
      activeMs: run ? run.movingSeconds * 1000 : undefined,
      measuredMetres: run ? run.measured.distanceMetres : undefined,
      archetype: config && config.archetype ? String(config.archetype) : undefined,
      paceBand: config && config.paceTarget ? config.paceTarget.band : null,
      prescribedKind: this._run
        ? (this._run.kind === 'TIME' ? 'TIME' : 'DISTANCE')
        : undefined,
      name: name,
      prefabType: prefabType,
      mode: mode,
      prescribed: prescribed || 0,
      durationMs: durationMs,
      recoveryKind: config && config.recoveryKind ? String(config.recoveryKind) : '',
      blockScheme: config && config.blockScheme ? String(config.blockScheme) : '',
      blockIndex: config && config.blockIndex !== undefined ? config.blockIndex : -1,
      roundIndex: config && config.roundIndex !== undefined ? config.roundIndex : 0,
      avgHR: this.calculateSplitAvgHR(),
    });
  }

  /**
   * Read the session the way a coach would.
   *
   * Preview is never trustworthy: hand-tracked stations auto-complete on a
   * timer there, so the durations describe the harness. The same bear crawl
   * came out at 10.3s on one preview run and 0.9s on the next.
   */
  private analyseTrainingSession(): TrainingSummary {
    var course = this.cm();
    var trustworthy = !(course && course.isPreviewSimplified === true);

    return analyseTraining(this._splitEfforts, trustworthy, this.sessionWarmsItself());
  }

  /**
   * A generated session is spent once it ends, one way or the other.
   *
   * Finishing it is training and counts as history. Walking out of it is not
   * training and counts as nothing - except that the session was seen, so the
   * next one drawn must be a different one. Those are two different counters
   * and this is the only place either of them moves.
   */
  /**
   * What a finished race says about the pace this athlete holds in one.
   *
   * The only source there is for it. No amount of road running predicts what
   * somebody holds over eight kilometres with eight stations between them, so
   * the race-pace band is measured or it does not exist - which is why this
   * writes down what was measured and nothing derived from it.
   *
   * Gated on the race counting for ranking, which is the same question asked
   * a different way: a course that was scaled, shortened or previewed is not
   * a race, and a pace read off one is not a race pace. Preview sessions in
   * particular auto-complete on a timer, and the numbers describe the harness.
   */
  private recordRacePaceEvidence(): void {
    if (!this.profileManager) return;
    if (this.isPreviewSimplified) return;
    if (!this.isRaceSession()) return;

    var samples = raceRunSamples(this._splitEfforts, Date.now());
    if (samples.length === 0) return;

    this.profileManager.recordRaceRuns(samples);
  }

  private recordTrainingOutcome(completed: boolean): void {
    if (!this.profileManager) return;

    var course = this.cm();
    var plan = course ? course.activePlan : null;
    if (!plan || plan.kind !== 'TRAINING' || plan.source !== 'generated') return;

    var wasPreview = course.isPreviewSimplified === true;

    if (completed) {
      // The archetype comes from the plan rather than from the movements: a
      // threshold repetition and a maximal aerobic one are both "a run", and
      // what separates them does not survive being reduced to a prefab name.
      this.profileManager.recordCompletedTraining(
        extractMovements(plan.stations), wasPreview, archetypeOf(plan));

      // What the running measured, kept as observations. A preview measures
      // the harness rather than the athlete, so it contributes nothing here
      // for the same reason it contributes nothing to their history.
      if (!wasPreview) {
        this.profileManager.recordRunObservations(
          runObservations(this._splitEfforts, Date.now()));
      }
    } else {
      this.profileManager.recordAbandonedTraining(wasPreview);
    }
  }

  /** How many blocks the loaded session has */
  get trainingBlockCount(): number {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    return plan && plan.blocks ? plan.blocks.length : 0;
  }

  private wasWarmup(blockIndex: number): boolean {
    var course = this.cm();
    if (!course || !course.stationConfigs) return false;

    for (var i = 0; i < course.stationConfigs.length; i++) {
      if (course.stationConfigs[i].blockIndex === blockIndex) {
        return course.stationConfigs[i].blockScheme === 'WARMUP';
      }
    }
    return false;
  }

  /** Block the athlete was last told about, so each is announced once */
  private _announcedBlock: number = -1;

  // ── Training zone ────────────────────────────────────────────────────────
  //
  // A race lays itself out ahead of the athlete. A training session happens on
  // one spot: the movement changes, the place does not. The anchor is set once
  // when the session starts and again after any real run, because a run does
  // move the athlete.

  private _trainingAnchorPos: vec3 = null;
  private _trainingAnchorForward: vec3 = null;

  private clearTrainingAnchor(): void {
    this._trainingAnchorPos = null;
    this._trainingAnchorForward = null;
    this._lastTrainingMoved = false;
  }

  private setTrainingAnchor(): void {
    var pos = this.getPlayerPosition();
    var forward = this.getPlayerForward();
    if (!pos || !forward) return;

    this._trainingAnchorPos = new vec3(
      pos.x + forward.x * this.trainingZoneDistance,
      pos.y,
      pos.z + forward.z * this.trainingZoneDistance
    );
    this._trainingAnchorForward = new vec3(forward.x, 0, forward.z).normalize();

    print('[RaceStateMachine] Training zone set at (' +
          this._trainingAnchorPos.x.toFixed(0) + ', ' +
          this._trainingAnchorPos.z.toFixed(0) + ')');
  }

  /** True when the loaded session is training rather than a race */
  get isTrainingSession(): boolean {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    return !!plan && plan.kind === 'TRAINING';
  }

  /**
   * True while a session is actually happening.
   *
   * Written as "not idle and not over" rather than as a list of live states.
   * The list was the bug: stop and pause accepted RUNNING, STATION and PAUSED
   * only, so an athlete walking up to a station - APPROACHING_STATION, a
   * perfectly ordinary place to be - asked the coach to stop and was told it
   * could not. Any state added later is live by default, which is the safe
   * direction: refusing to stop is worse than stopping from an odd state.
   */
  get isUnderway(): boolean {
    return isSessionUnderway(this._state);
  }

  /** True when there is something running that could be paused */
  get isPausable(): boolean {
    return isSessionPausable(this._state);
  }

  /** True when something is waiting to be resumed */
  get isPaused(): boolean {
    return isSessionPaused(this._state);
  }

  /**
   * What can honestly be said about the session so far, mid-session.
   *
   * The coach was asked "which station is the worst for me right now?" four
   * movements into a workout containing no burpees, and answered "burpee
   * broad jump" - read straight off the personal-best splits of past races.
   * The question was about now; the answer was about a different session
   * months ago, stated as a fact about the present.
   *
   * So the same discipline the post-session summary uses applies live: what
   * has been measured so far, and an explicit statement when that is nothing.
   */
  get liveTrainingContext(): string {
    if (!this.isTrainingSession) return '';

    var summary = this.analyseTrainingSession();
    return trainingAiContext(summary);
  }

  /** 'RACE' or 'TRAINING' - the single fact every layer's wording hangs off */
  get sessionKind(): string {
    var course = this.cm();
    var plan = course ? course.activePlan : null;
    return plan && plan.kind ? plan.kind : 'RACE';
  }

  /** The vocabulary that belongs to the loaded session */
  get sessionSemantics(): SessionSemantics {
    return semanticsFor(this.sessionKind);
  }

  /**
   * Relabel the finish panel's primary button.
   *
   * The label lives in the scene, so it is whatever it was authored as -
   * "RACE AGAIN" - no matter what the athlete just did. Rather than ask for
   * another @input to wire, find the label under the button: the buttons are
   * built the same way everywhere in this project, one Text somewhere in the
   * hierarchy.
   */
  private applyRetryLabel(words: SessionSemantics): void {
    this.setButtonLabel(this.finishRaceAgainButton, words.retryLabel);
    this.setButtonLabel(this.splitsRaceAgainButton, words.retryLabel);
  }

  private setButtonVisible(button: ScriptComponent, visible: boolean): void {
    if (!button) return;

    var obj: SceneObject = null;
    try {
      obj = button.getSceneObject();
    } catch (e) {
      return;
    }
    if (isNull(obj)) return;

    obj.enabled = visible;
  }

  private setButtonLabel(button: ScriptComponent, label: string): void {
    if (!button) return;

    var obj: SceneObject = null;
    try {
      obj = button.getSceneObject();
    } catch (e) {
      return;
    }
    if (isNull(obj)) return;

    var text = this.findText(obj);
    if (text) {
      text.text = label;
    } else {
      print('[RaceStateMachine] WARN: no Text under ' + obj.name +
            '; button label stays as authored');
    }
  }

  /** First Text component on this object or anywhere beneath it */
  private findText(obj: SceneObject): Text {
    if (isNull(obj)) return null;

    var own = obj.getComponent('Text') as Text;
    if (own) return own;

    for (var i = 0; i < obj.getChildrenCount(); i++) {
      var found = this.findText(obj.getChild(i));
      if (found) return found;
    }
    return null;
  }

  /**
   * Workout stations in the loaded session, excluding the START and FINISH
   * markers. Sessions vary in length now, so anything announcing progress has
   * to ask rather than assume eight.
   */
  get workoutStationCount(): number {
    var course = this.cm();
    if (!course || !course.stationCount) return 0;
    return Math.max(0, course.stationCount - 2);
  }

  /** Index of the finish marker in the loaded session */
  get finishStationIndex(): number {
    var course = this.cm();
    if (!course || !course.stationCount) return 0;
    return course.stationCount - 1;
  }

  /**
   * Tell the picker which station held the athlete back, so the next session
   * is built around what develops it rather than around more of it.
   *
   * The verdict names a split; the accessories are keyed by prefabType, so the
   * name is mapped back through the loaded plan.
   */
  private pushLimiterToPicker(): void {
    if (!this.sessionPicker) return;

    var verdict = this._results ? this._results.verdict : null;
    if (!verdict || !verdict.limiter) {
      this.sessionPicker.setLimiter('');
      return;
    }

    var course = this.cm();
    var prefabType = '';

    if (course && course.stationConfigs) {
      for (var i = 0; i < course.stationConfigs.length; i++) {
        if (course.stationConfigs[i].name === verdict.limiter.name) {
          prefabType = course.stationConfigs[i].prefabType;
          break;
        }
      }
    }

    this.sessionPicker.setLimiter(prefabType);
  }

  /** The verdict for the race just finished, or null */
  getRaceVerdict(): any {
    return this._results ? this._results.verdict : null;
  }

  // ── HR Stats Calculation ──────────────────────────────────────────────────

  private calculateSplitAvgHR(): number {
    if (this._splitHRReadings.length === 0) return 0;

    var sum = 0;
    for (var i = 0; i < this._splitHRReadings.length; i++) {
      sum += this._splitHRReadings[i];
    }
    return Math.round(sum / this._splitHRReadings.length);
  }

  // ── UI Updates ─────────────────────────────────────────────────────────────

  private setUIIdle(): void {
    this.setStatusLine('');

    // Whatever placeholder these were authored with in the scene, they belong
    // to a block, and outside a session there is no block.
    if (this.blockLabelText) this.blockLabelText.text = '';
    if (this.blockProgressText) this.blockProgressText.text = '';
    this.hideBlockIntro();

    if (this.hrStatusText) {
      this.hrStatusText.text = this._hrStatusMessage || '';
    }
    if (this.stationInfoText) {
      this.stationInfoText.text = '';
    }
    if (this.stationNameText) {
      this.stationNameText.text = '';
    }
    if (this.nextStationText) {
      this.nextStationText.text = '';
    }
    if (this.progressText) {
      this.progressText.text = '';
    }
    if (this.timerBG) {
      this.timerBG.enabled = false;
    }
    if (this.countdownText) {
      this.countdownText.getSceneObject().enabled = false;
    }
    if (this.progressBar) {
      this.progressBar.getSceneObject().enabled = false;
    }
  }

  private updateRunningUI(): void {
    if (this._blockIntroShowing) return;

    if (this.stationInfoBG && !this.stationInfoBG.enabled) {
      this.stationInfoBG.enabled = true;
    }

    if (this._currentConfig) {
      // A run that leads somewhere names where it leads. A run that IS the
      // session leads to whatever follows it - saying "Next: 15:00 run" to
      // somebody eleven minutes into the fifteen minute run is telling them
      // the thing they are doing is still ahead of them.
      if (this.nextStationText) {
        if (isRunOnlyStation(this._currentConfig)) {
          var after = this.cm();
          var afterIdx = this._currentStationIndex + 1;
          var afterCfg = after && afterIdx < after.stationCount
            ? after.getStationConfig(afterIdx)
            : null;
          this.nextStationText.text = afterCfg && !afterCfg.isFinish
            ? 'Next: ' + afterCfg.name
            : '';
        } else {
          this.nextStationText.text = 'Next: ' + this._currentConfig.name;
        }
      }

      if (this._waitingForStartLineCross) {
        if (this.stationInfoText) {
          this.stationInfoText.getSceneObject().enabled = true;
          this.stationInfoText.text = 'Cross the START line!';
        }
        if (this.progressText) {
          this.progressText.text = '';
        }
        if (this.progressBar) {
          (this.progressBar as any).setProgress(0);
        }
        return;
      }

      // What the athlete is told about how to run this.
      //
      // A pace band when there is one, and nothing about pace at all when
      // there is not - no greyed-out target, no placeholder, no number the
      // app cannot stand behind. In that state the effort cue is not a
      // fallback, it is the prescription.
      if (this.stationInfoText) {
        var guidance = this.runningGuidance();

        this.stationInfoText.getSceneObject().enabled = guidance !== '';
        if (guidance !== '') this.stationInfoText.text = guidance;
      }

      // Progress text shows distance.
      //
      // In preview the target is a shortened stand-in for the real one, and
      // saying so matters: a 216m interval showing as "0m / 6m" otherwise
      // reads as the session having prescribed six metres.
      // A run reports against what it asked for. Metres covered during a
      // fifteen-minute run would be true and useless: the athlete cannot tell
      // from it whether they are a third of the way through.
      var runInfo: string;
      var pct: number;

      // The stretch the athlete is in changes without the run stopping, so
      // the name is read every frame rather than written once on entering.
      if (this.stationNameText) {
        var panelName = this.runningPanelName();
        if (this.stationNameText.text !== panelName) {
          this.stationNameText.text = panelName;
          this.triggerStationNameZoom();
        }
      }

      this.reportPhaseChange();

      if (this._run && this._run.kind === 'TIME') {
        var moving = this._runClock.movingSeconds;
        var secondsLeft = Math.max(0, this._run.seconds - moving);

        // Saying so matters. A clock that has quietly stopped looks exactly
        // like a clock that has broken.
        runInfo = this.formatTime(secondsLeft * 1000) + ' left' +
                  (this._runClock.isStopped ? ' · paused, keep moving' : '');
        pct = Math.min(1, moving / Math.max(1, this._run.seconds));
      } else {
        var targetMetres = runMetresOf(this._run);
        runInfo = this._runDistance.toFixed(0) + 'm / ' + targetMetres.toFixed(0) + 'm';
        pct = Math.min(1, this._runDistance / Math.max(1, targetMetres));
      }

      if (this.progressText) {
        this.progressText.text = runInfo + this.previewNote();
      }

      if (this.progressBar) {
        (this.progressBar as any).setProgress(pct);
      }
    }
  }

  /**
   * " (preview)" when what the athlete is being asked for is a stand-in.
   *
   * The block label above still shows the real prescription, so without this
   * the HUD and the label disagree and the HUD looks like the truth.
   */
  private previewNote(): string {
    var course = this.cm();
    return course && course.isPreviewSimplified === true ? '  (preview)' : '';
  }

  private updateStationUI(): void {
    if (!this._currentConfig) return;
    if (this._blockIntroShowing) return;

    if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
      this.stationInfoText.getSceneObject().enabled = true;
    }
    if (this.stationInfoBG && !this.stationInfoBG.enabled) {
      this.stationInfoBG.enabled = true;
    }

    var mode = this._currentConfig.mode;
    var instruction = this._currentConfig.instruction;
    var progress = this._stationProgress;
    var target = this._stationRequirement;

    // In training, the flat station list is an implementation detail. Counting
    // it out loud ("42 of 73 remaining") is both meaningless and demoralising;
    // the athlete is working through blocks and rounds.
    if (this.isTrainingSession && this._currentConfig) {
      var blocks = this.planBlocks();
      var blockIndex = this._currentConfig.blockIndex || 0;
      var at = workingPositionOf(blocks, blockIndex);
      var block = blocks.length > blockIndex ? blocks[blockIndex] : null;

      if (this.blockProgressText) {
        // Where somebody is, in one line. The block line above is left with
        // the name, which is the one thing neither of these numbers says.
        //
        // And the warm-up is not one of the blocks, so it has no number here
        // either - only whatever rounds it genuinely has, which is none.
        this.blockProgressText.text = blockLines(
          block,
          at.index,
          at.count,
          this._currentConfig.roundIndex || 1,
          this._currentConfig.roundCount || 1,
          true
        ).progress;
      }
    }

    // Update next station text - show what comes after this station
    if (this.nextStationText) {
      var course = this.cm();
      var nextIdx = this._currentStationIndex + 1;
      if (course && nextIdx < course.stationCount) {
        var nextConfig = course.getStationConfig(nextIdx);
        if (nextConfig && nextConfig.runDistanceBefore > 0) {
          this.nextStationText.text = 'Next: RUN';
        } else if (nextConfig) {
          this.nextStationText.text = 'Next: ' + nextConfig.name;
        }
      } else {
        this.nextStationText.text = 'Next: FINISH';
      }
    }

    // Progress info (rep count, distance, time)
    var progressInfo = '';
    switch (mode) {
      case StationMode.TIMED:
        var remaining = Math.max(0, target - progress);
        progressInfo = remaining.toFixed(0) + 's remaining';
        break;

      case StationMode.DISTANCE:
        progressInfo = progress.toFixed(1) + 'm / ' + target + 'm';
        break;

      case StationMode.ZONE_HIT:
        progressInfo = Math.floor(progress) + ' / ' + target;
        break;

      case StationMode.REPS:
      case StationMode.VERTICAL_REPS:
      case StationMode.LATERAL_REPS:
        progressInfo = Math.floor(progress) + ' / ' + target;
        break;
    }

    // Set progress text
    if (this.progressText) {
      this.progressText.text = progressInfo;
    }

    // Set instruction in stationInfoText
    if (this.stationInfoText) {
      this.stationInfoText.text = instruction;
    }

    // Update progress bar
    var pct = Math.min(1, progress / Math.max(1, target));
    if (this.progressBar) {
      (this.progressBar as any).setProgress(pct);
    }
  }

  private updateTimerUI(): void {
    if (!this.timerText) return;
    if (this.timerBG && !this.timerBG.enabled) {
      this.timerBG.enabled = true;
    }
    this.timerText.text = this.formatTime(this.elapsedMs);
  }

  // ── Player Position/Direction ──────────────────────────────────────────────

  private getPlayerPosition(): vec3 {
    if (!this.camTransform) {
      return vec3.zero();
    }

    var camPos = this.camTransform.getWorldPosition();
    var setup = this.setup();
    var floorY = camPos.y;

    if (setup && setup.isCalibrated && typeof setup.floorY !== 'undefined') {
      floorY = setup.floorY;
    }

    return new vec3(camPos.x, floorY, camPos.z);
  }

  private getPlayerForward(): vec3 {
    if (!this.camTransform) {
      return new vec3(0, 0, -1);
    }

    return vec3.up().cross(this.camTransform.right).normalize();
  }

  // ── Run Arrow Guide ────────────────────────────────────────────────────────

  private startRunArrowGuide(): void {
    if (!this.runArrowGuide) return;

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();

    // Calculate target position: run distance ahead in forward direction
    var runDistanceCm = runMetresOf(this._run) * 100;  // Convert meters to cm
    var targetPos = new vec3(
      playerPos.x + playerForward.x * runDistanceCm,
      playerPos.y,
      playerPos.z + playerForward.z * runDistanceCm
    );

    this.runArrowGuide.startGuide(targetPos);
    print('[RaceStateMachine] Arrow guide started, target ' +
          runMetresOf(this._run) + 'm ahead');
  }

  private stopRunArrowGuide(): void {
    if (!this.runArrowGuide) return;

    this.runArrowGuide.stopGuide();
    print('[RaceStateMachine] Arrow guide stopped');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Find target sphere child in station prefab (for OVERHEAD_REACH stations) */
  private findTargetSphere(station: SceneObject): SceneObject {
    // Look for child with Physics Collider or specific name
    for (var i = 0; i < station.getChildrenCount(); i++) {
      var child = station.getChild(i);
      // Check if child has a collider (sphere target)
      var collider = child.getComponent('Physics.ColliderComponent');
      if (collider) {
        print('[RaceStateMachine] Found target sphere: ' + child.name);
        return child;
      }
      // Recursively check children
      var found = this.findTargetSphere(child);
      if (found) return found;
    }
    return null;
  }

  private calculateSplitDuration(): number {
    var elapsed = this.getRaceElapsedMsAt(getTime() * 1000);

    var prevTotal = 0;
    for (var i = 0; i < this._splitDurations.length; i++) {
      prevTotal += this._splitDurations[i];
    }

    return Math.max(0, elapsed - prevTotal);
  }

  private formatTime(ms: number): string {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return this.pad2(min) + ':' + this.pad2(sec);
  }

  private pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }
}
