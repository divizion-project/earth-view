import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

// --- Configuration ---
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhYjNmNjVkMC04YTBhLTRmNWMtODdjMS05NGUxZDI4OGQzM2EiLCJpZCI6MzYzNDE1LCJpYXQiOjE3NjQwMTI3MjN9.u78rjI-bmc4uWEGANSorM9NheilGCPsthv68efxV1MY';
Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

// --- Warp Effect (Canvas) ---
const warpCanvas = document.getElementById('warpCanvas') as HTMLCanvasElement;
const warpOverlay = document.getElementById('warp-overlay') as HTMLDivElement;
const ctx = warpCanvas.getContext('2d')!;

let width = window.innerWidth;
let height = window.innerHeight;
warpCanvas.width = width;
warpCanvas.height = height;

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
}

const stars: Star[] = [];
const numStars = 800;
const speed = 20;

for (let i = 0; i < numStars; i++) {
  stars.push({
    x: (Math.random() - 0.5) * width * 2,
    y: (Math.random() - 0.5) * height * 2,
    z: Math.random() * width,
    pz: 0
  });
  stars[i].pz = stars[i].z;
}

let warpId: number;

function drawWarp() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;

  for (let i = 0; i < numStars; i++) {
    const star = stars[i];
    star.z -= speed;
    if (star.z <= 0) {
      star.z = width;
      star.x = (Math.random() - 0.5) * width * 2;
      star.y = (Math.random() - 0.5) * height * 2;
      star.pz = star.z;
    }

    const x = (star.x / star.z) * 100 + cx;
    const y = (star.y / star.z) * 100 + cy;

    // Previous position for trail
    const px = (star.x / star.pz) * 100 + cx;
    const py = (star.y / star.pz) * 100 + cy;

    star.pz = star.z;

    // Draw streak
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const alpha = Math.min(1, (dist / (width / 2)) + 0.1);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = (1 - star.z / width) * 3;
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  warpId = requestAnimationFrame(drawWarp);
}

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  warpCanvas.width = width;
  warpCanvas.height = height;
});

// Start Warp
drawWarp();


// --- Cesium Setup ---
const viewer = new Cesium.Viewer('cesiumContainer', {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  vrButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  navigationInstructionsInitiallyVisible: false,
  skyAtmosphere: new Cesium.SkyAtmosphere(),
  globe: new Cesium.Globe(Cesium.Ellipsoid.WGS84),
});

// Remove credit
(viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

// Enable lighting and smoother atmosphere
viewer.scene.globe.enableLighting = true;
viewer.scene.globe.atmosphereBrightnessShift = 0.0; // Reset to natural
if (viewer.scene.skyAtmosphere) {
  viewer.scene.skyAtmosphere.saturationShift = 0.0;
  viewer.scene.skyAtmosphere.brightnessShift = 0.0;
}
viewer.scene.fog.enabled = true;
viewer.scene.fog.density = 0.0001; // Lighter fog
viewer.scene.globe.showGroundAtmosphere = true;

// Add 3D Buildings (Google Photorealistic 3D Tiles)
let googleTileset: Cesium.Cesium3DTileset | null = null;
try {
  Cesium.createGooglePhotorealistic3DTileset({
    onlyUsingWithGoogleGeocoder: true // Suppress warning as we're not using geocoding
  }).then(tileset => {
    googleTileset = tileset;
    viewer.scene.primitives.add(tileset);
    tileset.show = false; // Hide initially to see Globe's night lights from space
  });
} catch (e) {
  console.warn("Google Photorealistic 3D Tiles not supported or failed, falling back to OSM", e);
  Cesium.createOsmBuildingsAsync().then(buildings => {
    viewer.scene.primitives.add(buildings);
  });
}

// Ensure time is set to now for correct day/night lighting
viewer.clock.currentTime = Cesium.JulianDate.now();

// High quality settings
viewer.scene.highDynamicRange = true;
viewer.scene.postProcessStages.fxaa.enabled = true;

// --- Visual Enhancements ---

// 1. Darken Base Layer for better contrast and night feel
const baseLayer = viewer.imageryLayers.get(0);
if (baseLayer) {
  baseLayer.brightness = 0.6; // Darker ground
}

// Cloud system removed

// Initial Camera Position (Very far)
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(0, 0, 1000000000), // 1,000,000 km start
});


// --- Sequence Logic ---

async function startSequence() {
  // 1. Arrival (0s - 5s)
  // Fly from far to orbit
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000), // 20,000 km
    duration: 5,
    easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
    complete: () => {
      // 2. Start Rotation immediately after arrival
      startRotation();
    }
  });

  // Fade out warp at 4s
  setTimeout(() => {
    warpOverlay.style.opacity = '0';
  }, 3000);

  setTimeout(() => {
    cancelAnimationFrame(warpId);
    warpOverlay.style.display = 'none';
  }, 5000);
}

let rotationListener: (() => void) | null = null;

function startRotation() {
  const baseRotationRate = 0.0005; // Base rotation speed
  let currentRotationRate = baseRotationRate;
  let userLocation: Location | null = null;

  // Fetch user location
  fetchUserLocation().then(location => {
    userLocation = location || { lat: 48.8566, lon: 2.3522 }; // Paris fallback

    // Wait 5 seconds, then start the scan phase
    setTimeout(() => {
      startScanPhase(userLocation!);
    }, 5000);
  });

  const onTick = () => {
    viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, currentRotationRate);
  };

  viewer.clock.onTick.addEventListener(onTick);
  rotationListener = () => viewer.clock.onTick.removeEventListener(onTick);

  // Function to update rotation speed smoothly
  (window as any).updateRotationRate = (newRate: number) => {
    currentRotationRate = newRate;
  };
}

