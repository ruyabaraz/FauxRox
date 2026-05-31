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

  onAwake() {
    this.pointerScreenTransform = this.pointer.getComponent("Component.ScreenTransform")
    if (!this.pointerScreenTransform) {
      throw new Error("Pointer is required to have screen transform")
    }
    this.startPos = this.startPosScreenTransform.anchors.getCenter()
    this.endPos = this.endPosScreenTransform.anchors.getCenter()

    // Get ScreenTransform from bar image
    if (this.barImage) {
      this.barScreenTransform = this.barImage.getComponent("Component.ScreenTransform")
      if (this.barScreenTransform) {
        print('[ProgressBar] Got ScreenTransform from barImage')
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

    // Update bar fill using anchors.right (NOT shader!)
    // anchors.right = -1 → 0% (empty)
    // anchors.right = 1 → 100% (full)
    // Formula: anchors.right = (progress * 2) - 1
    if (this.barScreenTransform) {
      const newRight = (newProgress * 2) - 1
      this.barScreenTransform.anchors.right = newRight
    }

    // Update text
    if (this.textComponent) {
      this.textComponent.text = Math.floor(newProgress * 100) + "%"
    }
  }
}
