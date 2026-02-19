# Title Screen

The title screen displays on game startup, showing "Burger Shop Rush" and a "Click to continue" prompt before transitioning to gameplay.

## Features

- Shows the exterior building from a custom camera angle
- Displays game title at top-left in large stylized text
- Shows flashing "Click to continue" prompt at bottom center
- Smooth camera transition to gameplay view on click
- Enables player movement after transition completes

## Prefab Setup

The title screen requires a prefab to define the camera position. Create a prefab at `/title_camera_position` with the following structure:

### Required Prefab: `/title_camera_position`

Create a prefab (or add to an existing prefabs JSON file) with:

```json
{
  "id": "title_camera_position",
  "position": { "x": -30, "y": 25, "z": -50 },
  "rotation": { "x": 0, "y": 45, "z": 0 }
}
```

### Position Guidelines

- **Position**: Where the camera will be placed in world space
  - X: Left/right offset from origin
  - Y: Height (recommend 15-30 for a good overview)
  - Z: Forward/back position (negative values are typically "outside" the shop)

- **Rotation**: The camera's orientation (Euler angles in degrees)
  - The camera will look in the direction defined by this rotation
  - Y rotation controls horizontal angle (0 = forward, 90 = right, etc.)
  - X rotation controls vertical tilt

### Example Positions

**Front-facing view (looking at shop entrance):**
```json
{
  "position": { "x": 0, "y": 20, "z": -45 },
  "rotation": { "x": -10, "y": 0, "z": 0 }
}
```

**Angled dramatic view:**
```json
{
  "position": { "x": -25, "y": 25, "z": -40 },
  "rotation": { "x": -15, "y": 30, "z": 0 }
}
```

**Side view:**
```json
{
  "position": { "x": -40, "y": 20, "z": -20 },
  "rotation": { "x": -10, "y": 60, "z": 0 }
}
```

## Fallback Behavior

If the `/title_camera_position` prefab is not found:
- The title screen is skipped
- Player movement is enabled immediately
- A warning is logged to the console

## Customization

### Camera Transition Duration

Edit `TitleScreen.CAMERA_TRANSITION_DURATION` (default: 2.5 seconds) to change how long the camera takes to move from the title view to gameplay view.

### UI Styling

The title and prompt text use inline CSS styles in `TitleScreen.ts`. Key styling:
- Font: Palanquin Dark (with sans-serif fallback)
- Title: 72px, positioned top-left
- Prompt: 28px, centered at bottom with slow pulse animation