function startScanPhase(location: Location) {
  // Acceleration phase: speed up rotation and sun
  const accelerationDuration = 1500; // 1.5 seconds to accelerate (faster)
  const scanDuration = 4000; // 4 seconds of fast scanning (longer for effect)
  const startTime = Date.now();
  const baseRotationRate = 0.0005;
  const maxRotationRate = 0.015; // Much faster camera rotation during scan

  // Save original clock multiplier
  const originalClockMultiplier = viewer.clock.multiplier;

  // Acceleration interval
  const accelerationInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / accelerationDuration, 1);

    // Smoother acceleration using quintic easing for more natural feel
    const easedProgress = progress < 0.5
      ? 16 * progress * progress * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 5) / 2;

    const newRotationRate = baseRotationRate + (maxRotationRate - baseRotationRate) * easedProgress;

    // Update rotation rate
    if ((window as any).updateRotationRate) {
      (window as any).updateRotationRate(newRotationRate);
    }

    // Accelerate sun (time) for scanning effect
    // Speed up time to make sun spin MUCH faster than camera (at least 50x faster)
    // Camera max is ~0.015, so sun should be spinning VERY fast
    const maxTimeMultiplier = 150000; // 150000x faster time = sun spinning 50x faster than camera rotation
    viewer.clock.multiplier = originalClockMultiplier + maxTimeMultiplier * easedProgress;

    if (progress >= 1) {
      clearInterval(accelerationInterval);

      // Maintain fast speed for scan duration
      setTimeout(() => {
        startZoomAndSlowdown(location, maxRotationRate);
      }, scanDuration);
    }
  }, 16); // ~60fps
}

function startZoomAndSlowdown(location: Location, currentRotationRate: number) {
  const slowdownDuration = 5000; // 5 seconds for smoother slowdown
  const startTime = Date.now();

  // Get current camera orientation to continue from current position
  const currentHeading = viewer.camera.heading;

  // Start zoom animation - this will make a full orbit to maintain continuity
  zoomToLocation(location, currentHeading);

  // Smooth slowdown interval
  const slowdownInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / slowdownDuration, 1);

    // Smoother deceleration using quintic easing for very natural slowdown
    const easedProgress = progress < 0.5
      ? 16 * progress * progress * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 5) / 2;

    const newRotationRate = currentRotationRate * (1 - easedProgress);

    // Update rotation rate
    if ((window as any).updateRotationRate) {
      (window as any).updateRotationRate(newRotationRate);
    }

    // Slow down time back to normal with smoother transition, positioning sun correctly
    // Use a different easing for time to make sun movement feel more natural
    const timeEasedProgress = 1 - Math.pow(1 - progress, 4); // Quartic easing for time
    const currentMultiplier = viewer.clock.multiplier;
    const targetMultiplier = 1; // Real-time
    viewer.clock.multiplier = currentMultiplier - (currentMultiplier - targetMultiplier) * timeEasedProgress;

    // At the end, set to real-time
    if (progress >= 1) {
      clearInterval(slowdownInterval);
      viewer.clock.multiplier = 1; // Real-time

      // Stop rotation completely
      if (rotationListener) {
        rotationListener();
        rotationListener = null;
      }

      // Reset time to now for correct sun position
      viewer.clock.currentTime = Cesium.JulianDate.now();
    }
  }, 16); // ~60fps
}

interface Location {
  lat: number;
  lon: number;
}

async function fetchUserLocation(): Promise<Location | null> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lon: data.longitude };
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch location", e);
    return null;
  }
}

function zoomToLocation(loc: Location, heading?: number) {
  // Don't stop rotation here - it will be stopped by the slowdown function
  // The rotation will smoothly decrease to zero during the zoom

  // Monitor camera height to show 3D tiles only when close enough (1,000,000m)
  // This preserves the "Black Marble" night lights from space
  const tileActivationHeight = 100000;
  const checkHeight = () => {
    // Ensure we are using the latest height
    const height = viewer.camera.positionCartographic.height;
    if (height < tileActivationHeight) {
      if (googleTileset) {
        googleTileset.show = true;
      }
      viewer.clock.onTick.removeEventListener(checkHeight);
    }
  };
  viewer.clock.onTick.addEventListener(checkHeight);

  // Simplified location marker - single pulse point fixed to ground
  const locationEntity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 0),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString('#007AFF'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // Fixed to ground inclination
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    // Add a subtle pulsing animation
    ellipse: {
      semiMinorAxis: 50,
      semiMajorAxis: 50,
      material: Cesium.Color.fromCssColorString('#007AFF').withAlpha(0.2),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // Also fixed to ground
      outline: false
    }
  });

  // Use provided heading or default to 0, maintain smooth transition
  const finalHeading = heading !== undefined ? heading : 0.0;

  // Fly to Entity with HeadingPitchRange - using current heading for smooth transition
  viewer.flyTo(locationEntity, {
    duration: 5,
    offset: new Cesium.HeadingPitchRange(
      finalHeading, // Use current heading for continuous rotation
      Cesium.Math.toRadians(-30.0),
      10000000 // 50000km range (kept user's edit)
    )
  });
}

// Start
startSequence();
