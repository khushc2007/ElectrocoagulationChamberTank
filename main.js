import * as THREE from 'three';

// ─── OrbitControls (inline, no import needed from CDN) ───────────────────────
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    this.enableDamping = true;
    this.dampingFactor = 0.08;
    this.rotateSpeed = 0.6;
    this.panSpeed = 0.8;
    this.zoomSpeed = 1.0;
    this.minDistance = 2;
    this.maxDistance = 30;
    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical();
    this._panOffset = new THREE.Vector3();
    this._scale = 1;
    this._state = 0; // 0=none,1=rotate,2=pan
    this._mouseStart = new THREE.Vector2();
    this._mousePrev = new THREE.Vector2();
    this._init();
    this._updateSpherical();
  }
  _updateSpherical() {
    const offset = this.camera.position.clone().sub(this.target);
    this._spherical.setFromVector3(offset);
  }
  _init() {
    const el = this.domElement;
    el.addEventListener('mousedown', e => {
      if (e.button === 0) this._state = 1;
      else if (e.button === 2) this._state = 2;
      this._mousePrev.set(e.clientX, e.clientY);
    });
    el.addEventListener('mousemove', e => {
      if (this._state === 0) return;
      const dx = e.clientX - this._mousePrev.x;
      const dy = e.clientY - this._mousePrev.y;
      if (this._state === 1) {
        this._sphericalDelta.theta -= (2 * Math.PI * dx / el.clientWidth) * this.rotateSpeed;
        this._sphericalDelta.phi -= (2 * Math.PI * dy / el.clientHeight) * this.rotateSpeed;
      } else if (this._state === 2) {
        const dist = this.camera.position.distanceTo(this.target);
        const factor = dist * 2 * Math.tan(this.camera.fov * Math.PI / 360) / el.clientHeight;
        const right = new THREE.Vector3().crossVectors(
          this.camera.getWorldDirection(new THREE.Vector3()),
          this.camera.up
        ).normalize().multiplyScalar(-dx * factor * this.panSpeed);
        const up = this.camera.up.clone().normalize().multiplyScalar(dy * factor * this.panSpeed);
        this._panOffset.add(right).add(up);
      }
      this._mousePrev.set(e.clientX, e.clientY);
    });
    el.addEventListener('mouseup', () => { this._state = 0; });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this._scale *= e.deltaY > 0 ? (1 + 0.1 * this.zoomSpeed) : (1 - 0.1 * this.zoomSpeed);
    }, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    // Touch
    let touches = [];
    el.addEventListener('touchstart', e => {
      touches = Array.from(e.touches);
      if (touches.length === 1) { this._state = 1; this._mousePrev.set(touches[0].clientX, touches[0].clientY); }
      else if (touches.length === 2) { this._state = 3; }
    });
    el.addEventListener('touchmove', e => {
      const t = Array.from(e.touches);
      if (this._state === 1 && t.length === 1) {
        const dx = t[0].clientX - this._mousePrev.x, dy = t[0].clientY - this._mousePrev.y;
        this._sphericalDelta.theta -= (2 * Math.PI * dx / el.clientWidth) * this.rotateSpeed;
        this._sphericalDelta.phi -= (2 * Math.PI * dy / el.clientHeight) * this.rotateSpeed;
        this._mousePrev.set(t[0].clientX, t[0].clientY);
      } else if (this._state === 3 && t.length === 2) {
        const d0 = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        const d1 = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        this._scale *= d0 / d1;
        touches = t;
      }
    });
    el.addEventListener('touchend', () => { this._state = 0; });
  }
  update() {
    this._spherical.theta += this._sphericalDelta.theta;
    this._spherical.phi += this._sphericalDelta.phi;
    this._spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._spherical.phi));
    this._spherical.radius *= this._scale;
    this._spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius));
    this.target.add(this._panOffset);
    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    if (this.enableDamping) {
      this._sphericalDelta.theta *= (1 - this.dampingFactor);
      this._sphericalDelta.phi *= (1 - this.dampingFactor);
      this._panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this._sphericalDelta.set(0, 0, 0);
      this._panOffset.set(0, 0, 0);
    }
    this._scale = 1;
  }
}

// ─── Scene Setup ─────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04080f);
scene.fog = new THREE.FogExp2(0x04080f, 0.018);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(6, 2, 10);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls._updateSpherical();

// ─── Lighting ────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x0a1628, 3.0);
scene.add(ambient);

const mainLight = new THREE.DirectionalLight(0x4488ff, 2.5);
mainLight.position.set(8, 12, 6);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.near = 0.1;
mainLight.shadow.camera.far = 50;
mainLight.shadow.camera.top = 10;
mainLight.shadow.camera.bottom = -10;
mainLight.shadow.camera.left = -10;
mainLight.shadow.camera.right = 10;
scene.add(mainLight);

const rimLight = new THREE.DirectionalLight(0x00aaff, 1.2);
rimLight.position.set(-6, 4, -4);
scene.add(rimLight);

const bottomLight = new THREE.PointLight(0x00ff9d, 1.0, 12);
bottomLight.position.set(0, -5, 0);
scene.add(bottomLight);

const accentLight = new THREE.PointLight(0x00c8ff, 2.0, 8);
accentLight.position.set(2, 0, 3);
scene.add(accentLight);

// ─── Background Stars ─────────────────────────────────────────────────────────
const starGeo = new THREE.BufferGeometry();
const starCount = 1500;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0x334466, size: 0.08, transparent: true, opacity: 0.6 });
scene.add(new THREE.Points(starGeo, starMat));

