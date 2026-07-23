import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─────────────────────────────────────────────
//  Renderer
// ─────────────────────────────────────────────
const canvas = document.getElementById('bg');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xf3f1fd, 1);

// ─────────────────────────────────────────────
//  Scene & Camera — camera is FIXED, never moved
// ─────────────────────────────────────────────
const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0xf3f1fd, 0.017);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 0, 11); // stays here forever

// ─────────────────────────────────────────────
//  sceneGroup — everything lives here.
//  We rotate/translate the GROUP, not the camera.
//  This eliminates all OrbitControls conflicts.
// ─────────────────────────────────────────────
const sceneGroup = new THREE.Group();
scene.add(sceneGroup);

// ─────────────────────────────────────────────
//  Lights (added to scene, not sceneGroup)
// ─────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 3.5));
scene.add(new THREE.HemisphereLight(0xb8a0ff, 0xe0d8ff, 2.5));

const pointLightDefs = [
  { color: 0x7733ee, intensity: 120, speed: 0.45 },
  { color: 0x1199cc, intensity: 90,  speed: 0.35 },
  { color: 0xdd2299, intensity: 70,  speed: 0.25 },
];
const pointLights = pointLightDefs.map(({ color, intensity, speed }) => {
  const light = new THREE.PointLight(color, intensity, 50);
  scene.add(light);
  return { light, speed };
});

// ─────────────────────────────────────────────
//  ① TRON GRID FLOOR
// ─────────────────────────────────────────────
function buildGrid(size, divisions, color, opacity) {
  const step = size / divisions, half = size / 2;
  const verts = [];
  for (let i = 0; i <= divisions; i++) {
    const x = -half + i * step;
    verts.push(x, 0, -half,  x, 0,  half);
    verts.push(-half, 0, x,  half, 0,  x);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

const gridGroup = new THREE.Group();
const gridMesh  = buildGrid(60, 40, 0x8855cc, 0.12);
gridMesh.position.y = -5;
gridGroup.add(gridMesh);

const horizGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-30, 0, 0), new THREE.Vector3(30, 0, 0),
]);
const horizLine = new THREE.Line(horizGeo,
  new THREE.LineBasicMaterial({ color: 0x7733ee, transparent: true, opacity: 0.45 })
);
horizLine.position.y = -5;
gridGroup.add(horizLine);
sceneGroup.add(gridGroup);

// ─────────────────────────────────────────────
//  ② PARTICLE NETWORK
// ─────────────────────────────────────────────
const NODE_COUNT  = 80;
const CONNECT_DIST = 6.5;
const MAX_EDGES   = 200;
const nodePos = [], nodeVel = [];

for (let i = 0; i < NODE_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 6 + Math.random() * 12;
  nodePos.push(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta)*0.6, r*Math.cos(phi));
  nodeVel.push((Math.random()-0.5)*0.004, (Math.random()-0.5)*0.003, (Math.random()-0.5)*0.004);
}

const nodeGeo = new THREE.BufferGeometry();
nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute([...nodePos], 3));
sceneGroup.add(new THREE.Points(nodeGeo,
  new THREE.PointsMaterial({ color: 0x8844dd, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.65 })
));

const edgeArr = new Float32Array(MAX_EDGES * 6);
const edgeGeo = new THREE.BufferGeometry();
edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeArr, 3));
const edgeLines = new THREE.LineSegments(edgeGeo,
  new THREE.LineBasicMaterial({ color: 0x9966cc, transparent: true, opacity: 0.18 })
);
sceneGroup.add(edgeLines);

function updateNetwork() {
  for (let i = 0; i < NODE_COUNT; i++) {
    nodePos[i*3]   += nodeVel[i*3];
    nodePos[i*3+1] += nodeVel[i*3+1];
    nodePos[i*3+2] += nodeVel[i*3+2];
    for (let c = 0; c < 3; c++) {
      const idx = i*3+c, lim = c===1 ? 6 : 14;
      if (Math.abs(nodePos[idx]) > lim) nodeVel[idx] *= -1;
    }
  }
  nodeGeo.attributes.position.array.set(nodePos);
  nodeGeo.attributes.position.needsUpdate = true;

  let ei = 0;
  for (let i = 0; i < NODE_COUNT && ei < MAX_EDGES; i++) {
    for (let j = i+1; j < NODE_COUNT && ei < MAX_EDGES; j++) {
      const dx=nodePos[i*3]-nodePos[j*3], dy=nodePos[i*3+1]-nodePos[j*3+1], dz=nodePos[i*3+2]-nodePos[j*3+2];
      if (dx*dx+dy*dy+dz*dz < CONNECT_DIST*CONNECT_DIST) {
        edgeArr.set([nodePos[i*3],nodePos[i*3+1],nodePos[i*3+2]], ei*6);
        edgeArr.set([nodePos[j*3],nodePos[j*3+1],nodePos[j*3+2]], ei*6+3);
        ei++;
      }
    }
  }
  edgeGeo.setDrawRange(0, ei*2);
  edgeGeo.attributes.position.needsUpdate = true;
}

