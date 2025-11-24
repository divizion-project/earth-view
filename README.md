# Divizion Earth View

A realistic 3D Earth view using CesiumJS.

## Features
- **Cinematic Intro:** Star Wars-style warp effect.
- **Realistic Rendering:** Day/Night cycle, high-quality atmosphere and lighting.
- **Automatic Sequence:**
  1. Arrival (5s)
  2. Orbit/Rotation (5s)
  3. Zoom to User Location (based on IP)
- **No UI:** Clean, immersive experience.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run locally:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Deployment

This project is configured for GitHub Pages deployment via GitHub Actions.
Simply push to the `main` branch, and the workflow in `.github/workflows/deploy.yml` will automatically build and deploy the site.
