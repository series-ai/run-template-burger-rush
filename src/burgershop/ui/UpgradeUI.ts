/**
 * Reusable HTML/CSS upgrade UI builder for Three.js stations
 * Produces a consistent modal content used by upgrade-like stations
 */
export type UpgradeRowSpec = {
  id: string // unique id for the row, e.g. 'inventory', 'speed'
  label: string
  description: string
  cost?: number // the numeric cost value
  disabled?: boolean // if true, shows a disabled button labeled MAX or DISABLED
  buttonText?: string // override button text; when disabled, defaults to 'MAX LEVEL'
  maxed?: boolean // if true, shows MAX LEVEL instead of cost when disabled
  adDisabled?: boolean // if true, the ad button is disabled (money button state controlled by disabled)
}

export type UpgradeUIOptions = {
  title: string
}

/**
 * Returns HTML string content for the upgrade modal. Also injects shared styles once.
 */
export function buildUpgradeModalContent(
  rows: UpgradeRowSpec[],
  options: UpgradeUIOptions,
): string {
  // Use inline styles for guaranteed fixed scaling

  const rowsHtml = rows
    .map((row) => {
      const isDisabled = !!row.disabled
      const isMaxed = !!row.maxed
      const disabledClass = isDisabled ? "disabled" : ""
      const disabledAttr = isDisabled ? "disabled" : ""

      // Decide content inside the button
      let buttonInnerHtml = ""
      if (isMaxed) {
        buttonInnerHtml = row.buttonText ? row.buttonText : "MAX LEVEL"
      } else if (row.cost !== undefined) {
        // Format cost based on numeric value
        if (row.cost === 0) {
          buttonInnerHtml = "FREE"
        } else {
          buttonInnerHtml = `<span class="money-icon"></span>${row.cost}`
        }
      } else {
        buttonInnerHtml = row.buttonText ? row.buttonText : "BUY"
      }

      // Always show dual buttons (money + ad) unless maxed out
      let buttonsHtml = ""
      
      if (isMaxed) {
        // Single MAX LEVEL button when maxed
        buttonsHtml = `
          <button style="background: #95A5A6; color: white; padding: 8px 12px; border-radius: 15px; cursor: not-allowed; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; min-width: 80px; justify-content: center; box-shadow: 0 3px 0 #7F8C8D; font-family: var(--game-font); text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3); border: none; transform-origin: center;" disabled>
            ${buttonInnerHtml}
          </button>
        `
      } else {
        // Dual button layout: money button + ad button
        const adDisabled = !!row.adDisabled
        buttonsHtml = `
          <div style="display: flex; gap: 4px;">
            <button style="background: ${adDisabled ? '#95A5A6' : '#9B59B6'}; color: white; padding: 8px 12px; border-radius: 15px; cursor: ${adDisabled ? 'not-allowed' : 'pointer'}; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px; min-width: 70px; justify-content: center; box-shadow: ${adDisabled ? '0 3px 0 #7F8C8D' : '0 4px 0 #8E44AD'}; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); font-family: var(--game-font); text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3); border: none; transform-origin: center;"
                   onmouseenter="${adDisabled ? '' : "this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 0 #8E44AD, 0 8px 15px rgba(155, 89, 182, 0.3)';"}"
                   onmouseleave="${adDisabled ? '' : "this.style.transform='scale(1)'; this.style.boxShadow='0 4px 0 #8E44AD';"}"
                   onmousedown="${adDisabled ? '' : "this.style.transform='scale(0.95)'; this.style.boxShadow='0 2px 0 #8E44AD';"}"
                   onmouseup="${adDisabled ? '' : "this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 0 #8E44AD, 0 8px 15px rgba(155, 89, 182, 0.3)';"}"
                   data-upgrade-id="${row.id}" data-upgrade-type="ad" ${adDisabled ? 'disabled' : ''}>
              📺 AD
            </button>
            <button style="background: ${isDisabled ? '#95A5A6' : '#FF6B35'}; color: white; padding: 8px 12px; border-radius: 15px; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px; min-width: 70px; justify-content: center; box-shadow: ${isDisabled ? '0 3px 0 #7F8C8D' : '0 4px 0 #E55A2B'}; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); font-family: var(--game-font); text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3); border: none; transform-origin: center;"
                   onmouseenter="${isDisabled ? '' : "this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 0 #E55A2B, 0 8px 15px rgba(255, 107, 53, 0.3)';"}"
                   onmouseleave="${isDisabled ? '' : "this.style.transform='scale(1)'; this.style.boxShadow='0 4px 0 #E55A2B';"}"
                   onmousedown="${isDisabled ? '' : "this.style.transform='scale(0.95)'; this.style.boxShadow='0 2px 0 #E55A2B';"}"
                   onmouseup="${isDisabled ? '' : "this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 0 #E55A2B, 0 8px 15px rgba(255, 107, 53, 0.3)';"}"
                   data-upgrade-id="${row.id}" data-upgrade-type="money" ${isDisabled ? 'disabled' : ''}>
              ${buttonInnerHtml}
            </button>
          </div>
        `
      }

      return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #C8E6F5; border-radius: 15px; padding: 12px 14px; box-shadow: 0 6px 0 #A8C8E1, 0 8px 15px rgba(0, 0, 0, 0.15); margin-bottom: 10px;">
        <div style="display: flex; flex-direction: column; flex: 1; padding-right: 10px;">
          <div style="font-size: 16px; font-weight: 700; color: #374151; margin-bottom: 4px; font-family: var(--game-font); text-shadow: none;">${row.label}</div>
          <div style="font-size: 14px; color: #6B7280; font-weight: 600; font-family: var(--game-font); line-height: 1.3; text-shadow: none;">${row.description}</div>
        </div>
        ${buttonsHtml}
      </div>
    `
    })
    .join("")

  return `
    <div style="font-family: var(--game-font), sans-serif; font-weight: 600; width: 100%; box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 16px;">
        <h2 style="margin: 0; color: white; font-size: 24px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3); margin-bottom: 8px; font-family: var(--game-font);">${options.title}</h2>
        <button style="background: #FF6B6B; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; font-size: 20px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); font-family: var(--game-font); color: white; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3); box-shadow: 0 5px 0 #C0392B; border: none; position: absolute; top: 15px; right: 15px; transform-origin: center;" 
               onmouseenter="this.style.transform='scale(1.1)'; this.style.boxShadow='0 8px 0 #C0392B, 0 10px 20px rgba(255, 107, 107, 0.4)';"
               onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 5px 0 #C0392B';"
               onmousedown="this.style.transform='scale(0.9)'; this.style.boxShadow='0 2px 0 #C0392B';"
               onmouseup="this.style.transform='scale(1.1)'; this.style.boxShadow='0 8px 0 #C0392B, 0 10px 20px rgba(255, 107, 107, 0.4)';"
               onclick="window.closeUpgradeUI()">✕</button>
      </div>
      <div style="display: flex; flex-direction: column;">
        ${rowsHtml}
      </div>
    </div>
  `
}

// CSS styles are now handled by Tailwind CSS in main.css
