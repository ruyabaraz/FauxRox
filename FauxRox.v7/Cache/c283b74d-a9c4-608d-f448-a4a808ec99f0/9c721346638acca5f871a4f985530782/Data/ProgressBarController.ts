@component
export class ProgressBarController extends BaseScriptComponent {
  @input private pointer: SceneObject
  @input private textComponent: Text

  @input private Mats: Material[]
  @input private BarMat: Material

  /** Bar Image - ScreenTransform üzerinden anchors.right değiştireceğiz */
  @input private barImage: SceneObject

  @input private initialProgress: number = 0
  @input private globalOpacity: number = 1

  @input private startPosScreenTransform: ScreenTransform
  @input private endPosScreenTransform: ScreenTransform

  private pointerScreenTransform: ScreenTransform
  private barScreenTransform: ScreenTransform
  private startPos: vec2
  private endPos: vec2
  private barLeftAnchor: number
  private barRightAnchor: number
  private startLeftEdge: number
  private endRightEdge: number

  onAwake() {
    this.pointerScreenTransform = this.pointer.getComponent("Component.ScreenTransform")
    if (!this.pointerScreenTransform) {
      throw new Error("Pointer is required to have screen transform")
    }
    this.startPos = this.startPosScreenTransform.anchors.getCenter()
    this.endPos = this.endPosScreenTransform.anchors.getCenter()
    this.startLeftEdge = this.startPosScreenTransform.anchors.left
    this.endRightEdge = this.endPosScreenTransform.anchors.right

    // Get ScreenTransform from bar image and save original bounds
    if (this.barImage) {
      this.barScreenTransform = this.barImage.getComponent("Component.ScreenTransform")
      if (this.barScreenTransform) {
        this.barLeftAnchor = this.barScreenTransform.anchors.left
        this.barRightAnchor = this.barScreenTransform.anchors.right
        print('[ProgressBar] Bar bounds: left=' + this.barLeftAnchor.toFixed(3) + ' right=' + this.barRightAnchor.toFixed(3))
      } else {
        print('[ProgressBar] ERROR: barImage has no ScreenTransform!')
      }
    }

    this.setProgress(this.initialProgress)
  }

  setProgress(newProgress: number) {
    // Clamp progress 0-1
    newProgress = Math.max(0, Math.min(1, newProgress))

    // Update pointer position
    const newPointerPosition = MathUtils.remap(newProgress, 0, 1, this.startPos.x, this.endPos.x)
    this.pointerScreenTransform.anchors.setCenter(new vec2(newPointerPosition, this.startPos.y))

    // Update bar fill - use actual left/right edges of start/end points
    if (this.barScreenTransform) {
      this.barScreenTransform.offsets.left = 0
      this.barScreenTransform.offsets.right = 0
      this.barScreenTransform.anchors.left = this.startLeftEdge
      this.barScreenTransform.anchors.right = MathUtils.lerp(this.startLeftEdge, this.endRightEdge, newProgress)
    }

    // Update text
    if (this.textComponent) {
      this.textComponent.text = Math.floor(newProgress * 100) + "%"
    }
  }
}
