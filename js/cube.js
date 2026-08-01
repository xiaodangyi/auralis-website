import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import { buildFaceTextures } from "./atlas.js";

const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1)
];

const ZERO = new THREE.Vector3();

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function faceCell(x, y, z, face) {
  switch (face) {
    case 0:
      return { row: 2 - (y + 1), col: z + 1 };
    case 1:
      return { row: 2 - (y + 1), col: 2 - (z + 1) };
    case 2:
      return { row: 2 - (z + 1), col: x + 1 };
    case 3:
      return { row: z + 1, col: x + 1 };
    case 4:
      return { row: 2 - (y + 1), col: x + 1 };
    case 5:
      return { row: 2 - (y + 1), col: 2 - (x + 1) };
    default:
      return { row: 0, col: 0 };
  }
}

export class CubeExperience {
  constructor(stage, modules, options = {}) {
    this.stage = stage;
    this.modules = modules;
    this.onSelect = options.onSelect || null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.active = true;
    this.autoSpin = true;
    this.selectedFace = null;
    this.selecting = false;
    this.selectProgress = 0;
    this.selectDuration = 0.72;
    this.spinAngle = Math.PI / 4;
    this.pointer = { x: 0, y: 0 };
    this.lastPointer = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragDistance = 0;
    this.suppressClick = false;
    this.tiltAngle = -0.12;
    this.parallaxX = 0;
    this.parallaxY = 0;
    this.blocks = [];
    this.faceMaterialSets = Array.from({ length: 6 }, () => []);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    try {
      this.init();
    } catch (error) {
      console.warn("WebGL unavailable, using 2D fallback.", error);
      this.createFallback();
    }
  }

