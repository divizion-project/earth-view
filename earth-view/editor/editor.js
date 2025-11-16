import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { buildCameraDescriptor, parseCameraDescriptor } from '../../scripts/camera.js';
import { createStarfieldTexture } from '../../scripts/starfield.js';

const TEXTURES = {
  earthDay: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  earthSpecular: 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg',
  earthNormal: 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
  earthNight: 'https://threejs.org/examples/textures/planets/earth_lights_2048.png',
  clouds: 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'
};

const viewport = document.getElementById('viewport');
const descriptorOutput = document.getElementById('descriptorOutput');
const copyBtn = document.getElementById('copyDescriptor');
const rollInput = document.getElementById('rollInput');
const rollValue = document.getElementById('rollValue');
const fovInput = document.getElementById('fovInput');
const fovValue = document.getElementById('fovValue');
const coordX = document.getElementById('coordX');
const coordY = document.getElementById('coordY');
const coordZ = document.getElementById('coordZ');
const descriptorInput = document.getElementById('descriptorInput');
const loadDescriptorBtn = document.getElementById('loadDescriptor');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(0, 1.5, 4.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.6;
controls.maxDistance = 10;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI - 0.2;
controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 2.2);
light.position.set(-5, 3, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0x0f152a, 0.9));

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const loader = new THREE.TextureLoader();
const textures = {};

const state = {
  rollDeg: 0,
  fov: camera.fov,
  descriptor: ''
};

function resizeRenderer() {
  const width = viewport.clientWidth || window.innerWidth;
  const height = viewport.clientHeight || window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeRenderer);
resizeRenderer();

async function loadTextures() {
  const entries = Object.entries(TEXTURES);
  await Promise.all(
    entries.map(([key, url]) => {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          texture => {
            texture.colorSpace = THREE.SRGBColorSpace;
            textures[key] = texture;
            resolve();
          },
          undefined,
          reject
        );
      });
    })
  );
}

