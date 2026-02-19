import * as THREE from "three"

export class LineDebugIndicator {
  private element: HTMLElement | null = null

  public dispose(): void {
    if (this.element) {
      document.body.removeChild(this.element)
      this.element = null
    }
  }

  public update(
    text: string,
    worldPosition: THREE.Vector3,
    camera: THREE.Camera,
  ): void {
    if (!(window as any).customerDebugEnabled) {
      this.dispose()
      return
    }
    if (!this.element) {
      this.element = document.createElement("div")
      this.element.style.cssText = `
                position: absolute;
                background: rgba(255, 255, 255, 0.9);
                color: black;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                font-weight: bold;
                pointer-events: none;
                z-index: 1000;
                border: 1px solid #333;
            `
      document.body.appendChild(this.element)
    }

    this.element.textContent = text

    const screenPosition = worldPosition.clone()
    screenPosition.project(camera)

    const canvas = document.querySelector("canvas")
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (screenPosition.x * 0.5 + 0.5) * rect.width + rect.left
    const y = (-screenPosition.y * 0.5 + 0.5) * rect.height + rect.top

    this.element.style.left = `${x - 20}px`
    this.element.style.top = `${y - 10}px`
    this.element.style.display = screenPosition.z > 1 ? "none" : "block"
  }
}
