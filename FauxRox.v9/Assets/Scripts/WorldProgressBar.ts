// ============================================================================
// WorldProgressBar.ts — a progress bar with somewhere to be
// ============================================================================
// The screen-space bar was drawn last and still read as being behind
// everything, because an orthographic camera sends both eyes the same image.
// With no disparity the brain puts it at infinity, and no amount of render
// order argues with that: occlusion says in front, vergence says far away,
// and vergence wins. It also tires the eyes.
//
// So this one is geometry, standing where the rest of the panel stands, and
// it is seen the way the panel is seen.
//
// Same one method the screen-space controller had - setProgress(0..1) - so
// nothing that drives it needs to know which of the two it is talking to.
// ============================================================================

@component
export class WorldProgressBar extends BaseScriptComponent {

  /**
   * The part that fills. A UIKit RoundedRectangle, or anything with a `size`.
   *
   * Its authored width is the full width: the bar is built at the size it
   * will be when complete, so what is laid out in the editor is what a
   * finished station looks like rather than an empty one.
   */
  @input @allowUndefined fill: ScriptComponent;

  /**
   * Fill from the left, or from the middle outwards.
   *
   * A rectangle grows around its own centre, so a bar at a third would sit in
   * the middle of the track with nothing at either end. Left-anchored is what
   * a progress bar means; the option exists because a centred one is a real
   * design and not a bug.
   */
  @input fillFromLeft: boolean = true;

  /**
   * Something that rides the leading edge, if there is one.
   *
   * A moving mark is read at a glance in a way a growing rectangle is not -
   * the eye catches movement and does not catch an edge being slightly
   * further along than it was. Optional: a bar is a bar without it.
   */
  @input @allowUndefined pointer: SceneObject;

  /** Below this the fill is hidden rather than drawn as a sliver */
  @input minimumVisible: number = 0.005;

  private _fullWidth: number = 0;
  private _height: number = 0;
  private _centreX: number = 0;

  private _progress: number = 0;
  private _ready: boolean = false;

  onAwake(): void {
    // After the rectangle has initialised itself, or its size is whatever the
    // input defaulted to rather than what the scene says.
    this.createEvent('OnStartEvent').bind(() => this.measure());
  }

  /**
   * Read the authored size, once.
   *
   * Once, because everything after this writes to it. Measuring live would
   * make the full width whatever the bar happened to be showing, and it would
   * shrink a little at every station until there was nothing left of it.
   */
  private measure(): void {
    var bar = this.fill as any;
    if (!bar || !bar.size) {
      print('[WorldProgressBar] No fill with a size — nothing to draw');
      return;
    }

    this._fullWidth = bar.size.x;
    this._height = bar.size.y;

    var object = this.fill.getSceneObject();
    if (object) this._centreX = object.getTransform().getLocalPosition().x;

    // The pointer keeps whatever height it was placed at; only its position
    // along the bar is anybody else's business.
    if (this.pointer) {
      this._pointerRest = this.pointer.getTransform().getLocalPosition();
    }

    this._ready = true;
    this.render();
  }

  /**
   * Fill to this fraction of the way.
   *
   * Clamped rather than trusted. A station that overruns its requirement
   * reports more than one, and a bar past its own end has stopped saying
   * anything.
   */
  setProgress(pct: number): void {
    this._progress = pct > 1 ? 1 : (pct > 0 ? pct : 0);
    this.render();
  }

  /** What it is showing, for anything that wants to read it back */
  get progress(): number {
    return this._progress;
  }

  /** Where the pointer was placed, which is where it sits at zero */
  private _pointerRest: vec3 = null;

  private render(): void {
    if (!this._ready) return;

    var bar = this.fill as any;
    var object = this.fill.getSceneObject();
    if (!object) return;

    var width = this._fullWidth * this._progress;
    this.movePointer(width);

    if (this._progress < this.minimumVisible) {
      object.enabled = false;
      return;
    }

    if (!object.enabled) object.enabled = true;

    bar.size = new vec2(width, this._height);

    // Left edge pinned, right edge doing the moving.
    var offset = this.fillFromLeft ? (this._fullWidth - width) / 2 : 0;
    var position = object.getTransform().getLocalPosition();
    object.getTransform().setLocalPosition(
      new vec3(this._centreX - offset, position.y, position.z));
  }

  /**
   * Put the pointer where the fill ends.
   *
   * At the start of the bar rather than the middle when there is nothing to
   * show: it is marking how far along the athlete is, and at nothing done it
   * belongs at nothing done. It keeps its own height and depth, so it can sit
   * above or below the bar as the scene places it.
   */
  private movePointer(width: number): void {
    if (!this.pointer || !this._pointerRest) return;

    var left = this._centreX - this._fullWidth / 2;
    var x = this.fillFromLeft ? left + width : this._centreX;

    this.pointer.getTransform().setLocalPosition(
      new vec3(x, this._pointerRest.y, this._pointerRest.z));
  }
}