// ─── Grid Floor ──────────────────────────────────────────────────────────────
const grid = new THREE.GridHelper(30, 40, 0x0a1a2a, 0x071018);
grid.position.y = -6.5;
scene.add(grid);

// ─── Materials ───────────────────────────────────────────────────────────────
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x88bbff, transparent: true, opacity: 0.08,
  roughness: 0.02, metalness: 0.0, transmission: 0.92,
  thickness: 0.15, side: THREE.DoubleSide,
  envMapIntensity: 1.5
});

const glassRimMat = new THREE.MeshPhysicalMaterial({
  color: 0x00aaff, transparent: true, opacity: 0.25,
  roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide
});

const aluminiumMat = (glow = false) => new THREE.MeshPhysicalMaterial({
  color: glow ? 0x00ccff : 0x88aacc,
  emissive: glow ? 0x0044aa : 0x001133,
  emissiveIntensity: glow ? 0.8 : 0.1,
  roughness: 0.2, metalness: 0.85,
  transparent: true, opacity: 0.88,
});

const anodeMat = new THREE.MeshPhysicalMaterial({
  color: 0x00ddff, emissive: 0x003366, emissiveIntensity: 0.9,
  roughness: 0.15, metalness: 0.9, transparent: true, opacity: 0.85,
});

const cathodeMat = new THREE.MeshPhysicalMaterial({
  color: 0xff6633, emissive: 0x441100, emissiveIntensity: 0.7,
  roughness: 0.15, metalness: 0.9, transparent: true, opacity: 0.85,
});

const acrylicMat = new THREE.MeshPhysicalMaterial({
  color: 0x88ccff, transparent: true, opacity: 0.35,
  roughness: 0.05, metalness: 0.0, side: THREE.DoubleSide,
});

const sensorMat = (col) => new THREE.MeshPhysicalMaterial({
  color: col, emissive: col, emissiveIntensity: 0.5,
  roughness: 0.3, metalness: 0.6,
});

const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x0066cc, transparent: true, opacity: 0.22,
  roughness: 0.0, metalness: 0.0, transmission: 0.7,
  side: THREE.DoubleSide,
});

const cleanWaterMat = new THREE.MeshPhysicalMaterial({
  color: 0x00aaff, transparent: true, opacity: 0.28,
  roughness: 0.0, transmission: 0.75, side: THREE.DoubleSide,
});

const sludgeMat = new THREE.MeshPhysicalMaterial({
  color: 0x3d2a0a, transparent: true, opacity: 0.7,
  roughness: 0.9, metalness: 0.0,
});

// ─── Tank Geometry Constants ──────────────────────────────────────────────────
const R = 1.0;       // cylinder radius
const WALL = 0.04;   // wall thickness
const H = 12.0;      // total height
const SEGS = 64;

// Stage Y positions (bottom of tank = -H/2 = -6)
const stageY = {
  sono:       5.2,
  propeller:  4.0,
  ec:         1.5,
  gate:      -1.2,
  sensor:    -2.2,
  lamella:   -3.5,
  collection:-5.2,
};

// ─── Main Tank Group ──────────────────────────────────────────────────────────
const tankGroup = new THREE.Group();
scene.add(tankGroup);

// Cylinder outer shell
const outerGeo = new THREE.CylinderGeometry(R + WALL, R + WALL, H, SEGS, 1, true);
const outerMesh = new THREE.Mesh(outerGeo, glassMat);
outerMesh.castShadow = false;
tankGroup.add(outerMesh);

// Top & bottom caps
const capGeo = new THREE.RingGeometry(0, R + WALL, SEGS);
const capMat = new THREE.MeshPhysicalMaterial({ color: 0x224466, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.6 });
const topCap = new THREE.Mesh(capGeo, capMat);
topCap.rotation.x = -Math.PI / 2;
topCap.position.y = H / 2;
tankGroup.add(topCap);
const botCap = new THREE.Mesh(capGeo, capMat.clone());
botCap.rotation.x = Math.PI / 2;
botCap.position.y = -H / 2;
tankGroup.add(botCap);

// Rim rings
[-H/2, -H/2 + 0.2, H/2, H/2 - 0.2].forEach(y => {
  const rGeo = new THREE.TorusGeometry(R + WALL + 0.01, 0.025, 8, SEGS);
  const rMesh = new THREE.Mesh(rGeo, glassRimMat);
  rMesh.rotation.x = Math.PI / 2;
  rMesh.position.y = y;
  tankGroup.add(rMesh);
});

// Water column inside
const waterColGeo = new THREE.CylinderGeometry(R - 0.01, R - 0.01, H - 0.2, SEGS, 1, true);
const waterCol = new THREE.Mesh(waterColGeo, waterMat);
tankGroup.add(waterCol);

// ─── Stage Groups (for explode/collapse) ─────────────────────────────────────
const stageGroups = [];
const stageBaseY = [];
const stageExpandY = [3.5, 3.0, 4.5, 2.5, 2.0, 3.0, 2.5]; // how far each stage explodes out

function makeStageGroup(idx, yPos) {
  const g = new THREE.Group();
  g.position.y = yPos;
  g._expanded = false;
  g._targetY = yPos;
  g._baseY = yPos;
  stageGroups.push(g);
  stageBaseY.push(yPos);
  tankGroup.add(g);
  return g;
}