// ─────────────────────────────────────────────
//  ③ CORE ICOSAHEDRON
// ─────────────────────────────────────────────
const icoGeo  = new THREE.IcosahedronGeometry(2.2, 1);
const icoMat  = new THREE.MeshPhongMaterial({
  color: 0x6622cc, emissive: 0x2200aa, emissiveIntensity: 0.25,
  shininess: 100, specular: 0xaa88ff, transparent: true, opacity: 0.78,
});
const icoMesh = new THREE.Mesh(icoGeo, icoMat);
sceneGroup.add(icoMesh);

const wireMesh = new THREE.Mesh(icoGeo,
  new THREE.MeshBasicMaterial({ color: 0x8844ff, wireframe: true, transparent: true, opacity: 0.25 })
);
sceneGroup.add(wireMesh);

const coreMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.0, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x9966ff, transparent: true, opacity: 0.5 })
);
sceneGroup.add(coreMesh);

// ─────────────────────────────────────────────
//  ④ ORBITING RINGS
// ─────────────────────────────────────────────
const rings = [
  { r:3.2,  tube:0.03,  col:0x2299dd, op:0.45, rx:Math.PI/2.3, ry:0,         dir: 1 },
  { r:3.75, tube:0.025, col:0x8833cc, op:0.35, rx:Math.PI/3.8, ry:Math.PI/5, dir:-1 },
  { r:4.3,  tube:0.018, col:0xcc2299, op:0.25, rx:Math.PI/5,   ry:Math.PI/3, dir: 1 },
].map(({ r, tube, col, op, rx, ry, dir }) => {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, tube, 8, 140),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op })
  );
  m.rotation.set(rx, ry, 0);
  m.userData.dir = dir;
  sceneGroup.add(m);
  return m;
});

// ─────────────────────────────────────────────
//  ⑤ FLOATING ACCENT GEOMETRIES
// ─────────────────────────────────────────────
const accentGeos = [
  new THREE.TorusKnotGeometry(0.4, 0.12, 80, 12),
  new THREE.OctahedronGeometry(0.4),
  new THREE.TetrahedronGeometry(0.45),
  new THREE.DodecahedronGeometry(0.38),
  new THREE.TorusKnotGeometry(0.35, 0.1, 60, 10, 2, 3),
  new THREE.IcosahedronGeometry(0.42, 0),
  new THREE.OctahedronGeometry(0.35),
  new THREE.TetrahedronGeometry(0.38),
];
const accentMeshes = accentGeos.map((geo, i) => {
  const hue = 0.65 + i * 0.045;
  const mat = new THREE.MeshPhongMaterial({
    color:    new THREE.Color().setHSL(hue, 0.85, 0.5),
    emissive: new THREE.Color().setHSL(hue, 0.9, 0.18),
    shininess: 80,
    wireframe: i % 3 === 0,
    transparent: true,
    opacity: i % 3 === 0 ? 0.45 : 0.75,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const angle = (i / accentGeos.length) * Math.PI * 2;
  const rad   = 7 + (i % 3) * 1.5;
  const y     = -3 + (i % 4) * 2;
  mesh.position.set(Math.cos(angle)*rad, y, Math.sin(angle)*rad - 2);
  mesh.userData = { angle, radius: rad, yBase: y, speed: 0.12 + i*0.04, phase: i };
  sceneGroup.add(mesh);
  return mesh;
});

// ─────────────────────────────────────────────
//  ⑥ STAR FIELD
// ─────────────────────────────────────────────
function makeStars(count, spread, color, size, opacity) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count*3; i++) pos[i] = (Math.random()-0.5)*spread;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity }));
}
sceneGroup.add(makeStars(700,  60, 0x7733bb, 0.07, 0.35));
sceneGroup.add(makeStars(1800,150, 0x5522aa, 0.04, 0.22));

// ─────────────────────────────────────────────
//  ⑦ SKILL NODES
// ─────────────────────────────────────────────
const skillNodes = ['Swift','ML','iOS','AI','React','XR'].map((_, i) => {
  const hue  = 0.65 + i * 0.055;
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.14 + Math.random()*0.06),
    new THREE.MeshPhongMaterial({ color: new THREE.Color().setHSL(hue,0.9,0.5), emissive: new THREE.Color().setHSL(hue,0.9,0.2), shininess: 70 })
  );
  const angle = (i/6)*Math.PI*2, radius = 5 + Math.random()*1.5;
  mesh.position.set(Math.cos(angle)*radius, (Math.random()-0.5)*4, Math.sin(angle)*radius);
  mesh.userData = { angle, radius, speed: 0.2+Math.random()*0.35, yBase: mesh.position.y };
  sceneGroup.add(mesh);
  return mesh;
});

// ─────────────────────────────────────────────
//  SCROLL STATE
// ─────────────────────────────────────────────
let scrollProgress = 0;
window.addEventListener('scroll', () => {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const raw = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  // Clamp — overscroll/rubber-band bounce (trackpads, iOS Safari) can push
  // window.scrollY negative or above maxScroll, which would otherwise
  // propagate NaN into the animation state below and never recover.
  scrollProgress = Math.min(1, Math.max(0, raw));
});

