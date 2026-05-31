@component
export class ProgressBarController extends BaseScriptComponent {
  @input private pointer: SceneObject
  @input private textComponent: Text

  @input private Mats: Material[]
  @input private BarMat: Material

  /** Bar Image - material'ı doğrudan bundan alacağız */
  @input private barImage: Image

  @input private initialProgress: number = 0
  @input private globalOpacity: number = 1

  @input private startPosScreenTransform: ScreenTransform
  @input private endPosScreenTransform: ScreenTransform

  private pointerScreenTransform: ScreenTransform
  private startPos: vec2
  private endPos: vec2
  private barMaterial: Material

  onAwake() {
    this.pointerScreenTransform = this.pointer.getComponent("Component.ScreenTransform")
    if (!this.pointerScreenTransform) {
      throw new Error("Pointer is required to have screen transform")
    }
    this.startPos = this.startPosScreenTransform.anchors.getCenter()
    this.endPos = this.endPosScreenTransform.anchors.getCenter()

    // Get material directly from Image component
    if (this.barImage) {
      this.barMaterial = this.barImage.mainMaterial
      print('[ProgressBar] Got material from barImage')
    } else if (this.BarMat) {
      this.barMaterial = this.BarMat
      print('[ProgressBar] Using BarMat input')
    }

    this.setProgress(this.initialProgress)
  }

  setProgress(newProgress: number) {
    const newPointerPosition = MathUtils.remap(newProgress, 0, 1, this.startPos.x, this.endPos.x)
    this.pointerScreenTransform.anchors.setCenter(new vec2(newPointerPosition, this.startPos.y))

    if (this.BarMat && this.BarMat.mainPass) {
      this.BarMat.mainPass.currentPosition = newProgress
    }

    const item = this.textComponent
    item.text = Math.floor(newProgress * 100) + "%"
  }
}