// ─── STAGE 0: Sonication Chamber ─────────────────────────────────────────────
const g0 = makeStageGroup(0, stageY.sono);
{
  // Transducer ring (piezo elements around cylinder)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tGeo = new THREE.BoxGeometry(0.18, 0.35, 0.08);
    const tMat = new THREE.MeshPhysicalMaterial({
      color: 0x00aaff, emissive: 0x003388, emissiveIntensity: 0.6,
      roughness: 0.3, metalness: 0.7
    });
    const t = new THREE.Mesh(tGeo, tMat);
    t.position.set(
      Math.cos(angle) * (R + WALL + 0.06),
      0,
      Math.sin(angle) * (R + WALL + 0.06)
    );
    t.lookAt(new THREE.Vector3(0, 0, 0));
    t._isTransducer = true;
    g0.add(t);
  }
  // Sono band
  const bandGeo = new THREE.CylinderGeometry(R + WALL + 0.02, R + WALL + 0.02, 0.6, SEGS, 1, true);
  const bandMat = new THREE.MeshPhysicalMaterial({
    color: 0x0055aa, transparent: true, opacity: 0.3,
    emissive: 0x002266, emissiveIntensity: 0.4, side: THREE.DoubleSide,
  });
  g0.add(new THREE.Mesh(bandGeo, bandMat));
  // Label disc
  const lGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.02, SEGS);
  const lMat = new THREE.MeshPhysicalMaterial({ color: 0x001133, transparent: true, opacity: 0.5 });
  g0.add(new THREE.Mesh(lGeo, lMat));
}

// ─── STAGE 1: Propeller Zone ──────────────────────────────────────────────────
const g1 = makeStageGroup(1, stageY.propeller);
{
  // Motor housing (outside)
  const mGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16);
  const mMat = new THREE.MeshPhysicalMaterial({ color: 0x334466, roughness: 0.4, metalness: 0.8 });
  const motor = new THREE.Mesh(mGeo, mMat);
  motor.rotation.z = Math.PI / 2;
  motor.position.set(R + WALL + 0.35, 0, 0);
  g1.add(motor);
  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, R + 0.4, 8);
  const shaftMat = new THREE.MeshPhysicalMaterial({ color: 0x667788, roughness: 0.3, metalness: 0.9 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(R * 0.5, 0, 0);
  g1.add(shaft);
  // Propeller blades (3 blades)
  const propGroup = new THREE.Group();
  propGroup._isPropeller = true;
  for (let i = 0; i < 3; i++) {
    const bGeo = new THREE.BoxGeometry(R * 0.85, 0.04, 0.22);
    const bMat = new THREE.MeshPhysicalMaterial({
      color: 0x0088cc, emissive: 0x002244, emissiveIntensity: 0.3,
      roughness: 0.2, metalness: 0.7, transparent: true, opacity: 0.9,
    });
    const blade = new THREE.Mesh(bGeo, bMat);
    blade.rotation.y = (i / 3) * Math.PI * 2;
    propGroup.add(blade);
  }
  propGroup.position.set(0, 0, 0);
  g1.add(propGroup);
  window._propGroup = propGroup;
  // Perforated disc
  const pdGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.06, SEGS);
  const pdMat = new THREE.MeshPhysicalMaterial({
    color: 0x336699, transparent: true, opacity: 0.6, roughness: 0.3, metalness: 0.5,
  });
  const pd = new THREE.Mesh(pdGeo, pdMat);
  pd.position.y = -0.6;
  g1.add(pd);
  // Holes in perf disc (visual)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const hGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8);
    const hMat = new THREE.MeshPhysicalMaterial({ color: 0x001133, roughness: 0.5 });
    const h = new THREE.Mesh(hGeo, hMat);
    h.position.set(Math.cos(angle) * R * 0.6, -0.6, Math.sin(angle) * R * 0.6);
    g1.add(h);
  }
}

// ─── STAGE 2: Electrocoagulation Chamber ─────────────────────────────────────
const g2 = makeStageGroup(2, stageY.ec);
const ecDiscs = [];
{
  const discPositions = [-2.5, -1.8, -1.1, -0.4, 0.3, 1.0];
  discPositions.forEach((yOff, i) => {
    const isAnode = i % 2 === 0;
    const dGeo = new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.055, SEGS);
    const dMat = isAnode ? anodeMat.clone() : cathodeMat.clone();
    const disc = new THREE.Mesh(dGeo, dMat);
    disc.position.y = yOff;
    disc._isDisc = true;
    disc._isAnode = isAnode;
    ecDiscs.push(disc);
    g2.add(disc);
    // Holes array on disc surface
    for (let h = 0; h < 10; h++) {
      const a = (h / 10) * Math.PI * 2;
      const hGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.07, 8);
      const hMat = new THREE.MeshPhysicalMaterial({ color: 0x001122, roughness: 0.8 });
      const hole = new THREE.Mesh(hGeo, hMat);
      hole.position.set(Math.cos(a) * R * 0.55, yOff, Math.sin(a) * R * 0.55);
      g2.add(hole);
    }
    // Electrode wire bolt (outside wall)
    const bGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
    const bMat = new THREE.MeshPhysicalMaterial({ color: isAnode ? 0x00aaff : 0xff6633, roughness: 0.3, metalness: 0.8 });
    const bolt = new THREE.Mesh(bGeo, bMat);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(R + WALL + 0.12, yOff, 0);
    g2.add(bolt);
    // Glow ring per disc
    const glowGeo = new THREE.TorusGeometry(R * 0.97, 0.02, 8, SEGS);
    const glowMat = new THREE.MeshBasicMaterial({
      color: isAnode ? 0x00ddff : 0xff6633, transparent: true, opacity: 0.5,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = yOff;
    glow._glowRing = true;
    glow._baseOpacity = 0.5;
    g2.add(glow);
  });
  // Wire bus
  const wireGeo = new THREE.CylinderGeometry(0.015, 0.015, 3.8, 8);
  const wireMat = new THREE.MeshPhysicalMaterial({ color: 0x334455, roughness: 0.8 });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.position.set(R + WALL + 0.12, -0.75, 0);
  g2.add(wire);
}