// ─────────────────────────────────────────────
//  MOUSE PARALLAX (smooth lerp)
// ─────────────────────────────────────────────
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ─────────────────────────────────────────────
//  NAV OBSERVER
// ─────────────────────────────────────────────
const navLinks = document.querySelectorAll('.nav-link');
const nav      = document.getElementById('nav');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      navLinks.forEach((l) => l.classList.remove('active'));
      document.querySelector(`.nav-link[data-section="${e.target.id}"]`)?.classList.add('active');
    }
  });
}, { threshold: 0.4 });
document.querySelectorAll('.section').forEach((s) => observer.observe(s));
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20));

// ─────────────────────────────────────────────
//  RESIZE
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ─────────────────────────────────────────────
//  ANIMATION LOOP
// ─────────────────────────────────────────────
const clock = new THREE.Clock();

// sceneGroup Y offset per scroll section (camera stays at 0,0,11 always)
const GROUP_Y = [0, 0.5, 1.0, 1.5, 1.0, 0.5];
let groupYCurrent = 0;

function animate() {
  requestAnimationFrame(animate);
  const t  = clock.getElapsedTime();
  const sp = scrollProgress;

  // Mouse lerp
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;

  // ── sceneGroup slow auto-rotation + mouse tilt ──
  sceneGroup.rotation.y = t * 0.045 + mouse.x * 0.08;
  sceneGroup.rotation.x = mouse.y * 0.06;

  // ── sceneGroup Y scroll — shift group up as user scrolls down ──
  const sIdx  = Math.min(Math.max(Math.floor(sp * 6), 0), 5);
  const sNext = Math.min(sIdx + 1, 5);
  const sFrac = (sp * 6) - sIdx;
  const targetGroupY = GROUP_Y[sIdx] + (GROUP_Y[sNext] - GROUP_Y[sIdx]) * sFrac;
  groupYCurrent += (targetGroupY - groupYCurrent) * 0.05;
  sceneGroup.position.y = -groupYCurrent * 2;

  // ── Icosahedron spin + scroll-scale ──
  const icoScale = Math.max(0.0, 1.0 - sp * 2.8);
  icoMesh.rotation.x += 0.006;
  icoMesh.rotation.y += 0.010;
  icoMesh.scale.setScalar(icoScale);
  wireMesh.rotation.x = icoMesh.rotation.x + 0.003;
  wireMesh.rotation.y = icoMesh.rotation.y + 0.003;
  wireMesh.scale.setScalar(icoScale * 1.012);
  coreMesh.scale.setScalar(icoScale * (1 + Math.sin(t*2.2)*0.08));
  icoMat.emissiveIntensity = 0.2 + Math.sin(t*1.8)*0.1;

  // ── Rings ──
  rings.forEach((r, i) => { r.rotation.z += 0.002 * r.userData.dir * (1 + i*0.3); });

  // ── Skill nodes ──
  skillNodes.forEach((node) => {
    const { radius, speed, yBase } = node.userData;
    node.userData.angle += speed * 0.007;
    const a = node.userData.angle;
    node.position.set(Math.cos(a)*radius, yBase + Math.sin(t*speed+a)*0.45, Math.sin(a)*radius);
    node.rotation.x = t * speed * 0.8;
    node.rotation.y = t * speed;
  });

  // ── Accent geometries ──
  accentMeshes.forEach((mesh, i) => {
    const { radius, speed, yBase, phase } = mesh.userData;
    mesh.userData.angle += speed * 0.003;
    const a = mesh.userData.angle;
    mesh.position.set(Math.cos(a)*radius, yBase + Math.sin(t*0.3+phase)*0.6, Math.sin(a)*radius - 2);
    mesh.rotation.x += 0.005 + speed * 0.01;
    mesh.rotation.y += 0.007 + speed * 0.008;
    const sectionTarget = (i % 5) * 0.2;
    const alpha = Math.max(0.1, 1.0 - Math.abs(sp - sectionTarget) * 3.0);
    mesh.material.opacity = mesh.material.wireframe ? alpha * 0.45 : alpha * 0.78;
  });

  // ── Particle network ──
  updateNetwork();

  // ── Grid ──
  gridGroup.position.z = (t * 0.5) % (60 / 40);
  gridMesh.material.opacity = 0.08 + Math.sin(t*0.3)*0.03;

  // ── Point lights (orbit in world space, independent of sceneGroup) ──
  pointLights.forEach(({ light, speed }, i) => {
    const off = (i / pointLights.length) * Math.PI * 2;
    const r   = 5.5 + Math.sin(t*0.3+off)*1.5;
    light.position.set(Math.sin(t*speed+off)*r, Math.sin(t*speed*0.7+off+1.2)*3.5, Math.cos(t*speed+off)*r);
  });

  renderer.render(scene, camera);
}

animate();