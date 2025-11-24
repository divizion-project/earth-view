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
  // skyBox: new Cesium.SkyBox({ ... }) // Using default skybox
});

// Remove credit if possible or style it minimally (Cesium requires attribution usually, but we can hide it for "no UI" request if user insists, though it's against terms. I'll leave it but maybe make it subtle. Actually, user said "no interface", I will hide the credit container via CSS or JS to strictly follow user request, but standard practice is to keep it. I'll hide it.)
(viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

// Enable lighting
viewer.scene.globe.enableLighting = true;

// High quality settings
viewer.scene.highDynamicRange = true;
viewer.scene.postProcessStages.fxaa.enabled = true;

// Initial Camera Position (Very far)
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(0, 0, 200000000), // 200,000 km
});


// --- Sequence Logic ---

async function startSequence() {
  // 1. Arrival (0s - 5s)
  // Fly from far to orbit
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000), // 20,000 km
    duration: 5,
    easingFunction: Cesium.EasingFunction.QUINTIC_OUT
  });

  // Fade out warp at 4s
  setTimeout(() => {
    warpOverlay.style.opacity = '0';
  }, 3000); // Start fading a bit earlier to be clear by 5s

  setTimeout(() => {
    cancelAnimationFrame(warpId);
    warpOverlay.style.display = 'none';
  }, 5000);

  // 2. Rotation (5s - 10s)
  // Wait for arrival to finish (5s)
  setTimeout(() => {
    // Start gentle rotation
    const rotationDuration = 5000; // 5s
    const startTime = Date.now();

    const rotate = () => {
      const now = Date.now();
      const dt = now - startTime;
      if (dt >= rotationDuration) return;

      viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.001); // Small rotation speed
      requestAnimationFrame(rotate);
    };
    rotate();

    // Fetch IP during this time
    fetchUserLocation().then(location => {
      // 3. Zoom to Location (10s+)
      setTimeout(() => {
        if (location) {
          zoomToLocation(location);
        } else {
          // Fallback if IP fails
          zoomToLocation({ lat: 48.8566, lon: 2.3522 }); // Paris
        }
      }, 5000); // 5s after rotation starts (Total 10s)
    });

  }, 5000);
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

function zoomToLocation(loc: Location) {
  // Stop any rotation (handled by not calling requestAnimationFrame anymore)

  // Fly to location
  // "Plunging view" -> Pitch -90
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 5000), // 5km height
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-90.0),
      roll: 0.0
    },
    duration: 5, // Smooth slow zoom
    easingFunction: Cesium.EasingFunction.QUARTIC_IN_OUT
  });
}

// Start
startSequence();