// ─── STAGE 3: Timed Gate ──────────────────────────────────────────────────────
const g3 = makeStageGroup(3, stageY.gate);
let gateDisc2;
{
  // Fixed perforated disc
  const d1Geo = new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.06, SEGS);
  const d1Mat = new THREE.MeshPhysicalMaterial({ color: 0x4477aa, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.8 });
  const d1 = new THREE.Mesh(d1Geo, d1Mat);
  d1.position.y = 0.12;
  g3.add(d1);
  for (let h = 0; h < 10; h++) {
    const a = (h / 10) * Math.PI * 2;
    const hGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
    const hMat = new THREE.MeshPhysicalMaterial({ color: 0x001122, roughness: 0.8 });
    const hole = new THREE.Mesh(hGeo, hMat);
    hole.position.set(Math.cos(a) * R * 0.58, 0.12, Math.sin(a) * R * 0.58);
    g3.add(hole);
  }
  // Servo disc (solid, blocks flow)
  const d2Geo = new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.06, SEGS);
  const d2Mat = new THREE.MeshPhysicalMaterial({
    color: 0x223355, roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.92,
    emissive: 0x001133, emissiveIntensity: 0.3
  });
  gateDisc2 = new THREE.Mesh(d2Geo, d2Mat);
  gateDisc2.position.y = -0.06;
  gateDisc2._isGateDisc = true;
  g3.add(gateDisc2);
  // Servo motor
  const sGeo = new THREE.BoxGeometry(0.35, 0.22, 0.22);
  const sMat = new THREE.MeshPhysicalMaterial({ color: 0x334455, roughness: 0.4, metalness: 0.7 });
  const servo = new THREE.Mesh(sGeo, sMat);
  servo.position.set(R + WALL + 0.25, 0, 0);
  g3.add(servo);
  // Servo arm
  const armGeo = new THREE.BoxGeometry(0.18, 0.04, 0.04);
  const armMat = new THREE.MeshPhysicalMaterial({ color: 0xaabbcc, roughness: 0.5, metalness: 0.6 });
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.position.set(R + WALL + 0.15, 0, 0);
  g3.add(arm);
}

// ─── STAGE 4: Sensor Pod ──────────────────────────────────────────────────────
const g4 = makeStageGroup(4, stageY.sensor);
const sensorMeshes = [];
{
  const sensors = [
    { col: 0x00ff99, name: 'TURB1', angle: 0 },
    { col: 0x00ff99, name: 'TURB2', angle: Math.PI * 0.5 },
    { col: 0xffcc00, name: 'pH', angle: Math.PI },
    { col: 0xaa44ff, name: 'TDS', angle: Math.PI * 1.5 },
  ];
  sensors.forEach(({ col, angle }) => {
    const sGeo = new THREE.BoxGeometry(0.16, 0.28, 0.12);
    const sMat = sensorMat(col);
    const sensor = new THREE.Mesh(sGeo, sMat);
    sensor.position.set(Math.cos(angle) * (R - 0.2), 0, Math.sin(angle) * (R - 0.2));
    sensor._isSensor = true;
    sensor._baseEmissive = sMat.emissiveIntensity;
    sensorMeshes.push(sensor);
    g4.add(sensor);
    // Sensor probe
    const pGeo = new THREE.CylinderGeometry(0.025, 0.015, 0.35, 8);
    const pMat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.4, metalness: 0.6 });
    const probe = new THREE.Mesh(pGeo, pMat);
    probe.position.set(Math.cos(angle) * (R - 0.15), -0.25, Math.sin(angle) * (R - 0.15));
    g4.add(probe);
  });
  // ESP32 module
  const esp = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.35),
    new THREE.MeshPhysicalMaterial({ color: 0x224422, emissive: 0x112211, roughness: 0.4, metalness: 0.3 })
  );
  esp.position.set(R + WALL + 0.3, 0.1, 0);
  g4.add(esp);
  // ESP32 antenna
  const antGeo = new THREE.BoxGeometry(0.04, 0.25, 0.015);
  const ant = new THREE.Mesh(antGeo, new THREE.MeshPhysicalMaterial({ color: 0x335533, roughness: 0.5 }));
  ant.position.set(R + WALL + 0.52, 0.28, 0);
  g4.add(ant);
}

