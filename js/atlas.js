import * as THREE from "three";

const SIZE = 1024;
const CELL = 3;
const CELL_SIZE = SIZE / CELL;
const ICON_RATIO = 0.42;

function drawCellBackground(ctx, row, col, isCenter, isAccent) {
  const x = col * CELL_SIZE;
  const y = row * CELL_SIZE;
  const inset = 14;
  const radius = 28;
  const cx = x + CELL_SIZE / 2;
  const cy = y + CELL_SIZE / 2;

  ctx.save();
  ctx.lineWidth = isCenter ? 5 : 2;
  ctx.strokeStyle = isAccent
    ? "rgba(14, 124, 123, 0.72)"
    : "rgba(35, 41, 47, 0.22)";
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, CELL_SIZE - inset * 2, CELL_SIZE - inset * 2, radius);
  ctx.stroke();

  if (isCenter) {
    ctx.strokeStyle = "rgba(14, 124, 123, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 28, y + 28, CELL_SIZE - 56, CELL_SIZE - 56, 22);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(33, 39, 45, 0.55)";
  const screw = 7;
  [
    [x + 34, y + 34],
    [x + CELL_SIZE - 34, y + 34],
    [x + 34, y + CELL_SIZE - 34],
    [x + CELL_SIZE - 34, y + CELL_SIZE - 34]
  ].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, screw, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(242, 238, 229, 0.8)";
    ctx.beginPath();
    ctx.arc(sx - 1.5, sy - 1.5, screw * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(33, 39, 45, 0.55)";
  });
  ctx.restore();
}

function prepareIcon(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(30, 35, 40, 0.86)";
  ctx.fillStyle = "rgba(30, 35, 40, 0.86)";
  ctx.lineWidth = 10;
}

function drawDna(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const half = s * 0.72;
  const amp = s * 0.24;
  for (let phase = 0; phase < 2; phase += 1) {
    ctx.beginPath();
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const x = -half + t * half * 2;
      const y = Math.sin(t * Math.PI * 2 + phase * Math.PI) * amp;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let rung = 1; rung < 6; rung += 1) {
    const t = rung / 6;
    const x = -half + t * half * 2;
    const y1 = Math.sin(t * Math.PI * 2) * amp;
    const y2 = Math.sin(t * Math.PI * 2 + Math.PI) * amp;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAtom(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const r = s * 0.52;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.38, (i * Math.PI) / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlask(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.5;
  const topY = -s * 0.56;
  const bottomY = s * 0.58;
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, topY);
  ctx.lineTo(-w * 0.22, -s * 0.12);
  ctx.lineTo(-w, bottomY);
  ctx.lineTo(w, bottomY);
  ctx.lineTo(w * 0.22, -s * 0.12);
  ctx.lineTo(w * 0.22, topY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w * 0.62, bottomY - s * 0.26);
  ctx.lineTo(w * 0.62, bottomY - s * 0.26);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, bottomY, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPill(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.56;
  const h = s * 0.34;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.28);
  ctx.lineTo(0, h * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChart(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.68;
  const h = s * 0.56;
  const left = -w / 2;
  const bottom = h / 2;
  const bars = [0.5, 0.78, 1];
  ctx.beginPath();
  bars.forEach((heightRatio, i) => {
    const bx = left + (i + 0.5) * (w / 3);
    const bh = h * heightRatio * 0.9;
    ctx.moveTo(bx, bottom);
    ctx.lineTo(bx, bottom - bh);
  });
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left - s * 0.05, bottom);
  ctx.lineTo(left + w * 0.42, bottom - h * 0.56);
  ctx.lineTo(left + w * 0.78, bottom - h * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawShield(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.54;
  const h = s * 0.68;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + h * 0.16);
  ctx.lineTo(w / 2, h * 0.08);
  ctx.quadraticCurveTo(w / 2, h * 0.44, 0, h / 2);
  ctx.quadraticCurveTo(-w / 2, h * 0.44, -w / 2, h * 0.08);
  ctx.lineTo(-w / 2, -h / 2 + h * 0.16);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w * 0.26, 0);
  ctx.lineTo(-w * 0.06, h * 0.18);
  ctx.lineTo(w * 0.3, -h * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawActivity(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.8;
  const h = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.16);
  ctx.lineTo(-w * 0.18, h * 0.16);
  ctx.lineTo(-w * 0.02, -h * 0.3);
  ctx.lineTo(w * 0.14, h * 0.22);
  ctx.lineTo(w * 0.3, -h * 0.08);
  ctx.lineTo(w / 2, -h * 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawMicroscope(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.5;
  const h = s * 0.72;
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, h * 0.44);
  ctx.lineTo(w * 0.7, h * 0.44);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, h * 0.44);
  ctx.lineTo(-w * 0.22, -h * 0.16);
  ctx.lineTo(w * 0.18, -h * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.18, -h * 0.16);
  ctx.lineTo(w * 0.18, -h * 0.42);
  ctx.lineTo(w * 0.42, -h * 0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-w * 0.08, -h * 0.34, w * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCross(ctx, cx, cy, s) {
  prepareIcon(ctx, cx, cy);
  const w = s * 0.62;
  const h = s * 0.34;
  const arm = s * 0.2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-arm / 2, -w / 2, arm, w, arm * 0.3);
  ctx.stroke();
  ctx.restore();
}

const DRAWERS = {
  dna: drawDna,
  atom: drawAtom,
  "flask-conical": drawFlask,
  pill: drawPill,
  "bar-chart-3": drawChart,
  "shield-check": drawShield,
  activity: drawActivity,
  microscope: drawMicroscope,
  cross: drawCross
};

function drawCeramicBase(ctx) {
  const gradient = ctx.createRadialGradient(
    SIZE * 0.5,
    SIZE * 0.46,
    SIZE * 0.08,
    SIZE * 0.5,
    SIZE * 0.5,
    SIZE * 0.72
  );
  gradient.addColorStop(0, "#fbf8f1");
  gradient.addColorStop(0.62, "#f1ece2");
  gradient.addColorStop(1, "#ded7c9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.save();
  for (let i = 0; i < 2200; i += 1) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const a = Math.random() * 0.035;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.45)" : "rgba(35,41,47,0.3)";
    ctx.globalAlpha = a;
    ctx.fillRect(x, y, 2.2, 2.2);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(80, 72, 60, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= CELL; i += 1) {
    const p = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(SIZE, p);
    ctx.stroke();
  }
  ctx.restore();
}

export function buildFaceTextures(modules) {
  return modules.map((module) => {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    drawCeramicBase(ctx);

    module.layout.forEach((iconName, index) => {
      const row = Math.floor(index / CELL);
      const col = index % CELL;
      const isCenter = index === 4;
      const isAccent = iconName === module.faceIcon;
      drawCellBackground(ctx, row, col, isCenter, isAccent);
      const drawer = DRAWERS[iconName];
      if (drawer) {
        drawer(
          ctx,
          col * CELL_SIZE + CELL_SIZE / 2,
          row * CELL_SIZE + CELL_SIZE / 2,
          CELL_SIZE * ICON_RATIO
        );
      }
    });

    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  });
}