  init() {
    this.renderer = this.createRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    });
    this.renderer.setClearColor(0x101418, 1);
    const isMobile = window.innerWidth < 820;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.stage.appendChild(this.renderer.domElement);
    this.stage.dataset.mode = "webgl";

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.55, 6.4);
    this.camera.lookAt(0, 0, 0);

    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    } catch (error) {
      console.warn("Environment map skipped.", error);
    }

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff7ea, 2.4);
    key.position.set(5, 7, 5);
    this.scene.add(key);

    const rim = new THREE.PointLight(0x9adcf0, 18, 30);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.buildCube();
    this.fitCameraToCube();
    this.baseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, this.spinAngle, 0));
    this.defaultQuat = this.baseQuat.clone();
    this.cubeGroup.quaternion.copy(this.baseQuat);

    this.bindEvents();
    this.resize();
    this.tick = this.tick.bind(this);
    this.clock.getDelta();
    requestAnimationFrame(this.tick);
  }

  fitCameraToCube() {
    const box = new THREE.Box3().setFromObject(this.cubeGroup);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const margin = 0.42;
    const distance = ((sphere.radius + margin) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.06;
    this.camera.position.set(0, 0.55, distance);
    this.camera.lookAt(0, 0, 0);
  }
  buildCube() {
    const textures = buildFaceTextures(this.modules);
    const base = new THREE.MeshStandardMaterial({
      color: 0xf2eee5,
      roughness: 0.42,
      metalness: 0.04
    });
    const inner = new THREE.MeshStandardMaterial({
      color: 0xeae5db,
      roughness: 0.52,
      metalness: 0.03
    });
    const gap = 1.12;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.07);
          const materials = Array.from({ length: 6 }, () => inner.clone());
          const outward = [false, false, false, false, false, false];

          const setFace = (face) => {
            const cell = faceCell(x, y, z, face);
            const texture = textures[face].clone();
            texture.repeat.set(1 / 3, 1 / 3);
            texture.offset.set(cell.col / 3, cell.row / 3);
            texture.needsUpdate = true;
            const material = base.clone();
            material.map = texture;
            materials[face] = material;
            outward[face] = true;
            this.faceMaterialSets[face].push(material);
          };

          if (x === 1) setFace(0);
          if (x === -1) setFace(1);
          if (y === 1) setFace(2);
          if (y === -1) setFace(3);
          if (z === 1) setFace(4);
          if (z === -1) setFace(5);

          const mesh = new THREE.Mesh(geometry, materials);
          mesh.position.set(x * gap, y * gap, z * gap);
          mesh.userData = {
            grid: [x, y, z],
            outward,
            materials,
            basePos: mesh.position.clone(),
            shift: new THREE.Vector3()
          };
          this.cubeGroup.add(mesh);
          this.blocks.push(mesh);
        }
      }
    }
  }

  createRenderer(options) {
    const originalError = console.error;
    console.error = () => {};
    try {
      return new THREE.WebGLRenderer(options);
    } finally {
      console.error = originalError;
    }
  }

  bindEvents() {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onResize = this.onResize.bind(this);
    this.stage.addEventListener("pointerdown", this.onPointerDown);
    this.stage.addEventListener("pointermove", this.onPointerMove);
    this.stage.addEventListener("pointerup", this.onPointerUp);
    this.stage.addEventListener("pointercancel", this.onPointerUp);
    this.stage.addEventListener("click", this.onClick);
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.stage);
  }

  onPointerDown(event) {
    this.isDragging = true;
    this.dragDistance = 0;
    this.suppressClick = false;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragLast = { x: event.clientX, y: event.clientY };
    this.stage.classList.add("is-dragging");
    if (this.stage.setPointerCapture) {
      try { this.stage.setPointerCapture(event.pointerId); } catch (error) {}
    }
    this.autoSpin = false;
    if (this.selectedFace !== null) {
      this.selectedFace = null;
      this.applySelectionVisuals(null);
    }
  }

  onPointerUp() {
    this.isDragging = false;
    this.stage.classList.remove("is-dragging");
    if (this.dragDistance >= 6) {
      this.suppressClick = true;
      this.autoSpin = true;
    }
  }
  onPointerMove(event) {
    if (this.isDragging) {
      const dx = event.clientX - this.dragLast.x;
      const dy = event.clientY - this.dragLast.y;
      this.dragLast.x = event.clientX;
      this.dragLast.y = event.clientY;
      this.dragDistance += Math.hypot(dx, dy);
      this.spinAngle += dx * 0.006;
      this.tiltAngle = Math.max(-0.7, Math.min(0.6, this.tiltAngle + dy * 0.004));
      this.baseQuat.setFromEuler(new THREE.Euler(this.tiltAngle, this.spinAngle, 0));
      return;
    }
    const rect = this.stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.x = x;
    this.pointer.y = y;

    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    const speed = Math.hypot(dx, dy);
    this.lastPointer.x = event.clientX;
    this.lastPointer.y = event.clientY;

    if (speed > 16 && !this.reducedMotion) {
      const count = 2 + Math.min(4, Math.floor(speed / 34));
      for (let i = 0; i < count; i += 1) {
        const block = this.blocks[Math.floor(Math.random() * this.blocks.length)];
        block.userData.shift.set(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05
        );
      }
    }
  }

  onClick(event) {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const rect = this.stage.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.blocks, false);
    if (hits.length === 0) {
      this.deselect();
      return;
    }
    const faceIndex = hits[0].face.materialIndex;
    if (faceIndex >= 0 && faceIndex < 6) {
      this.selectFace(faceIndex);
    }
  }

  selectFace(faceIndex) {
    this.selectedFace = faceIndex;
    this.autoSpin = false;
    const normal = FACE_NORMALS[faceIndex];
    const align = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1);
    const target = tilt.clone().multiply(align);
    this.animateTo(target, this.reducedMotion ? 0.01 : 0.78);
    this.applySelectionVisuals(faceIndex);
    if (this.onSelect) this.onSelect(faceIndex);
  }

  deselect() {
    if (this.selectedFace === null) return;
    this.selectedFace = null;
    this.applySelectionVisuals(null);
    this.animateTo(this.defaultQuat.clone(), this.reducedMotion ? 0.01 : 0.7);
    this.autoSpin = true;
  }

  animateTo(target, duration) {
    this.fromQuat = this.cubeGroup.quaternion.clone();
    this.toQuat = target;
    this.selectProgress = 0;
    this.selectDuration = duration;
    this.selecting = true;
  }

  applySelectionVisuals(selectedFace) {
    for (let face = 0; face < 6; face += 1) {
      const isSelected = face === selectedFace;
      for (const material of this.faceMaterialSets[face]) {
        material.emissive.setHex(isSelected ? 0x0e7c7b : 0x000000);
        material.emissiveIntensity = isSelected ? 0.24 : 0;
        material.color.setHex(isSelected ? 0xfbf8f1 : 0xcbc5ba);
      }
    }
  }

  tick() {
    requestAnimationFrame(this.tick);
    if (!this.active || !this.renderer) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.selecting) {
      this.selectProgress = Math.min(1, this.selectProgress + dt / this.selectDuration);
      const k = easeInOutCubic(this.selectProgress);
      this.baseQuat.slerpQuaternions(this.fromQuat, this.toQuat, k);
      if (this.selectProgress >= 1) this.selecting = false;
    } else if (this.autoSpin && !this.reducedMotion) {
      this.spinAngle += dt * 0.21;
      this.baseQuat.setFromEuler(new THREE.Euler(-0.12, this.spinAngle, 0));
    }

    if (!this.reducedMotion) {
      this.cubeGroup.position.y = -0.15 + Math.sin(elapsed * 0.9) * 0.12;
      const breathe = 1 + Math.sin(elapsed * 0.45) * 0.012;
      this.cubeGroup.scale.setScalar(breathe);
    } else {
      this.cubeGroup.position.y = -0.15;
      this.cubeGroup.scale.setScalar(1);
    }

    const smooth = Math.min(1, dt * 4);
    this.parallaxX += ((this.isDragging ? 0 : this.pointer.x * 0.1) - this.parallaxX) * smooth;
    this.parallaxY += ((this.isDragging ? 0 : this.pointer.y * 0.055) - this.parallaxY) * smooth;
    const parallaxQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.parallaxY, this.parallaxX, 0)
    );
    this.cubeGroup.quaternion.copy(parallaxQuat).multiply(this.baseQuat);

    for (const block of this.blocks) {
      const shift = block.userData.shift;
      shift.multiplyScalar(Math.max(0, 1 - dt * 7));
      block.position.copy(block.userData.basePos).add(shift);
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    this.onResize();
  }

  setActive(value) {
    this.active = value;
  }

  createFallback() {
    this.stage.classList.add("fallback");
    const canvas = document.createElement("canvas");
    canvas.className = "fallback-cube";
    this.stage.appendChild(canvas);
    this.stage.dataset.mode = "fallback";
    const draw = () => drawFallbackCube(canvas);
    draw();
    window.addEventListener("resize", draw);
  }
}