// ─── STAGE 5: Lamella Settling ─────────────────────────────────────────────────
const g5 = makeStageGroup(5, stageY.lamella);
{
  // Two V-shape acrylic strips
  const makeStrip = (side) => {
    const shape = new THREE.Shape();
    // 45% of diameter = 0.9 R wide, angled strip
    shape.moveTo(0, 0);
    shape.lineTo(R * 0.9, 0);
    shape.lineTo(R * 0.9 - 0.3, -2.0);
    shape.lineTo(-0.3, -2.0);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, acrylicMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(side === 'left' ? -R * 0.95 : 0.1, 0.5, 0);
    if (side === 'right') mesh.scale.x = -1;
    return mesh;
  };
  g5.add(makeStrip('left'));
  g5.add(makeStrip('right'));

  // Support rods
  for (let i = 0; i < 2; i++) {
    const rGeo = new THREE.CylinderGeometry(0.018, 0.018, R * 2 + 0.12, 8);
    const rMat = new THREE.MeshPhysicalMaterial({ color: 0x667788, roughness: 0.4, metalness: 0.8 });
    const rod = new THREE.Mesh(rGeo, rMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, -0.5 + i * (-1.0), i === 0 ? 0.2 : -0.2);
    g5.add(rod);
  }
  // Centre gap indicator ring
  const gapGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 16);
  const gapMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 });
  const gapRing = new THREE.Mesh(gapGeo, gapMat);
  gapRing.rotation.x = Math.PI / 2;
  gapRing.position.y = -1.8;
  g5.add(gapRing);
}

// ─── STAGE 6: Collection Zone ─────────────────────────────────────────────────
const g6 = makeStageGroup(6, stageY.collection);
{
  // Clean water layer
  const cwGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 1.2, SEGS);
  const cw = new THREE.Mesh(cwGeo, cleanWaterMat.clone());
  cw.position.y = 0.4;
  g6.add(cw);
  // Separation line disc
  const sepGeo = new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.025, SEGS);
  const sepMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.7 });
  const sep = new THREE.Mesh(sepGeo, sepMat);
  sep.position.y = -0.2;
  g6.add(sep);
  // Sludge layer
  const slGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.9, SEGS);
  const sl = new THREE.Mesh(slGeo, sludgeMat.clone());
  sl.position.y = -0.65;
  g6.add(sl);
  // Drain cut
  const drGeo = new THREE.CylinderGeometry(0.12, 0.12, WALL * 3, 12);
  const drMat = new THREE.MeshPhysicalMaterial({ color: 0x3d2a0a, roughness: 0.9 });
  const dr = new THREE.Mesh(drGeo, drMat);
  dr.rotation.z = Math.PI / 2;
  dr.position.set(R + WALL + 0.02, -1.0, 0);
  g6.add(dr);
  // Output pipe
  const opGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12);
  const opMat = new THREE.MeshPhysicalMaterial({ color: 0x00aa66, roughness: 0.4, metalness: 0.6 });
  const op = new THREE.Mesh(opGeo, opMat);
  op.position.y = -1.5;
  g6.add(op);
  // Output arrow (cone)
  const coneGeo = new THREE.ConeGeometry(0.15, 0.3, 12);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x00ff9d, transparent: true, opacity: 0.85 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -1.95;
  cone.rotation.x = Math.PI;
  g6.add(cone);
}

// ─── Particle Systems ────────────────────────────────────────────────────────
let particlesEnabled = true;

// Dirty particles (suspended solids)
const dirtyGeo = new THREE.BufferGeometry();
const DIRTY_COUNT = 300;
const dirtyPos = new Float32Array(DIRTY_COUNT * 3);
const dirtyVel = new Float32Array(DIRTY_COUNT * 3);
for (let i = 0; i < DIRTY_COUNT; i++) {
  const r = Math.random() * R * 0.85;
  const a = Math.random() * Math.PI * 2;
  dirtyPos[i*3]   = Math.cos(a) * r;
  dirtyPos[i*3+1] = (Math.random() - 0.5) * H * 0.85;
  dirtyPos[i*3+2] = Math.sin(a) * r;
  dirtyVel[i*3+1] = -0.008 - Math.random() * 0.012;
}
dirtyGeo.setAttribute('position', new THREE.BufferAttribute(dirtyPos, 3));
const dirtyMat = new THREE.PointsMaterial({
  color: 0x88aa44, size: 0.06, transparent: true, opacity: 0.65,
  vertexColors: false, sizeAttenuation: true,
});
const dirtyParticles = new THREE.Points(dirtyGeo, dirtyMat);
tankGroup.add(dirtyParticles);

// Bubble particles (H2 rising)
const bubbleGeo = new THREE.BufferGeometry();
const BUBBLE_COUNT = 120;
const bubblePos = new Float32Array(BUBBLE_COUNT * 3);
const bubbleVel = new Float32Array(BUBBLE_COUNT * 3);
for (let i = 0; i < BUBBLE_COUNT; i++) {
  const r = Math.random() * R * 0.7;
  const a = Math.random() * Math.PI * 2;
  bubblePos[i*3]   = Math.cos(a) * r;
  bubblePos[i*3+1] = stageY.ec - 2.5 + Math.random() * 3.5;
  bubblePos[i*3+2] = Math.sin(a) * r;
  bubbleVel[i*3+1] = 0.015 + Math.random() * 0.02;
}
bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
const bubbleMat = new THREE.PointsMaterial({
  color: 0xaaddff, size: 0.055, transparent: true, opacity: 0.7,
  sizeAttenuation: true,
});
const bubbleParticles = new THREE.Points(bubbleGeo, bubbleMat);
tankGroup.add(bubbleParticles);