function buildEarth() {
  const geometry = new THREE.SphereGeometry(1, 128, 128);
  const material = new THREE.MeshPhongMaterial({
    map: textures.earthDay,
    specularMap: textures.earthSpecular,
    shininess: 20,
    emissiveMap: textures.earthNight,
    emissive: new THREE.Color(0x555577),
    emissiveIntensity: 0.8,
    normalMap: textures.earthNormal,
    normalScale: new THREE.Vector2(0.5, 0.5)
  });
  const earth = new THREE.Mesh(geometry, material);
  earth.name = 'earth';
  globeGroup.add(earth);

  const cloudsGeo = new THREE.SphereGeometry(1.01, 96, 96);
  const cloudsMat = new THREE.MeshLambertMaterial({
    map: textures.clouds,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const clouds = new THREE.Mesh(cloudsGeo, cloudsMat);
  clouds.name = 'clouds';
  globeGroup.add(clouds);

  const starGeo = new THREE.SphereGeometry(120, 64, 64);
  const starMat = new THREE.MeshBasicMaterial({
    map: textures.starfield,
    side: THREE.BackSide,
    opacity: 0.9
  });
  const stars = new THREE.Mesh(starGeo, starMat);
  scene.add(stars);
}

const baseQuaternion = new THREE.Quaternion();
const rollAxis = new THREE.Vector3();
const forward = new THREE.Vector3(0, 0, -1);

function applyRoll() {
  baseQuaternion.copy(camera.quaternion);
  if (!state.rollDeg) {
    return;
  }
  rollAxis.copy(forward).applyQuaternion(baseQuaternion).normalize();
  camera.quaternion.copy(baseQuaternion);
  camera.rotateOnWorldAxis(rollAxis, THREE.MathUtils.degToRad(state.rollDeg));
}

function render() {
  requestAnimationFrame(render);
  controls.update();
  applyRoll();
  const earth = globeGroup.getObjectByName('earth');
  const clouds = globeGroup.getObjectByName('clouds');
  if (earth) {
    earth.rotation.y += 0.0005;
  }
  if (clouds) {
    clouds.rotation.y += 0.0006;
  }
  renderer.render(scene, camera);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toFixed(3).replace(/\.?0+$/, '');
}

function buildPreview(descriptor) {
  const base = document.documentElement.dataset.siteBase?.trim();
  const root = base ? `/${base}` : '';
  if (!descriptor) {
    return root || '/';
  }
  return `${root}/${descriptor}`;
}

function updateDescriptor() {
  coordX.textContent = formatNumber(camera.position.x);
  coordY.textContent = formatNumber(camera.position.y);
  coordZ.textContent = formatNumber(camera.position.z);

  const descriptor = buildCameraDescriptor({
    position: camera.position,
    rollDeg: state.rollDeg,
    fov: state.fov
  });
  state.descriptor = descriptor;
  descriptorOutput.value = buildPreview(descriptor);
  descriptorOutput.dataset.descriptor = descriptor;
}

controls.addEventListener('change', () => {
  updateDescriptor();
});

rollInput.addEventListener('input', event => {
  state.rollDeg = Number(event.target.value) || 0;
  rollValue.textContent = `${Math.round(state.rollDeg)}°`;
  updateDescriptor();
});

fovInput.addEventListener('input', event => {
  state.fov = Number(event.target.value) || 45;
  camera.fov = state.fov;
  camera.updateProjectionMatrix();
  fovValue.textContent = `${Math.round(state.fov)}°`;
  updateDescriptor();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(descriptorOutput.value);
    copyBtn.textContent = 'Copié !';
    setTimeout(() => (copyBtn.textContent = 'Copier'), 1500);
  } catch (error) {
    copyBtn.textContent = 'Erreur';
    setTimeout(() => (copyBtn.textContent = 'Copier'), 1500);
  }
});

loadDescriptorBtn.addEventListener('click', () => {
  const parsed = parseCameraDescriptor(descriptorInput.value.trim());
  if (!parsed) {
    descriptorInput.classList.add('error');
    descriptorInput.placeholder = 'Code invalide';
    return;
  }
  descriptorInput.classList.remove('error');
  descriptorInput.placeholder = 'x0y0z4def0-zoom45';
  camera.position.set(parsed.position.x, parsed.position.y, parsed.position.z);
  state.rollDeg = parsed.rollDeg;
  rollInput.value = String(parsed.rollDeg);
  rollValue.textContent = `${Math.round(parsed.rollDeg)}°`;
  state.fov = parsed.fov;
  fovInput.value = String(parsed.fov);
  fovValue.textContent = `${Math.round(parsed.fov)}°`;
  camera.fov = parsed.fov;
  camera.updateProjectionMatrix();
  controls.update();
  controls.saveState();
  updateDescriptor();
});

descriptorInput.addEventListener('input', () => {
  descriptorInput.classList.remove('error');
});

descriptorInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadDescriptorBtn.click();
  }
});

function loadDescriptorFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash?.replace('#', '');
  const value = params.get('camera') || params.get('code') || hash;
  if (!value) {
    return;
  }
  const parsed = parseCameraDescriptor(value);
  if (parsed) {
    camera.position.set(parsed.position.x, parsed.position.y, parsed.position.z);
    state.rollDeg = parsed.rollDeg;
    rollInput.value = String(parsed.rollDeg);
    rollValue.textContent = `${Math.round(parsed.rollDeg)}°`;
    state.fov = parsed.fov;
    camera.fov = parsed.fov;
    camera.updateProjectionMatrix();
    fovInput.value = String(parsed.fov);
    fovValue.textContent = `${Math.round(parsed.fov)}°`;
  }
}

async function init() {
  await loadTextures();
  textures.starfield = createStarfieldTexture(THREE);
  buildEarth();
  loadDescriptorFromQuery();
  updateDescriptor();
  render();
}

init().catch(error => {
  console.error('Editor init error', error);
});