function supportsWebGL() {
  const canvas = document.createElement("canvas");
  return !!(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
}

function drawFallbackCube(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dpr = window.devicePixelRatio || 1;
  const s = Math.min(canvas.width, canvas.height) / 4.6;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const dx = s * Math.cos(Math.PI / 6);
  const dy = s * Math.sin(Math.PI / 6);

  const top = (px, py, size) => {
    ctx.fillStyle = "#f2eee5";
    ctx.beginPath();
    ctx.moveTo(px, py - size);
    ctx.lineTo(px + size * 1.1, py - size * 0.6);
    ctx.lineTo(px, py);
    ctx.lineTo(px - size * 1.1, py - size * 0.6);
    ctx.closePath();
    ctx.fill();
  };

  const left = (px, py, size) => {
    ctx.fillStyle = "#d8d1c4";
    ctx.beginPath();
    ctx.moveTo(px - size * 1.1, py - size * 0.6);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + size * 0.75);
    ctx.lineTo(px - size * 1.1, py + size * 0.15);
    ctx.closePath();
    ctx.fill();
  };

  const right = (px, py, size) => {
    ctx.fillStyle = "#c4bcae";
    ctx.beginPath();
    ctx.moveTo(px + size * 1.1, py - size * 0.6);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + size * 0.75);
    ctx.lineTo(px + size * 1.1, py + size * 0.15);
    ctx.closePath();
    ctx.fill();
  };

  const step = s * 0.72;
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const px = cx + (x - z) * step * 0.68;
        const py = cy + (x + z) * step * 0.34 - y * step;
        top(px, py, s * 0.36);
        left(px, py, s * 0.36);
        right(px, py, s * 0.36);
      }
    }
  }
}