// Floc particles (clumping)
const flocGeo = new THREE.BufferGeometry();
const FLOC_COUNT = 180;
const flocPos = new Float32Array(FLOC_COUNT * 3);
const flocVel = new Float32Array(FLOC_COUNT * 3);
for (let i = 0; i < FLOC_COUNT; i++) {
  const r = Math.random() * R * 0.75;
  const a = Math.random() * Math.PI * 2;
  flocPos[i*3]   = Math.cos(a) * r;
  flocPos[i*3+1] = stageY.ec - 1.0 + Math.random() * 2.0;
  flocPos[i*3+2] = Math.sin(a) * r;
  flocVel[i*3+1] = -(0.004 + Math.random() * 0.006);
}
flocGeo.setAttribute('position', new THREE.BufferAttribute(flocPos, 3));
const flocMat = new THREE.PointsMaterial({
  color: 0xccaa44, size: 0.075, transparent: true, opacity: 0.55,
  sizeAttenuation: true,
});
const flocParticles = new THREE.Points(flocGeo, flocMat);
tankGroup.add(flocParticles);

// Cavitation sparks (sonication)
const cavGeo = new THREE.BufferGeometry();
const CAV_COUNT = 80;
const cavPos = new Float32Array(CAV_COUNT * 3);
for (let i = 0; i < CAV_COUNT; i++) {
  const r = Math.random() * R * 0.9;
  const a = Math.random() * Math.PI * 2;
  cavPos[i*3]   = Math.cos(a) * r;
  cavPos[i*3+1] = stageY.sono - 0.3 + Math.random() * 0.6;
  cavPos[i*3+2] = Math.sin(a) * r;
}
cavGeo.setAttribute('position', new THREE.BufferAttribute(cavPos, 3));
const cavMat = new THREE.PointsMaterial({
  color: 0x00eeff, size: 0.04, transparent: true, opacity: 0.8,
  sizeAttenuation: true,
});
const cavParticles = new THREE.Points(cavGeo, cavMat);
tankGroup.add(cavParticles);

// ─── Raycaster for click detection ───────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const clickableObjects = [];
stageGroups.forEach((g, i) => {
  g.traverse(child => {
    if (child.isMesh) {
      child._stageIndex = i;
      clickableObjects.push(child);
    }
  });
});

renderer.domElement.addEventListener('click', onCanvasClick);

function onCanvasClick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(clickableObjects, false);
  if (hits.length > 0) {
    const idx = hits[0].object._stageIndex;
    if (idx !== undefined) toggleStage(idx);
  }
}

// ─── Stage expand/collapse ────────────────────────────────────────────────────
const stageInfo = [
  {
    tag: 'S0 — PRETREATMENT', title: 'SONICATION CHAMBER',
    rows: [
      ['Frequency', '40 kHz'], ['Power Density', '50–100 W/L'],
      ['HRT', '10–30 s'], ['Chamber Volume', '0.6–0.87 L'],
      ['Transducers', 'Piezoelectric × 8'],
    ],
    desc: 'Ultrasonic cavitation breaks surfactant micelles and fragments colloidal particles from ~70µm to <15µm. Addresses the primary limitation of EC on raw greywater. Interfacial pyrolysis and ·OH radical generation degrade LAS detergents below their CMC threshold.'
  },
  {
    tag: 'S1 — FLOW CONTROL', title: 'PROPELLER ZONE',
    rows: [
      ['Blade Span', '80–90% of dia.'], ['Motor', '12V DC, outside wall'],
      ['RPM', 'Low — resistance only'], ['Disc', 'Perforated, controls HRT'],
    ],
    desc: 'Slows and distributes incoming water before the EC chamber. Motor stays completely dry — shaft passes through a rubber grommet seal. Without this, fast-moving water short-circuits the electrocoagulation process.'
  },
  {
    tag: 'S2 — PRIMARY', title: 'ELECTROCOAGULATION',
    rows: [
      ['Discs', '6–8 Al, 2–3mm thick'], ['Spacing', '10–12mm'],
      ['Power', '12V DC'], ['Contact Time', '15 min'],
      ['Holes/disc', '20–30, ⌀4–6mm'], ['Polarity Reversal', 'Every 2–3 min'],
    ],
    desc: 'Aluminium sacrificial anodes release Al³⁺ ions under DC current. These form Al(OH)₃ floc that binds suspended solids, surfactants, and pathogens. H₂ bubbles at cathode float lighter floc upward. Discs are locked 360° in wall grooves — no bypass possible.'
  },
  {
    tag: 'S3 — TIMING', title: 'TIMED GATE',
    rows: [
      ['Hold Time', '15 minutes'], ['Mechanism', '2-disc servo'],
      ['Control', 'ESP32 timer'], ['Disc 1', 'Fixed perforated'],
      ['Disc 2', 'Solid, servo-rotated'],
    ],
    desc: 'Guarantees minimum 15-minute EC contact time before water advances. Pressure buildup during the hold phase passively dislodges floc from disc surfaces when the gate opens — a self-cleaning effect.'
  },
  {
    tag: 'S4 — SENSING', title: 'SENSOR POD',
    rows: [
      ['Turbidity', '×2 sensors'], ['pH', '±0.01 accuracy'],
      ['TDS', 'Conductivity-based'], ['MCU', 'ESP32-WROOM-32'],
      ['ML Model', 'TFLite — on-device'], ['Display', 'OLED 0.96" I²C'],
    ],
    desc: 'Unified sensor housing for single-point calibration. TensorFlow Lite edge model classifies water quality in real-time from 3 sensor inputs — no cloud, no WiFi required. Output: CLEAN / TREAT / REJECT on OLED.'
  },
  {
    tag: 'S5 — SETTLING', title: 'LAMELLA SECTION',
    rows: [
      ['Config', 'V-settler (chevron)'], ['Material', '3mm clear acrylic'],
      ['Left strip', '45% of dia.'], ['Gap', '10% centre'],
      ['Right strip', '45% of dia.'], ['Mechanism', 'Gravity slide'],
    ],
    desc: 'Two opposing acrylic strips in V-configuration. Coagulated particles land on strips and slide by gravity toward the 10% centre gap. Classic industrial V-settler design adapted for cylindrical geometry. Clean water rises; heavy floc falls through.'
  },
  {
    tag: 'S6 — OUTPUT', title: 'COLLECTION ZONE',
    rows: [
      ['Separation', 'Gravity — no mesh'], ['Clean water', 'Floats on top'],
      ['Sludge', 'Sinks to base'], ['Drain', 'Single side-wall cut'],
      ['Sludge output', '0.1–0.3 kg/m³'], ['Output quality', 'IS 16796 Cat B'],
    ],
    desc: 'Natural gravity separation between treated clean water and settled Al(OH)₃ sludge. Turbidity sensor signals drain-ready state. Sludge drains first by gravity through side-wall cut. Output meets IS 16796 Category B — suitable for toilet flushing and irrigation.'
  },
];

window.toggleStage = function(idx) {
  const g = stageGroups[idx];
  g._expanded = !g._expanded;
  const btn = document.querySelector(`[data-stage="${idx}"]`);
  if (g._expanded) {
    btn.classList.add('expanded');
    showInfo(idx);
  } else {
    btn.classList.remove('expanded');
    if (activeInfoIdx === idx) closeInfo();
  }
};

let activeInfoIdx = -1;
function showInfo(idx) {
  activeInfoIdx = idx;
  const info = stageInfo[idx];
  document.getElementById('ip-tag').textContent = info.tag;
  document.getElementById('ip-title').textContent = info.title;
  const rowsEl = document.getElementById('ip-rows');
  rowsEl.innerHTML = info.rows.map(([k, v]) =>
    `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`
  ).join('');
  document.getElementById('ip-desc').textContent = info.desc;
  document.getElementById('info-panel').classList.add('visible');
}

window.closeInfo = function() {
  document.getElementById('info-panel').classList.remove('visible');
  activeInfoIdx = -1;
};

// ─── Controls ────────────────────────────────────────────────────────────────
window.resetCamera = function() {
  // Smoothly reset via animation
  const startPos = camera.position.clone();
  const targetPos = new THREE.Vector3(6, 2, 10);
  const startTarget = controls.target.clone();
  let t = 0;
  const reset = setInterval(() => {
    t += 0.05;
    camera.position.lerpVectors(startPos, targetPos, Math.min(t, 1));
    controls.target.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), Math.min(t, 1));
    controls._updateSpherical();
    if (t >= 1) clearInterval(reset);
  }, 16);
};

let allExpanded = false;
window.toggleExpandAll = function() {
  allExpanded = !allExpanded;
  stageGroups.forEach((g, i) => {
    g._expanded = allExpanded;
    const btn = document.querySelector(`[data-stage="${i}"]`);
    if (allExpanded) btn.classList.add('expanded');
    else { btn.classList.remove('expanded'); }
  });
  document.getElementById('expand-all-btn').classList.toggle('all-expanded', allExpanded);
  document.getElementById('expand-all-btn').textContent = allExpanded ? '⊟ COLLAPSE ALL' : '⊞ EXPAND ALL';
  if (!allExpanded) closeInfo();
};

window.toggleParticles = function() {
  particlesEnabled = !particlesEnabled;
  dirtyParticles.visible = particlesEnabled;
  bubbleParticles.visible = particlesEnabled;
  flocParticles.visible = particlesEnabled;
  cavParticles.visible = particlesEnabled;
  const btn = document.getElementById('particles-btn');
  btn.textContent = particlesEnabled ? '◎ PARTICLES ON' : '◎ PARTICLES OFF';
  btn.classList.toggle('active', particlesEnabled);
};

let wireframe = false;
window.toggleWireframe = function() {
  wireframe = !wireframe;
  scene.traverse(obj => {
    if (obj.isMesh && obj.material && !obj._noWire) {
      obj.material.wireframe = wireframe;
    }
  });
};

let flowEnabled = false;
window.toggleFlow = function() {
  flowEnabled = !flowEnabled;
  document.getElementById('flow-btn').classList.toggle('active', flowEnabled);
  document.getElementById('flow-btn').textContent = flowEnabled ? '⏸ FLOW ANIM' : '▶ FLOW ANIM';
};

// ─── Expand animation state ──────────────────────────────────────────────────
// Each stage explodes: stage 0 goes up most, stage 6 goes down most
const expandDirections = [1, 1, 0.5, 0, -0.5, -1, -1.2]; // y multipliers
const expandAmount = 2.8;

// ─── Animation Loop ───────────────────────────────────────────────────────────
let clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = clock.getDelta ? 0.016 : 0.016;
  frameCount++;

  controls.update();

  // ─── Stage expand/collapse smooth animation ───
  stageGroups.forEach((g, i) => {
    const targetY = g._baseY + (g._expanded ? expandDirections[i] * expandAmount : 0);
    g.position.y += (targetY - g.position.y) * 0.08;
  });

  // ─── Propeller spin ───
  if (window._propGroup) {
    window._propGroup.rotation.y += 0.04;
  }

  // ─── EC disc glow pulse ───
  if (frameCount % 2 === 0) {
    ecDiscs.forEach((disc, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 0.8);
      disc.material.emissiveIntensity = disc._isAnode ? 0.6 + pulse * 0.5 : 0.4 + pulse * 0.4;
    });
    g2.traverse(child => {
      if (child._glowRing) {
        child.material.opacity = 0.25 + 0.35 * Math.sin(t * 3 + (child._isAnode ? 0 : Math.PI));
      }
    });
  }

  // ─── Transducer glow (sonication) ───
  g0.traverse(child => {
    if (child._isTransducer) {
      child.material.emissiveIntensity = 0.3 + 0.5 * Math.abs(Math.sin(t * 8 + child.position.x));
    }
  });

  // ─── Sensor pulse ───
  sensorMeshes.forEach((s, i) => {
    s.material.emissiveIntensity = 0.3 + 0.5 * Math.abs(Math.sin(t * 3 + i * 1.2));
  });

  // ─── Gate open/close visual ───
  if (gateDisc2) {
    const isGateExpanded = stageGroups[3]._expanded;
    gateDisc2.rotation.y += isGateExpanded
      ? (Math.PI * 0.5 - gateDisc2.rotation.y) * 0.05
      : (0 - gateDisc2.rotation.y) * 0.05;
    gateDisc2.material.opacity = isGateExpanded ? 0.3 : 0.92;
  }

  // ─── Output cone pulse ───
  g6.traverse(child => {
    if (child.isMesh && child.geometry.type === 'ConeGeometry') {
      child.material.opacity = 0.5 + 0.35 * Math.sin(t * 2.5);
    }
  });

  // ─── Particle animation ───
  if (particlesEnabled) {
    // Dirty particles fall
    const dp = dirtyGeo.attributes.position.array;
    for (let i = 0; i < DIRTY_COUNT; i++) {
      dp[i*3+1] += dirtyVel[i*3+1];
      if (dp[i*3+1] < -H / 2) {
        dp[i*3+1] = H / 2 - 0.2;
        const r = Math.random() * R * 0.8;
        const a = Math.random() * Math.PI * 2;
        dp[i*3] = Math.cos(a) * r;
        dp[i*3+2] = Math.sin(a) * r;
      }
    }
    dirtyGeo.attributes.position.needsUpdate = true;

    // Bubbles rise
    const bp = bubbleGeo.attributes.position.array;
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      bp[i*3+1] += bubbleVel[i*3+1];
      bp[i*3] += (Math.random() - 0.5) * 0.008;
      bp[i*3+2] += (Math.random() - 0.5) * 0.008;
      if (bp[i*3+1] > stageY.ec + 1.5) {
        bp[i*3+1] = stageY.ec - 2.5;
        const r = Math.random() * R * 0.65;
        const a = Math.random() * Math.PI * 2;
        bp[i*3] = Math.cos(a) * r;
        bp[i*3+2] = Math.sin(a) * r;
      }
    }
    bubbleGeo.attributes.position.needsUpdate = true;

    // Floc settles
    const fp = flocGeo.attributes.position.array;
    for (let i = 0; i < FLOC_COUNT; i++) {
      fp[i*3+1] += flocVel[i*3+1];
      if (fp[i*3+1] < stageY.collection - 1.0) {
        fp[i*3+1] = stageY.ec + 1.5;
        const r = Math.random() * R * 0.7;
        const a = Math.random() * Math.PI * 2;
        fp[i*3] = Math.cos(a) * r;
        fp[i*3+2] = Math.sin(a) * r;
      }
    }
    flocGeo.attributes.position.needsUpdate = true;

    // Cavitation sparks randomize
    if (frameCount % 4 === 0) {
      const cp = cavGeo.attributes.position.array;
      for (let i = 0; i < CAV_COUNT; i++) {
        if (Math.random() < 0.12) {
          const r = Math.random() * R * 0.88;
          const a = Math.random() * Math.PI * 2;
          cp[i*3] = Math.cos(a) * r;
          cp[i*3+1] = stageY.sono - 0.3 + Math.random() * 0.6;
          cp[i*3+2] = Math.sin(a) * r;
        }
      }
      cavGeo.attributes.position.needsUpdate = true;
      cavMat.opacity = 0.4 + 0.5 * Math.abs(Math.sin(t * 6));
    }
  }

  // ─── Ambient light color shift ───
  accentLight.position.x = 2 * Math.sin(t * 0.3);
  accentLight.position.z = 3 * Math.cos(t * 0.3);

  // ─── Flow animation (water falling) ───
  if (flowEnabled) {
    dirtyMat.opacity = 0.4 + 0.2 * Math.sin(t * 1.5);
  }

  renderer.render(scene, camera);
}

// ─── Resize handler ──────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Loader ──────────────────────────────────────────────────────────────────
let progress = 0;
const lbar = document.getElementById('lbar');
const lpct = document.getElementById('lpct');
const loadInterval = setInterval(() => {
  progress += 3 + Math.random() * 5;
  if (progress >= 100) {
    progress = 100;
    clearInterval(loadInterval);
    setTimeout(() => {
      document.getElementById('loader').classList.add('hidden');
      // Hide hint after 5s
      setTimeout(() => {
        document.getElementById('controls-hint').style.opacity = '0';
      }, 5000);
    }, 400);
  }
  lbar.style.width = progress + '%';
  lpct.textContent = Math.floor(progress) + '%';
}, 60);

// ─── Start ────────────────────────────────────────────────────────────────────
animate();
