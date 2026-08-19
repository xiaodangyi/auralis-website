import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import buildVoxelMap from "./map.js";
import { MultiplayerClient } from "./multiplayer.js";
import {
  CATEGORY_DEFINITIONS,
  CATEGORIES,
  DEFAULT_LOADOUT,
  EQUIPMENT,
  GRENADE_LIST,
  SHOP_ITEMS,
  WEAPONS,
  calculateShotDamage,
  canPurchase,
  createWeaponState,
  getItemsByCategory,
  getShopItem,
  getWeapon,
} from "./weapons.js";
import {
  FRAME_DEFINITIONS,
  FRAME_LIST,
  DEFAULT_FRAME,
  getFrame,
  weaponCompatible,
  weaponLevel,
  addWeaponXp,
  abilityReady,
} from "./classes.js";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="game-shell">
    <div class="viewport" id="viewport"></div>
    <div class="damage-vignette" id="damage-vignette"></div>
    <div class="flash-overlay" id="flash-overlay"></div>

    <section class="hud" aria-label="游戏界面">
      <div class="topbar">
        <div class="brand-lockup">
          <span class="brand-mark">方</span>
          <div>
            <div class="brand-name">方块前线</div>
          <div class="brand-subtitle">工业小镇 · 持续团队歼灭</div>
          </div>
        </div>
        <div class="round-board">
          <div class="round-team attack"><strong id="attack-score">0</strong><span>橙队 / 100</span></div>
          <div class="round-clock"><strong id="round-clock">--:--</strong><span id="phase-label">团队击杀</span></div>
          <div class="round-team defend"><strong id="defend-score">0</strong><span>蓝队 / 100</span></div>
        </div>
      </div>

      <div class="objective-banner" id="objective-banner"><strong>团队击杀</strong> · 先到 100 分获胜</div>
      <div class="killfeed" id="killfeed"></div>
      <div class="crosshair" id="crosshair"></div>
      <div class="toast-stack" id="toast-stack"></div>

      <div class="bottom-left">
        <div class="vitals">
          <div class="vital-row"><span>生命</span><div class="meter"><span id="health-meter"></span></div><strong id="health-value">100</strong></div>
          <div class="vital-row"><span>护甲</span><div class="meter armor"><span id="armor-meter"></span></div><strong id="armor-value">0</strong></div>
        </div>
        <div class="money-tag" id="money-value">战备等级 1</div>
        <div class="ability-tag" id="ability-value">Q · 冲锋脉冲</div>
      </div>

      <div class="interaction-prompt" id="interaction-prompt"></div>
      <div class="action-progress" id="action-progress"><span></span></div>

      <div class="weapon-panel">
        <div class="weapon-name" id="weapon-name">P9</div>
        <div class="weapon-meta" id="weapon-meta">半自动手枪</div>
        <div class="ammo" id="ammo-value">15 <span>/ 60</span></div>
        <div class="weapon-hint" id="weapon-hint">1 主武器 · 2 副武器 · 4 投掷物</div>
      </div>
      <div class="hint-strip">WASD 移动 · 鼠标射击 · R 换弹 · Q 战术能力 · B 战备库 · TAB 计分板</div>

      <section class="screen-overlay" id="deploy-overlay">
        <div class="overlay-panel">
          <div class="overlay-kicker">VOXEL COMBAT NETWORK</div>
          <h1>方块前线</h1>
          <p>选择原创战斗框架与常驻配装，进入持续交火。击杀会为团队累积分数，率先达到 100 分的一方获胜。</p>
          <div class="control-grid">
            <span><kbd>WASD</kbd> 移动</span><span><kbd>鼠标</kbd> 瞄准射击</span>
            <span><kbd>B</kbd> 战备库与职业</span><span><kbd>Q</kbd> 战术能力</span>
          </div>
          <div class="overlay-actions">
            <button class="primary-button" id="deploy-button" type="button">单机训练</button>
            <button class="secondary-button" id="fullscreen-button" type="button">全屏</button>
          </div>
          <div class="online-join">
            <div class="online-fields">
              <label><span>昵称</span><input id="player-name-input" maxlength="18" value="方块战士" autocomplete="nickname"></label>
              <label><span>房间</span><input id="room-input" maxlength="12" value="public" autocomplete="off"></label>
            </div>
            <button class="secondary-button" id="join-room-button" type="button">加入多人房间</button>
            <p id="connection-status">需同时启动房间服务器；同一房间的玩家会加入同一场 100 分比赛。</p>
          </div>
        </div>
      </section>

      <section class="buy-menu" id="buy-menu" hidden aria-label="战备库">
        <header class="menu-head">
          <div><h2>战备库</h2><p id="shop-status">常驻配装 · 选择职业与武器后立即部署</p></div>
          <strong class="menu-money" id="shop-money">框架等级 1</strong>
        </header>
        <div class="shop-layout">
          <nav class="shop-categories" id="shop-categories"></nav>
          <div class="shop-items" id="shop-items"></div>
        </div>
        <footer class="menu-foot"><span>数字键 1–4 选择框架 · 武器经验会保留</span><span>B / Esc 关闭</span></footer>
      </section>

      <section class="scoreboard" id="scoreboard" hidden aria-label="计分板">
        <header class="menu-head"><div><h2>团队击杀计分板</h2><p>目标分数 100 · 当前对局</p></div><strong class="menu-money" id="board-score">0 : 0</strong></header>
        <div class="score-table" id="score-table"></div>
      </section>

      <section class="pause-menu" id="pause-menu" hidden aria-label="暂停菜单">
        <header class="menu-head"><div><h2>演练暂停</h2><p>设置会立即生效</p></div></header>
        <div class="pause-body">
          <label class="setting-row"><span>机器人难度</span><select id="difficulty-select"><option value="easy">简单</option><option value="normal" selected>普通</option><option value="hard">困难</option></select></label>
          <label class="setting-row"><span>鼠标灵敏度</span><span class="setting-control"><input id="sensitivity-input" type="range" min="0.6" max="2.2" step="0.1" value="1"><output id="sensitivity-value" for="sensitivity-input">1.0x</output></span></label>
          <label class="setting-row"><span>主音量</span><input id="volume-input" type="range" min="0" max="1" step="0.05" value="0.55"></label>
          <div class="overlay-actions">
            <button class="primary-button" id="resume-button" type="button">继续</button>
            <button class="secondary-button" id="restart-match-button" type="button">重新开始比赛</button>
            <button class="secondary-button" id="pause-fullscreen-button" type="button">切换全屏</button>
          </div>
        </div>
      </section>

      <section class="screen-overlay" id="round-overlay" hidden>
        <div class="overlay-panel">
          <div class="overlay-kicker" id="round-result-kicker">ROUND COMPLETE</div>
          <h1 id="round-result-title">橙队获胜</h1>
          <p id="round-result-copy">橙队率先达到 100 分。</p>
          <div class="overlay-actions"><button class="primary-button" id="next-round-button" type="button">重新开始比赛</button></div>
        </div>
      </section>
    </section>
  </main>`;

const dom = Object.fromEntries(
  [
    "viewport", "damage-vignette", "flash-overlay", "attack-score", "defend-score", "round-clock",
    "phase-label", "objective-banner", "killfeed", "crosshair", "toast-stack", "health-meter",
    "health-value", "armor-meter", "armor-value", "money-value", "ability-value", "interaction-prompt", "action-progress",
    "weapon-name", "weapon-meta", "ammo-value", "weapon-hint", "deploy-overlay", "deploy-button",
    "fullscreen-button", "player-name-input", "room-input", "join-room-button", "connection-status", "buy-menu", "shop-status", "shop-money", "shop-categories", "shop-items",
    "scoreboard", "round-number", "board-score", "score-table", "pause-menu", "difficulty-select",
    "sensitivity-input", "sensitivity-value", "volume-input", "resume-button", "restart-match-button", "pause-fullscreen-button",
    "round-overlay", "round-result-kicker", "round-result-title", "round-result-copy", "next-round-button",
  ].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.querySelector(`#${id}`)]),
);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const formatTime = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};
const pick = (values) => values[Math.floor(Math.random() * values.length)];
const nowSeconds = () => performance.now() / 1000;
const KILL_TARGET = 100;
const RESPAWN_DELAY = 3;

const DIFFICULTIES = {
  easy: { reaction: 0.72, accuracy: 0.43, damage: 0.72, speed: 3.2 },
  normal: { reaction: 0.43, accuracy: 0.63, damage: 0.9, speed: 3.65 },
  hard: { reaction: 0.24, accuracy: 0.79, damage: 1.04, speed: 4.05 },
};

const BOT_NAMES = {
  attack: ["砖虎机", "铆钉", "折线", "铜芯"],
  defense: ["蓝盾", "方塔", "冷杉", "铁轨", "矩阵"],
};

class VoxelStrikeGame {
  constructor() {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x94b9b3);
    this.scene.fog = new THREE.Fog(0x94b9b3, 24, 76);
    this.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.04, 120);
    this.camera.rotation.order = "YXZ";
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    dom.viewport.append(this.renderer.domElement);

    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.map = buildVoxelMap(this.scene, this.physics);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(0, 0);
    this.keys = new Set();
    this.mouse = {
      firing: false,
      aiming: false,
      hasPointerPosition: false,
      lastClientX: 0,
      lastClientY: 0,
    };
    this.pointerLockUnavailable = false;
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.settings = { sensitivity: 1, volume: 0.55, difficulty: "normal" };
    try {
      const savedSettings = JSON.parse(localStorage.getItem("voxel-strike-settings") ?? "null");
      if (savedSettings) {
        this.settings.sensitivity = clamp(Number(savedSettings.sensitivity), 0.6, 2.2);
        this.settings.volume = clamp(Number(savedSettings.volume), 0, 1);
        this.settings.difficulty = DIFFICULTIES[savedSettings.difficulty] ? savedSettings.difficulty : "normal";
      }
    } catch {
      // Settings remain at their defaults when storage is unavailable.
    }
    this.phase = "intro";
    this.phaseEndsAt = Infinity;
    this.mode = "team-deathmatch";
    this.killTarget = KILL_TARGET;
    this.round = 1;
    this.score = { attack: 0, defense: 0 };
    this.lossStreak = { attack: 0, defense: 0 };
    this.started = false;
    this.paused = true;
    this.shopOpen = false;
    this.scoreboardOpen = false;
    this.shopCategory = "frames";
    this.shopRenderKey = "";
    this.purchaseInProgress = false;
    this.weaponProgress = this.loadWeaponProgress();
    this.activeFrame = DEFAULT_FRAME;
    this.abilityCooldownEndsAt = 0;
    this.abilityActiveUntil = 0;
    this.spawnProtectedUntil = 0;
    this.bots = [];
    this.remotePlayers = new Map();
    this.multiplayer = new MultiplayerClient();
    this.multiplayerMode = false;
    this.lastNetworkStateAt = 0;
    this.effects = [];
    this.pickups = [];
    this.audioContext = null;
    this.lastHudUpdate = 0;
    this.objective = this.newObjective();
    this.player = this.createPlayerState();
    this.playerBody = this.createKinematicBody(this.map.spawns.attack[4]);
    this.weaponRoot = new THREE.Group();
    this.camera.add(this.weaponRoot);
    this.scene.add(this.camera);

    this.setupLighting();
    this.buildSkyDetails();
    this.rebuildWeaponModel();
    this.bindEvents();
    this.syncSettingControls();
    this.renderShopCategories();
    this.resize();
    this.animate();
  }

  newObjective() {
    return {
      state: "carried",
      carrier: "player",
      site: null,
      position: new THREE.Vector3(),
      actionProgress: 0,
      plantedAt: 0,
      detonatesAt: 0,
      defuseActor: null,
    };
  }

  createPlayerState() {
    return {
      id: "player",
      name: "你",
      team: "attack",
      alive: true,
      position: this?.map?.spawns?.attack?.[4]?.clone?.() ?? new THREE.Vector3(-21, 0.05, 0),
      velocityY: 0,
      grounded: true,
      crouched: false,
      health: 100,
      armor: 0,
      helmet: false,
      frameId: DEFAULT_FRAME,
      abilityCooldownEndsAt: 0,
      abilityActiveUntil: 0,
      spawnProtectedUntil: 0,
      money: 3400,
      kills: 0,
      deaths: 0,
      assists: 0,
      loadout: { ...DEFAULT_LOADOUT, grenades: [] },
      weaponStates: { p9: createWeaponState("p9") },
      activeSlot: "secondary",
      reloading: false,
      reloadTimer: null,
      lastShotAt: -Infinity,
      recoil: 0,
      actionStart: 0,
      hasBomb: true,
      respawnAt: 0,
    };
  }

  loadWeaponProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem("voxel-strike-weapon-xp") ?? "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  persistWeaponProgress() {
    try { localStorage.setItem("voxel-strike-weapon-xp", JSON.stringify(this.weaponProgress)); } catch { /* storage is optional */ }
  }

  getWeaponProgress(weaponId) {
    const current = this.weaponProgress[weaponId] ?? { xp: 0, level: 1 };
    return { xp: Number(current.xp) || 0, level: weaponLevel(current) };
  }

  grantWeaponXp(weaponId, amount) {
    if (!weaponId || weaponId === "fieldKnife" || amount <= 0) return;
    this.weaponProgress[weaponId] = addWeaponXp(this.getWeaponProgress(weaponId), amount);
    this.persistWeaponProgress();
  }

  createKinematicBody(position) {
    const body = this.physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, 1.05, position.z),
    );
    const collider = this.physics.createCollider(
      RAPIER.ColliderDesc.capsule(0.72, 0.34).setFriction(0.2),
      body,
    );
    return { body, collider };
  }

  setupLighting() {
    const hemi = new THREE.HemisphereLight(0xd7f1e5, 0x273128, 2.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffefc7, 3.1);
    sun.position.set(-24, 36, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    this.scene.add(sun);
  }

  buildSkyDetails() {
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xe7f1e7, transparent: true, opacity: 0.72 });
    const cloudGeometry = new THREE.BoxGeometry(5, 1.2, 2.2);
    for (const [x, y, z, scale] of [[-22, 18, -28, 1.2], [8, 21, -34, 1.6], [29, 16, -15, 0.9]]) {
      const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
      cloud.position.set(x, y, z);
      cloud.scale.set(scale, 1, scale);
      this.scene.add(cloud);
    }
  }

  bindEvents() {
    addEventListener("resize", () => this.resize());
    document.addEventListener("pointerlockchange", () => this.onPointerLockChange());
    document.addEventListener("pointerlockerror", () => this.enablePointerFallback());
    document.addEventListener("mousemove", (event) => this.onMouseMove(event));
    document.addEventListener("mousedown", (event) => this.onMouseDown(event));
    document.addEventListener("mouseup", (event) => this.onMouseUp(event));
    document.addEventListener("keydown", (event) => this.onKeyDown(event));
    document.addEventListener("keyup", (event) => this.onKeyUp(event));
    document.addEventListener("contextmenu", (event) => event.preventDefault());

    dom.deployButton.addEventListener("click", () => this.deploy());
    dom.joinRoomButton.addEventListener("click", () => this.joinMultiplayer());
    dom.fullscreenButton.addEventListener("click", () => this.toggleFullscreen());
    dom.pauseFullscreenButton.addEventListener("click", () => this.toggleFullscreen());
    dom.resumeButton.addEventListener("click", () => this.resume());
    dom.restartMatchButton.addEventListener("click", () => this.restartMatch());
    dom.nextRoundButton.addEventListener("click", () => this.beginNextRound());
    dom.difficultySelect.addEventListener("change", (event) => { this.settings.difficulty = event.target.value; this.persistSettings(); });
    dom.sensitivityInput.addEventListener("input", (event) => this.setSensitivity(event.target.value));
    dom.volumeInput.addEventListener("input", (event) => { this.settings.volume = clamp(Number(event.target.value), 0, 1); this.persistSettings(); });
    dom.shopCategories.addEventListener("click", (event) => {
      const frameButton = event.target.closest("[data-frame]");
      if (frameButton) {
        this.selectFrame(frameButton.dataset.frame);
        return;
      }
      const button = event.target.closest("[data-category]");
      if (!button) return;
      this.shopCategory = button.dataset.category;
      this.renderShopCategories();
      this.renderShopItems(true);
    });
    dom.shopItems.addEventListener("click", (event) => {
      const frameButton = event.target.closest("[data-frame]");
      if (frameButton) {
        this.selectFrame(frameButton.dataset.frame);
        return;
      }
      const button = event.target.closest("[data-buy]");
      if (button) this.purchase(button.dataset.buy);
    });
    this.multiplayer.on("snapshot", (message) => this.syncMultiplayerSnapshot(message));
    this.multiplayer.on("disconnect", () => this.handleMultiplayerDisconnect());
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.6));
  }

  async deploy() {
    this.multiplayer.disconnect();
    this.multiplayerMode = false;
    this.clearRemotePlayers();
    this.player.team = "attack";
    this.player.id = "player";
    this.player.name = "你";
    if (!this.started) {
      this.started = true;
      this.startMatch();
    }
    dom.deployOverlay.hidden = true;
    this.paused = false;
    this.syncCursorMode();
    await this.requestPointerLock();
  }

  async joinMultiplayer() {
    if (this.multiplayer.connected) return;
    const room = dom.roomInput.value.trim() || "public";
    const name = dom.playerNameInput.value.trim() || "方块战士";
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.hostname || "127.0.0.1"}:4176`;
    dom.joinRoomButton.disabled = true;
    dom.connectionStatus.textContent = "正在连接房间服务器...";
    try {
      const welcome = await this.multiplayer.connect({ url, room, name });
      this.startMultiplayer(welcome, name);
      dom.connectionStatus.textContent = `已加入房间 ${welcome.room} · ${welcome.team === "attack" ? "橙队" : "蓝队"}`;
    } catch (error) {
      dom.connectionStatus.textContent = `${error.message}。请先运行 pnpm run server。`;
    } finally {
      dom.joinRoomButton.disabled = false;
    }
  }

  startMultiplayer(welcome, name) {
    this.clearBots();
    this.clearRemotePlayers();
    this.clearRoundEffects();
    this.multiplayerMode = true;
    this.started = true;
    this.paused = false;
    this.phase = "live";
    this.phaseEndsAt = Infinity;
    this.score = { ...welcome.score };
    this.player.id = welcome.id;
    this.player.name = name;
    this.player.team = welcome.team;
    this.player.frameId = this.activeFrame;
    this.player.alive = true;
    this.player.health = 100;
    this.player.armor = 0;
    this.player.respawnAt = 0;
    const spawn = this.map.spawns[welcome.team][4];
    this.player.position.copy(spawn);
    this.playerBody.body.setNextKinematicTranslation({ x: spawn.x, y: 1.05, z: spawn.z });
    this.yaw = welcome.team === "attack" ? -Math.PI / 2 : Math.PI / 2;
    this.pitch = 0;
    this.weaponRoot.visible = true;
    this.rebuildWeaponModel();
    dom.deployOverlay.hidden = true;
    dom.roundOverlay.hidden = true;
    this.toast(`已加入 ${welcome.room} 房间`);
    this.syncCursorMode();
    this.requestPointerLock();
  }

  createRemotePlayer(state, index) {
    const spawn = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
    const actor = this.createBot(state.team, index % 4, spawn);
    actor.id = state.id;
    actor.name = state.name;
    actor.networkRemote = true;
    actor.weaponId = state.weaponId || "p9";
    actor.group.userData.remotePlayerId = state.id;
    actor.hitMeshes.forEach((mesh) => { mesh.userData.actor = actor; });
    this.remotePlayers.set(state.id, actor);
    return actor;
  }

  syncMultiplayerSnapshot(message) {
    if (!this.multiplayerMode) return;
    this.score = { ...message.score };
    const liveIds = new Set();
    message.players.forEach((state, index) => {
      if (state.id === this.multiplayer.id) {
        const wasAlive = this.player.alive;
        this.player.kills = state.kills;
        this.player.deaths = state.deaths;
        this.player.health = state.health;
        this.player.alive = state.alive;
        this.player.respawnAt = state.respawnAt ? nowSeconds() + Math.max(0, (state.respawnAt - Date.now()) / 1000) : 0;
        if (message.event?.type === "restart") {
          this.player.position.set(state.position.x, state.position.y, state.position.z);
          this.playerBody.body.setNextKinematicTranslation({ x: state.position.x, y: state.position.y + 1, z: state.position.z });
          this.weaponRoot.visible = true;
          dom.roundOverlay.hidden = true;
          this.paused = false;
          this.requestPointerLock();
        }
        if (wasAlive && !state.alive) {
          this.weaponRoot.visible = false;
          this.mouse.firing = false;
          document.exitPointerLock?.();
          this.toast(`你已阵亡 · ${RESPAWN_DELAY} 秒后复活`);
        }
        if (!wasAlive && state.alive) {
          this.player.position.set(state.position.x, state.position.y, state.position.z);
          this.playerBody.body.setNextKinematicTranslation({ x: state.position.x, y: state.position.y + 1, z: state.position.z });
          this.weaponRoot.visible = true;
          this.rebuildWeaponModel();
          this.toast("已复活");
          this.requestPointerLock();
        }
        return;
      }
      liveIds.add(state.id);
      const actor = this.remotePlayers.get(state.id) ?? this.createRemotePlayer(state, index);
      actor.name = state.name;
      actor.team = state.team;
      actor.health = state.health;
      actor.alive = state.alive;
      actor.kills = state.kills;
      actor.deaths = state.deaths;
      actor.weaponId = state.weaponId;
      actor.frameId = state.frameId || actor.frameId || "assault";
      actor.position.set(state.position.x, state.position.y, state.position.z);
      actor.group.position.copy(actor.position);
      actor.group.rotation.y = state.yaw + Math.PI;
      actor.group.rotation.z = state.alive ? 0 : Math.PI / 2;
      actor.group.visible = true;
    });
    for (const [id, actor] of this.remotePlayers) {
      if (liveIds.has(id)) continue;
      this.scene.remove(actor.group);
      this.remotePlayers.delete(id);
    }
    if (message.event?.type === "kill") {
      const attacker = message.event.attackerId === this.player.id ? this.player : this.remotePlayers.get(message.event.attackerId);
      const victim = message.event.victimId === this.player.id ? this.player : this.remotePlayers.get(message.event.victimId);
      if (victim) this.addKillFeed(attacker, victim, getWeapon(message.event.weaponId), message.event.zone);
    }
    if (message.winner) this.endMatch(message.winner);
    this.updateHud(true);
  }

  sendMultiplayerState(time) {
    if (!this.multiplayerMode || !this.multiplayer.connected || !this.player.alive || time - this.lastNetworkStateAt < 1 / 15) return;
    this.lastNetworkStateAt = time;
    this.multiplayer.sendState({
      position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
      yaw: this.yaw,
      pitch: this.pitch,
      weaponId: this.currentWeaponId() || "p9",
      frameId: this.player.frameId,
    });
  }

  clearRemotePlayers() {
    for (const actor of this.remotePlayers.values()) {
      this.scene.remove(actor.group);
      actor.group.traverse((object) => {
        object.geometry?.dispose?.();
        object.material?.dispose?.();
      });
    }
    this.remotePlayers.clear();
  }

  handleMultiplayerDisconnect() {
    if (!this.multiplayerMode) return;
    this.multiplayerMode = false;
    this.clearRemotePlayers();
    this.phase = "intro";
    this.paused = true;
    dom.deployOverlay.hidden = false;
    dom.connectionStatus.textContent = "与房间服务器的连接已断开。";
    this.toast("多人连接已断开");
  }

  async requestPointerLock() {
    try {
      await this.renderer.domElement.requestPointerLock();
      if (document.pointerLockElement !== this.renderer.domElement) this.enablePointerFallback();
    } catch {
      this.enablePointerFallback();
    }
  }

  enablePointerFallback() {
    if (this.pointerLockUnavailable) return;
    this.pointerLockUnavailable = true;
    this.mouse.hasPointerPosition = false;
    this.paused = false;
    dom.pauseMenu.hidden = true;
    this.syncCursorMode();
    this.toast("鼠标视角已启用");
  }

  syncSettingControls() {
    dom.sensitivityInput.value = String(this.settings.sensitivity);
    dom.sensitivityValue.value = `${this.settings.sensitivity.toFixed(1)}x`;
    dom.sensitivityValue.textContent = `${this.settings.sensitivity.toFixed(1)}x`;
    dom.volumeInput.value = String(this.settings.volume);
    dom.difficultySelect.value = this.settings.difficulty;
  }

  persistSettings() {
    try { localStorage.setItem("voxel-strike-settings", JSON.stringify(this.settings)); } catch { /* storage is optional */ }
  }

  setSensitivity(value) {
    this.settings.sensitivity = clamp(Number(value) || 1, 0.6, 2.2);
    dom.sensitivityInput.value = String(this.settings.sensitivity);
    dom.sensitivityValue.value = `${this.settings.sensitivity.toFixed(1)}x`;
    dom.sensitivityValue.textContent = `${this.settings.sensitivity.toFixed(1)}x`;
    this.persistSettings();
  }

  openPauseMenu() {
    if (!this.started || this.phase === "intro" || this.phase === "post") return;
    this.shopOpen = false;
    this.scoreboardOpen = false;
    dom.buyMenu.hidden = true;
    dom.scoreboard.hidden = true;
    dom.pauseMenu.hidden = false;
    this.paused = true;
    this.mouse.firing = false;
    this.mouse.aiming = false;
    this.mouse.hasPointerPosition = false;
    document.exitPointerLock?.();
    this.syncSettingControls();
    this.syncCursorMode();
  }

  syncCursorMode() {
    const active = this.started && !this.paused && !this.shopOpen && !this.scoreboardOpen && this.phase !== "post";
    document.body.classList.toggle("game-pointer-mode", active);
  }

  onPointerLockChange() {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (locked) {
      this.pointerLockUnavailable = false;
      this.mouse.hasPointerPosition = false;
    }
    if (!locked && !this.pointerLockUnavailable && this.started && this.player.alive && !this.paused && !this.shopOpen && !this.scoreboardOpen && this.phase !== "post") {
      this.openPauseMenu();
    }
    this.syncCursorMode();
  }

  resume() {
    dom.pauseMenu.hidden = true;
    this.paused = false;
    this.clock.getDelta();
    this.syncCursorMode();
    this.requestPointerLock();
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  startMatch() {
    this.round = 1;
    this.score = { attack: 0, defense: 0 };
    this.lossStreak = { attack: 0, defense: 0 };
    this.player.kills = 0;
    this.player.deaths = 0;
    this.player.assists = 0;
    this.player.frameId = this.activeFrame;
    this.startRound();
  }

  restartMatch() {
    if (this.multiplayerMode) {
      this.multiplayer.send("restart");
      dom.roundOverlay.hidden = true;
      return;
    }
    dom.pauseMenu.hidden = true;
    dom.roundOverlay.hidden = true;
    this.clearBots();
    this.startMatch();
    this.paused = false;
    this.requestPointerLock();
  }

  startRound() {
    this.clearBots();
    this.clearRoundEffects();
    this.phase = "live";
    this.phaseEndsAt = Infinity;
    this.objective = this.newObjective();
    this.resetPlayerForRound();
    this.spawnTeams();
    this.assignRoundTactics();
    dom.roundOverlay.hidden = true;
    this.paused = false;
    this.syncCursorMode();
    this.updateHud(true);
    this.toast(`${getFrame(this.player.frameId).name} 已部署 · 先到 ${this.killTarget} 分获胜`);
  }

  resetPlayerForRound() {
    const spawn = this.map.spawns.attack[4];
    const frame = getFrame(this.player.frameId);
    this.player.alive = true;
    this.player.health = frame.health;
    this.player.armor = frame.armor;
    this.player.velocityY = 0;
    this.player.position.copy(spawn);
    this.player.hasBomb = true;
    this.player.respawnAt = 0;
    this.player.spawnProtectedUntil = nowSeconds() + 2;
    this.player.actionStart = 0;
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.player.weaponStates = {};
    if (!this.player.loadout.secondary) this.player.loadout.secondary = "p9";
    for (const slot of ["primary", "secondary"]) {
      const id = this.player.loadout[slot];
      if (id) this.player.weaponStates[id] = createWeaponState(id);
    }
    this.player.activeSlot = this.player.loadout.primary ? "primary" : "secondary";
    this.playerBody.body.setNextKinematicTranslation({ x: spawn.x, y: 1.05, z: spawn.z });
    this.rebuildWeaponModel();
  }

  spawnTeams() {
    for (let index = 0; index < 4; index += 1) this.bots.push(this.createBot("attack", index, this.map.spawns.attack[index]));
    for (let index = 0; index < 5; index += 1) this.bots.push(this.createBot("defense", index, this.map.spawns.defense[index]));
  }

  tacticalAnchors() {
    const point = (x, z) => new THREE.Vector3(x, 0.05, z);
    return {
      siteA: this.map.sites.A.position.clone().setY(0.05),
      siteB: this.map.sites.B.position.clone().setY(0.05),
      midNorth: point(-1, -8),
      midCenter: point(1, 0),
      midSouth: point(2, 9),
      westLane: point(-8, 2),
      eastLane: point(8, -2),
      aApproach: point(-9, -9),
      bApproach: point(9, 9),
      aHold: point(-16, -8),
      bHold: point(16, 8),
      defenseMid: point(17, 0),
    };
  }

  assignRoundTactics() {
    const anchors = this.tacticalAnchors();
    const roundIndex = Math.max(0, this.round - 1);
    const attackPlans = [
      {
        name: "分线压进",
        roles: [
          ["护送", [anchors.aApproach, anchors.siteA]],
          ["入口手", [anchors.midNorth, anchors.aApproach, anchors.siteA]],
          ["中路控场", [anchors.midCenter, anchors.midSouth]],
          ["断后游走", [anchors.westLane, anchors.bApproach, anchors.siteB]],
        ],
      },
      {
        name: "B 点快攻",
        roles: [
          ["护送", [anchors.bApproach, anchors.siteB]],
          ["入口手", [anchors.midSouth, anchors.bApproach, anchors.siteB]],
          ["中路控场", [anchors.midCenter, anchors.eastLane]],
          ["假动作", [anchors.aApproach, anchors.midCenter]],
        ],
      },
      {
        name: "A 点佯攻",
        roles: [
          ["佯攻手", [anchors.aApproach, anchors.siteA]],
          ["支援手", [anchors.midNorth, anchors.midCenter]],
          ["后置转点", [anchors.midSouth, anchors.bApproach, anchors.siteB]],
          ["侧翼渗透", [anchors.westLane, anchors.midCenter, anchors.bApproach]],
        ],
      },
    ];
    const defensePlans = [
      {
        name: "双点守备",
        roles: [
          ["A 点锚守", [anchors.aHold, anchors.siteA]],
          ["A 点支援", [anchors.aApproach, anchors.siteA]],
          ["中路侦察", [anchors.defenseMid, anchors.midCenter]],
          ["B 点锚守", [anchors.bHold, anchors.siteB]],
          ["轮转预备", [anchors.defenseMid, anchors.midSouth]],
        ],
      },
      {
        name: "中路前压",
        roles: [
          ["A 点锚守", [anchors.aHold, anchors.siteA]],
          ["B 点锚守", [anchors.bHold, anchors.siteB]],
          ["中路前压", [anchors.defenseMid, anchors.midCenter, anchors.midNorth]],
          ["侧翼巡查", [anchors.eastLane, anchors.bApproach]],
          ["轮转预备", [anchors.defenseMid, anchors.aApproach]],
        ],
      },
      {
        name: "B 点堆叠",
        roles: [
          ["A 点诱饵", [anchors.aHold, anchors.aApproach]],
          ["B 点锚守", [anchors.bHold, anchors.siteB]],
          ["B 点支援", [anchors.bApproach, anchors.siteB]],
          ["中路侦察", [anchors.defenseMid, anchors.midSouth]],
          ["轮转预备", [anchors.defenseMid, anchors.midCenter]],
        ],
      },
    ];
    const assign = (team, plan) => {
      this.bots.filter((bot) => bot.team === team).forEach((bot) => {
        const [role, route] = plan.roles[bot.roleIndex % plan.roles.length];
        bot.tacticPlan = plan.name;
        bot.tacticRole = role;
        bot.tacticalRoute = route.map((point) => point.clone());
        bot.tacticalStep = 0;
        bot.path = [];
        bot.pathIndex = 0;
      });
    };
    assign("attack", attackPlans[roundIndex % attackPlans.length]);
    assign("defense", defensePlans[roundIndex % defensePlans.length]);
  }

  createBot(team, index, spawn) {
    const group = new THREE.Group();
    const color = team === "attack" ? 0xd8793f : 0x4b8dc7;
    const dark = team === "attack" ? 0x553526 : 0x243d56;
    const skin = new THREE.MeshStandardMaterial({ color: 0xc79672, roughness: 0.86 });
    const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const uniformDark = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.88 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skin);
    head.position.y = 1.72;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.86, 0.4), uniform);
    torso.position.y = 1.08;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.68, 0.3), uniformDark);
    const legR = legL.clone();
    legL.position.set(-0.2, 0.35, 0);
    legR.position.set(0.2, 0.35, 0);
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.82), new THREE.MeshStandardMaterial({ color: 0x2c342f, roughness: 0.5, metalness: 0.35 }));
    weapon.position.set(0.34, 1.17, -0.35);
    [head, torso, legL, legR, weapon].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
    group.position.copy(spawn);
    this.scene.add(group);
    const id = `${team}-${index}`;
    const frameId = team === "attack" ? pick(["assault", "scout", "support"]) : pick(["assault", "bulwark", "scout"]);
    const frame = getFrame(frameId);
    const weaponPool = WEAPONS && Object.values(WEAPONS).filter((weapon) => weaponCompatible(frame, weapon.category) && weapon.slot === "primary");
    const weaponId = pick((weaponPool?.length ? weaponPool : [getWeapon("v47")]).map((weapon) => weapon.id));
    const bot = {
      id,
      name: BOT_NAMES[team][index],
      team,
      position: spawn.clone(),
      group,
      hitMeshes: [head, torso, legL, legR],
      health: frame.health,
      armor: frame.armor,
      alive: true,
      weaponId,
      frameId,
      weaponState: createWeaponState(weaponId),
      kills: 0,
      deaths: 0,
      assists: 0,
      money: 3200,
      target: null,
      path: [],
      pathIndex: 0,
      nextThinkAt: 0,
      nextShotAt: 0,
      reactionReadyAt: 0,
      actionProgress: 0,
      roleIndex: index,
      tacticPlan: "",
      tacticRole: "",
      tacticalRoute: [],
      tacticalStep: 0,
      respawnAt: 0,
      spawnProtectedUntil: nowSeconds() + 2,
    };
    head.userData = { actor: bot, hitZone: "head" };
    torso.userData = { actor: bot, hitZone: "body" };
    legL.userData = { actor: bot, hitZone: "legs" };
    legR.userData = { actor: bot, hitZone: "legs" };
    return bot;
  }

  clearBots() {
    this.bots.forEach((bot) => {
      this.scene.remove(bot.group);
      bot.group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material?.dispose) object.material.dispose();
      });
    });
    this.bots = [];
  }

  clearRoundEffects() {
    [...this.effects, ...this.pickups].forEach((effect) => {
      this.scene.remove(effect.mesh);
      effect.mesh?.geometry?.dispose?.();
      effect.mesh?.material?.dispose?.();
    });
    this.effects = [];
    this.pickups = [];
  }

  beginNextRound() {
    this.restartMatch();
  }

  endMatch(winner) {
    if (this.phase === "post") return;
    this.phase = "post";
    this.phaseEndsAt = Infinity;
    const won = winner === "attack";
    document.exitPointerLock?.();
    this.paused = true;
    this.syncCursorMode();
    dom.roundResultKicker.textContent = "MATCH COMPLETE";
    dom.roundResultTitle.textContent = `${won ? "橙队" : "蓝队"}获胜`;
    dom.roundResultCopy.textContent = `${won ? "橙队" : "蓝队"}率先达到 ${this.killTarget} 分。最终比分 ${this.score.attack} : ${this.score.defense}。`;
    dom.nextRoundButton.textContent = "重新开始比赛";
    dom.roundOverlay.hidden = false;
    this.updateHud(true);
    this.playTone(won ? 520 : 150, 0.24, "square");
  }

  registerKillScore(attacker) {
    if (!attacker?.team || this.phase === "post") return;
    this.score[attacker.team] = Math.min(this.killTarget, this.score[attacker.team] + 1);
    if (this.score[attacker.team] >= this.killTarget) this.endMatch(attacker.team);
  }

  onMouseMove(event) {
    const pointerLocked = document.pointerLockElement === this.renderer.domElement;
    const fallbackLook = this.pointerLockUnavailable && this.started && !this.paused && !this.shopOpen && !this.scoreboardOpen && this.phase !== "post";
    if ((!pointerLocked && !fallbackLook) || this.paused || !this.player.alive) return;
    const sensitivity = 0.00165 * this.settings.sensitivity * (fallbackLook ? 3 : 1);
    const hasClientPosition = fallbackLook && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
    if (hasClientPosition && !this.mouse.hasPointerPosition) {
      this.mouse.hasPointerPosition = true;
      this.mouse.lastClientX = event.clientX;
      this.mouse.lastClientY = event.clientY;
      return;
    }
    const deltaX = hasClientPosition ? event.clientX - this.mouse.lastClientX : event.movementX;
    const deltaY = hasClientPosition ? event.clientY - this.mouse.lastClientY : event.movementY;
    this.yaw -= deltaX * sensitivity;
    this.pitch -= deltaY * sensitivity;
    this.pitch = clamp(this.pitch, -1.42, 1.42);
    if (hasClientPosition) {
      this.mouse.lastClientX = event.clientX;
      this.mouse.lastClientY = event.clientY;
    }
  }

  onMouseDown(event) {
    if (event.button === 0) {
      this.mouse.firing = true;
      this.tryPrimaryAction();
    }
    if (event.button === 2) this.mouse.aiming = true;
  }

  onMouseUp(event) {
    if (event.button === 0) this.mouse.firing = false;
    if (event.button === 2) this.mouse.aiming = false;
  }

  onKeyDown(event) {
    if (["Tab", "Space"].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);

    if (event.code === "KeyB" && this.started && !this.paused && this.phase !== "post") this.toggleShop();
    if (event.code === "Tab" && this.started) this.setScoreboard(true);
    if (event.code === "KeyR") this.startReload();
    if (event.code === "KeyG") this.dropCurrentWeapon();
    if (event.code === "KeyQ") this.activateAbility();
    if (event.code === "Digit1") this.handleNumberKey(1);
    if (event.code === "Digit2") this.handleNumberKey(2);
    if (event.code === "Digit3") this.handleNumberKey(3);
    if (event.code === "Digit4") this.handleNumberKey(4);
    if (event.code === "Digit5") this.handleNumberKey(5);
    if (event.code === "Digit6") this.handleNumberKey(6);
    if (event.code === "Digit7") this.handleNumberKey(7);
    if (event.code === "Digit8") this.handleNumberKey(8);
    if (event.code === "Escape") {
      event.preventDefault();
      if (this.shopOpen) this.toggleShop(false);
      else if (this.scoreboardOpen) this.setScoreboard(false);
      else if (this.paused) {
        if (dom.pauseMenu.hidden) this.resume();
      }
      else this.openPauseMenu();
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
    if (event.code === "Tab") this.setScoreboard(false);
    if (event.code === "KeyE") this.player.actionStart = 0;
  }

  handleNumberKey(number) {
    if (this.shopOpen) {
      if (number >= 1 && number <= FRAME_LIST.length) {
        this.selectFrame(FRAME_LIST[number - 1].id);
        return;
      }
      const category = CATEGORY_DEFINITIONS.find((entry) => entry.shortcut === number);
      if (category) {
        this.shopCategory = category.id;
        this.renderShopCategories();
        this.renderShopItems();
      }
      return;
    }
    if (number === 1 && this.player.loadout.primary) this.switchWeapon("primary");
    if (number === 2 && this.player.loadout.secondary) this.switchWeapon("secondary");
    if (number === 3) this.switchWeapon("melee");
    if (number === 4 && this.player.loadout.grenades.length) this.switchWeapon("grenade");
  }

  selectFrame(frameId) {
    const frame = getFrame(frameId);
    this.activeFrame = frame.id;
    this.player.frameId = frame.id;
    const currentPrimary = this.player.loadout.primary ? getWeapon(this.player.loadout.primary) : null;
    if (currentPrimary && !weaponCompatible(frame, currentPrimary.category)) {
      this.player.loadout.primary = null;
      this.player.activeSlot = "secondary";
      this.toast(`${frame.name} 不兼容当前主武器，已收回主武器`);
    }
    this.player.health = Math.min(this.player.health, frame.health);
    this.player.armor = frame.armor;
    this.abilityCooldownEndsAt = 0;
    this.player.abilityCooldownEndsAt = 0;
    this.renderShopCategories();
    this.renderShopItems(true);
    this.rebuildWeaponModel();
    this.updateHud(true);
    this.toast(`已装备 ${frame.name}`);
  }

  activateAbility() {
    if (!this.started || this.paused || this.shopOpen || this.phase === "post" || !this.player.alive) return;
    const frame = getFrame(this.player.frameId);
    const time = nowSeconds();
    if (!abilityReady(time, this.player.abilityCooldownEndsAt)) {
      this.toast(`战术能力冷却中 · ${Math.ceil(this.player.abilityCooldownEndsAt - time)} 秒`);
      return;
    }
    this.player.abilityCooldownEndsAt = time + 18;
    this.abilityCooldownEndsAt = this.player.abilityCooldownEndsAt;
    this.abilityActiveUntil = time + 6;
    this.player.abilityActiveUntil = this.abilityActiveUntil;
    if (frame.id === "support") {
      const allies = [this.player, ...this.bots].filter((actor) => actor.alive && actor.team === this.player.team && actor.position.distanceTo(this.player.position) < 9);
      allies.forEach((actor) => { actor.health = Math.min(getFrame(actor.frameId ?? frame.id).health, actor.health + 28); });
    }
    if (frame.id === "scout") {
      [...this.bots, ...this.remotePlayers.values()].filter((actor) => actor.team !== this.player.team && actor.alive && actor.position.distanceTo(this.player.position) < 18).forEach((actor) => {
        actor.markedUntil = time + 5;
      });
      this.player.velocityY = 5.8;
      this.player.grounded = false;
    }
    this.spawnBurst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)), frame.color, 24, 1.1);
    this.toast(`${frame.ability} 已激活`);
    this.playTone(420, 0.14, "square");
  }

  switchWeapon(slot) {
    if (!this.player.alive) return;
    this.cancelReload();
    this.player.activeSlot = slot;
    this.rebuildWeaponModel();
    this.updateWeaponHud();
    this.playTone(210, 0.035, "square");
  }

  currentWeaponId() {
    if (this.player.activeSlot === "grenade") return this.player.loadout.grenades[0] ?? null;
    if (this.player.activeSlot === "melee") return "fieldKnife";
    return this.player.loadout[this.player.activeSlot];
  }

  currentWeapon() {
    return getWeapon(this.currentWeaponId());
  }

  currentWeaponState() {
    const id = this.currentWeaponId();
    return id ? this.player.weaponStates[id] : null;
  }

  tryPrimaryAction() {
    if (this.paused || this.phase === "intro" || this.phase === "post" || !this.player.alive || this.shopOpen) return;
    if (this.player.activeSlot === "grenade") this.throwGrenade();
    else if (this.player.activeSlot === "melee") this.meleeAttack();
    else this.firePlayerWeapon();
  }

  firePlayerWeapon() {
    const weapon = this.currentWeapon();
    const state = this.currentWeaponState();
    if (!weapon || !state || state.reloading) return;
    const time = nowSeconds();
    if (time - state.lastShotAt < weapon.fireInterval) return;
    if (state.ammo <= 0) {
      this.playTone(95, 0.03, "square");
      this.startReload();
      return;
    }

    state.ammo -= 1;
    state.lastShotAt = time;
    this.player.lastShotAt = time;
    this.player.recoil = Math.min(4.8, this.player.recoil + weapon.recoil * 0.16);
    this.pitch += weapon.recoil * 0.0024;
    const moving = this.keys.has("KeyW") || this.keys.has("KeyA") || this.keys.has("KeyS") || this.keys.has("KeyD");
    const spread = (weapon.spread + (moving ? weapon.movementSpread : 0) + this.player.recoil * 0.004) * (this.mouse.aiming ? 0.46 : 1);
    const pellets = weapon.pellets ?? 1;
    for (let pellet = 0; pellet < pellets; pellet += 1) this.castPlayerShot(weapon, spread);
    this.animateMuzzle();
    this.playTone(92 + weapon.damage * 2.1, 0.045, weapon.category === "sniper" ? "sawtooth" : "square");
    dom.crosshair.classList.add("is-firing");
    setTimeout(() => dom.crosshair.classList.remove("is-firing"), 65);
    this.updateWeaponHud();
  }

  castPlayerShot(weapon, spread) {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.z += (Math.random() - 0.5) * spread;
    direction.normalize();
    const origin = this.camera.position.clone();
    this.raycaster.set(origin, direction);
    this.raycaster.far = weapon.range;
    const enemyActors = this.multiplayerMode
      ? [...this.remotePlayers.values()].filter((actor) => actor.team !== this.player.team && actor.alive)
      : this.bots.filter((bot) => bot.team !== this.player.team && bot.alive);
    const enemyMeshes = enemyActors.flatMap((actor) => actor.hitMeshes);
    const actorHit = this.raycaster.intersectObjects(enemyMeshes, false)[0];
    const mapHit = this.raycaster.intersectObjects(this.map.raycastables, false)[0];
    let end = origin.clone().addScaledVector(direction, weapon.range);
    if (mapHit) end.copy(mapHit.point);
    if (actorHit && (!mapHit || actorHit.distance < mapHit.distance)) {
      end.copy(actorHit.point);
      const actor = actorHit.object.userData.actor;
      const zone = actorHit.object.userData.hitZone;
      const damage = calculateShotDamage(weapon, { distance: actorHit.distance, hitZone: zone, armored: actor.armor > 0 });
      if (actor.networkRemote) this.multiplayer.sendHit(actor.id, damage, weapon.id, zone);
      else this.damageActor(actor, damage, this.player, weapon, zone);
      this.spawnHitParticles(end, weapon.accent, zone === "head" ? 8 : 4);
    } else {
      this.spawnHitParticles(end, "#c9d0bf", 3);
    }
    this.spawnTracer(origin, end, weapon.accent);
  }

  startReload() {
    const weapon = this.currentWeapon();
    const state = this.currentWeaponState();
    if (!weapon || !state || state.reloading || state.ammo >= weapon.magazine || state.reserve <= 0) return;
    state.reloading = true;
    state.reloadEndsAt = nowSeconds() + weapon.reload;
    this.toast("换弹中");
    this.playTone(185, 0.05, "square");
    this.updateWeaponHud();
  }

  finishReload() {
    const weapon = this.currentWeapon();
    const state = this.currentWeaponState();
    if (!weapon || !state || !state.reloading) return;
    const needed = weapon.magazine - state.ammo;
    const moved = Math.min(needed, state.reserve);
    state.ammo += moved;
    state.reserve -= moved;
    state.reloading = false;
    this.playTone(260, 0.04, "square");
    this.updateWeaponHud();
  }

  cancelReload() {
    const state = this.currentWeaponState();
    if (state) state.reloading = false;
  }

  meleeAttack() {
    const target = this.bots.filter((bot) => bot.team === "defense" && bot.alive)
      .map((bot) => ({ bot, distance: bot.position.distanceTo(this.player.position) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (target?.distance < 2.15) this.damageActor(target.bot, 48, this.player, { id: "fieldKnife", name: "战术方刃", killReward: 600 }, "body");
    this.playTone(140, 0.05, "sawtooth");
  }

  throwGrenade() {
    const grenadeId = this.player.loadout.grenades.shift();
    const grenade = GRENADE_LIST.find((entry) => entry.id === grenadeId);
    if (!grenade) return;
    const geometry = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const material = new THREE.MeshStandardMaterial({ color: grenade.accent, emissive: grenade.accent, emissiveIntensity: 0.35 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.camera.position).add(new THREE.Vector3(0, -0.15, 0));
    mesh.castShadow = true;
    this.scene.add(mesh);
    const direction = new THREE.Vector3(0, 0.2, -1).applyQuaternion(this.camera.quaternion).normalize();
    this.effects.push({
      type: "grenade",
      grenade,
      mesh,
      velocity: direction.multiplyScalar(grenade.throwSpeed),
      expiresAt: nowSeconds() + grenade.fuse,
    });
    this.player.activeSlot = this.player.loadout.primary ? "primary" : "secondary";
    this.rebuildWeaponModel();
    this.updateWeaponHud();
  }

  explodeGrenade(effect) {
    const { grenade, mesh } = effect;
    const position = mesh.position.clone();
    this.scene.remove(mesh);
    if (grenade.effect === "explosion") {
      for (const actor of [...this.bots, this.player]) {
        if (!actor.alive) continue;
        const distance = actor.position.distanceTo(position);
        if (distance <= grenade.radius) this.damageActor(actor, grenade.damage * (1 - distance / (grenade.radius * 1.3)), this.player, grenade, "body");
      }
      this.spawnBurst(position, grenade.accent, 32, 1.2);
      this.playTone(72, 0.28, "sawtooth");
    }
    if (grenade.effect === "flash") {
      const distance = this.player.position.distanceTo(position);
      if (distance < grenade.radius) {
        dom.flashOverlay.style.opacity = String(clamp(1 - distance / grenade.radius, 0.2, 1));
        setTimeout(() => { dom.flashOverlay.style.opacity = "0"; }, grenade.duration * 700);
      }
      this.spawnBurst(position, "#fffbe2", 24, 0.7);
    }
    if (grenade.effect === "smoke") this.createAreaEffect("smoke", position, grenade.duration, grenade.radius);
    if (grenade.effect === "fire") this.createAreaEffect("fire", position, grenade.duration, grenade.radius, grenade.damage);
  }

  createAreaEffect(type, position, duration, radius, damage = 0) {
    const group = new THREE.Group();
    const color = type === "smoke" ? 0x7b8586 : 0xf47e31;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: type === "smoke" ? 0.32 : 0.58, depthWrite: false });
    for (let index = 0; index < 34; index += 1) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), material);
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius * 0.68;
      cube.position.set(Math.cos(angle) * distance, 0.25 + Math.random() * (type === "smoke" ? 2.8 : 0.5), Math.sin(angle) * distance);
      cube.scale.setScalar(0.7 + Math.random() * 1.2);
      group.add(cube);
    }
    group.position.copy(position);
    this.scene.add(group);
    this.effects.push({ type: "area", areaType: type, mesh: group, radius, damage, expiresAt: nowSeconds() + duration, nextTickAt: 0 });
  }

  damageActor(actor, rawDamage, attacker, weapon, zone = "body") {
    if (!actor?.alive || rawDamage <= 0) return;
    if (actor.spawnProtectedUntil && nowSeconds() < actor.spawnProtectedUntil) return;
    if (actor === this.player && this.abilityActiveUntil > nowSeconds() && getFrame(this.player.frameId).passive === "armor") rawDamage *= 0.55;
    let damage = rawDamage;
    if (actor.armor > 0) {
      const absorbed = Math.min(actor.armor, damage * 0.45);
      actor.armor -= absorbed;
      damage -= absorbed * 0.32;
    }
    actor.health -= damage;
    if (actor === this.player) {
      dom.damageVignette.classList.add("active");
      setTimeout(() => dom.damageVignette.classList.remove("active"), 110);
    }
    if (actor.health <= 0) this.killActor(actor, attacker, weapon, zone);
  }

  killActor(actor, attacker, weapon, zone) {
    actor.alive = false;
    actor.health = 0;
    actor.deaths += 1;
    actor.respawnAt = nowSeconds() + RESPAWN_DELAY;
    if (actor.group) {
      actor.group.rotation.z = Math.PI / 2;
      actor.group.position.y = 0.35;
      actor.hitMeshes.forEach((mesh) => { mesh.userData.actor = actor; });
    }
    if (attacker) {
      attacker.kills = (attacker.kills ?? 0) + 1;
      if (attacker === this.player) {
        this.player.money = Math.min(16000, this.player.money + (weapon.killReward ?? 300));
        this.grantWeaponXp(weapon.id, 180);
        if (getFrame(this.player.frameId).passive === "medic") this.player.health = Math.min(getFrame(this.player.frameId).health, this.player.health + 12);
      }
      if (attacker?.weaponId) this.grantWeaponXp(attacker.weaponId, 120);
      if (attacker.team !== actor.team) this.registerKillScore(attacker);
    }
    this.addKillFeed(attacker, actor, weapon, zone);
    this.spawnBurst(actor.position.clone().add(new THREE.Vector3(0, 1.1, 0)), actor.team === "attack" ? "#f49a53" : "#72b6ff", 18, 0.75);
    if (actor === this.player) {
      this.player.deaths += 0;
      this.player.hasBomb = false;
      this.weaponRoot.visible = false;
      this.mouse.firing = false;
      this.mouse.aiming = false;
      this.mouse.hasPointerPosition = false;
      document.exitPointerLock?.();
      this.toast(`你已阵亡 · ${RESPAWN_DELAY} 秒后复活`);
    }
  }

  respawnActor(actor) {
    if (!actor || actor.alive || this.phase === "post") return;
    const spawns = this.map.spawns[actor.team === "attack" ? "attack" : "defense"];
    const spawnIndex = actor === this.player ? 4 : actor.roleIndex % spawns.length;
    const spawn = spawns[spawnIndex];
    actor.alive = true;
    const frame = actor === this.player ? getFrame(this.player.frameId) : null;
    actor.health = frame?.health ?? 100;
    actor.armor = actor === this.player ? (frame?.armor ?? actor.armor) : 80;
    actor.spawnProtectedUntil = nowSeconds() + 2;
    actor.position.copy(spawn);
    actor.respawnAt = 0;
    if (actor === this.player) {
      this.player.velocityY = 0;
      this.player.grounded = true;
      this.playerBody.body.setNextKinematicTranslation({ x: spawn.x, y: 1.05, z: spawn.z });
      this.weaponRoot.visible = true;
      this.rebuildWeaponModel();
      this.toast("已复活");
      this.requestPointerLock();
      return;
    }
    actor.target = null;
    actor.path = [];
    actor.pathIndex = 0;
    actor.nextThinkAt = 0;
    actor.group.rotation.z = 0;
    actor.group.position.copy(spawn);
    actor.hitMeshes.forEach((mesh) => { mesh.userData.actor = actor; });
  }

  addKillFeed(attacker, victim, weapon, zone) {
    const entry = document.createElement("div");
    entry.className = "kill-entry";
    const attackerClass = attacker?.team === "attack" ? "ally" : "enemy";
    const victimClass = victim.team === "attack" ? "ally" : "enemy";
    entry.innerHTML = `<strong class="${attackerClass}">${attacker?.name ?? "环境"}</strong> ${zone === "head" ? "◇" : "·"} ${weapon?.name ?? weapon?.id ?? "武器"} · <strong class="${victimClass}">${victim.name}</strong>`;
    dom.killfeed.prepend(entry);
    while (dom.killfeed.children.length > 5) dom.killfeed.lastElementChild.remove();
    setTimeout(() => entry.remove(), 5200);
  }

  updatePlayer(dt) {
    if (!this.player.alive) {
      if (!this.multiplayerMode && nowSeconds() >= this.player.respawnAt) {
        this.respawnActor(this.player);
        return;
      }
      const spectated = this.multiplayerMode
        ? [...this.remotePlayers.values()].find((actor) => actor.team === this.player.team && actor.alive)
        : this.bots.find((bot) => bot.team === this.player.team && bot.alive);
      if (spectated) {
        const behind = new THREE.Vector3(0, 2.2, 4.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), spectated.group.rotation.y);
        this.camera.position.lerp(spectated.position.clone().add(behind), 0.08);
        this.camera.lookAt(spectated.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      }
      return;
    }
    if (this.shopOpen) return;

    const movingForward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const movingRight = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const crouched = this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.keys.has("KeyC");
    const quiet = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.player.crouched = crouched;
    const frame = getFrame(this.player.frameId);
    let speed = crouched ? 2.35 : quiet ? 3.35 : 5.35;
    if (frame.passive === "quiet") speed += 0.55;
    if (this.player.abilityActiveUntil > nowSeconds() && frame.id === "assault") speed *= 1.22;
    if (this.player.abilityActiveUntil > nowSeconds() && frame.id === "bulwark") speed *= 0.9;
    const weapon = this.currentWeapon();
    if (weapon) speed *= weapon.moveSpeed ?? 1;
    const local = new THREE.Vector3(movingRight, 0, -movingForward);
    if (local.lengthSq() > 0) local.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).multiplyScalar(speed * dt);
    const proposed = this.player.position.clone().add(local);
    this.resolveActorXZ(this.player.position, proposed, 0.38);
    this.player.position.x = proposed.x;
    this.player.position.z = proposed.z;

    if (this.keys.has("Space") && this.player.grounded && !crouched) {
      this.player.velocityY = 5.2;
      this.player.grounded = false;
      this.playTone(120, 0.03, "sine");
    }
    this.player.velocityY -= 13.5 * dt;
    this.player.position.y += this.player.velocityY * dt;
    if (this.player.position.y <= 0.05) {
      this.player.position.y = 0.05;
      this.player.velocityY = 0;
      this.player.grounded = true;
    }

    this.playerBody.body.setNextKinematicTranslation({ x: this.player.position.x, y: this.player.position.y + 1, z: this.player.position.z });
    const eyeHeight = crouched ? 1.18 : 1.64;
    this.camera.position.set(this.player.position.x, this.player.position.y + eyeHeight, this.player.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.player.recoil = Math.max(0, this.player.recoil - dt * (weapon?.recoilRecovery ?? 7));
    const targetFov = this.mouse.aiming ? (weapon?.zoomFov ?? 58) : 74;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();
    dom.crosshair.classList.toggle("is-aiming", this.mouse.aiming);

    if (this.mouse.firing && weapon?.automatic) this.firePlayerWeapon();
    const weaponState = this.currentWeaponState();
    if (weaponState?.reloading && nowSeconds() >= weaponState.reloadEndsAt) this.finishReload();
    this.updateViewmodel(dt, local.lengthSq() > 0);
  }

  resolveActorXZ(current, proposed, radius) {
    const bounds = this.map.worldBounds;
    proposed.x = clamp(proposed.x, bounds.minX + radius + 0.55, bounds.maxX - radius - 0.55);
    proposed.z = clamp(proposed.z, bounds.minZ + radius + 0.55, bounds.maxZ - radius - 0.55);
    const blocked = (x, z) => this.map.obstacles.some((obstacle) => {
      if (!obstacle.navBlock || obstacle.kind === "floor" || obstacle.walkable) return false;
      return x > obstacle.bounds.minX - radius && x < obstacle.bounds.maxX + radius && z > obstacle.bounds.minZ - radius && z < obstacle.bounds.maxZ + radius;
    });
    if (blocked(proposed.x, current.z)) proposed.x = current.x;
    if (blocked(proposed.x, proposed.z)) proposed.z = current.z;
  }

  updateViewmodel(dt, moving) {
    if (!this.weaponRoot.visible) return;
    const time = performance.now() * 0.001;
    const bob = moving && this.player.grounded ? Math.sin(time * 9) * 0.015 : 0;
    const hipX = this.camera.aspect < 0.75 ? 0.16 : 0.42;
    const targetX = this.mouse.aiming ? 0 : hipX;
    const targetY = this.mouse.aiming ? -0.29 : -0.38 + bob;
    this.weaponRoot.position.x += (targetX - this.weaponRoot.position.x) * Math.min(1, dt * 14);
    this.weaponRoot.position.y += (targetY - this.weaponRoot.position.y) * Math.min(1, dt * 14);
    this.weaponRoot.rotation.z = moving ? Math.sin(time * 4.5) * 0.012 : 0;
  }

  rebuildWeaponModel() {
    this.weaponRoot.clear();
    this.weaponRoot.visible = this.player.alive;
    const id = this.currentWeaponId();
    const weapon = getWeapon(id);
    const accent = new THREE.Color(weapon?.accent ?? (this.player.activeSlot === "grenade" ? "#f0a04a" : "#9ca99f"));
    const dark = new THREE.MeshStandardMaterial({ color: 0x202722, roughness: 0.52, metalness: 0.36 });
    const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, metalness: 0.16 });
    const root = new THREE.Group();
    if (this.player.activeSlot === "grenade") {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), trim);
      root.add(cube);
    } else if (this.player.activeSlot === "melee") {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.65), trim);
      blade.rotation.x = -0.28;
      root.add(blade);
    } else {
      const long = ["rifle", "sniper", "heavy", "shotgun", "smg"].includes(weapon?.category);
      const body = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.17 : 0.14, 0.18, long ? 0.7 : 0.42), dark);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, long ? 0.74 : 0.42), trim);
      rail.position.y = 0.11;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.14), dark);
      grip.position.set(0, -0.18, 0.08);
      grip.rotation.x = -0.18;
      root.add(body, rail, grip);
      if (weapon?.scoped) {
        const scope = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.32), trim);
        scope.position.set(0, 0.21, -0.08);
        root.add(scope);
      }
    }
    root.position.set(0, 0, -0.62);
    root.rotation.y = Math.PI;
    this.weaponRoot.add(root);
    this.weaponRoot.position.set(this.camera.aspect < 0.75 ? 0.16 : 0.42, -0.38, -0.05);
    this.updateWeaponHud();
  }

  animateMuzzle() {
    const flash = new THREE.PointLight(0xffb15d, 3.2, 4.5, 2);
    flash.position.set(0, 0, -1.1);
    this.weaponRoot.add(flash);
    this.weaponRoot.position.z = 0.045;
    setTimeout(() => {
      this.weaponRoot.remove(flash);
      this.weaponRoot.position.z = -0.05;
    }, 42);
  }

  updateBots(dt, time) {
    const difficulty = DIFFICULTIES[this.settings.difficulty];
    for (const bot of this.bots) {
      if (!bot.alive) {
        if (time >= bot.respawnAt) this.respawnActor(bot);
        continue;
      }
      if (time >= bot.nextThinkAt) {
        this.thinkBot(bot, time, difficulty);
        bot.nextThinkAt = time + 0.32 + Math.random() * 0.18;
      }
      if (bot.target?.alive && this.hasLineOfSight(bot.position, bot.target.position)) {
        this.engageBotTarget(bot, bot.target, time, difficulty);
      } else {
        bot.target = null;
        this.moveBotAlongPath(bot, dt, difficulty.speed);
      }
      bot.group.position.copy(bot.position);
    }
  }

  thinkBot(bot, time, difficulty) {
    const opponents = bot.team === "attack"
      ? this.bots.filter((actor) => actor.team === "defense" && actor.alive)
      : [...this.bots.filter((actor) => actor.team === "attack" && actor.alive), ...(this.player.alive ? [this.player] : [])];
    const visible = opponents
      .map((actor) => ({ actor, distance: actor.position.distanceTo(bot.position) }))
      .filter(({ actor, distance }) => distance < 31 && this.hasLineOfSight(bot.position, actor.position))
      .sort((a, b) => a.distance - b.distance)[0];

    if (visible) {
      if (bot.target !== visible.actor) bot.reactionReadyAt = time + difficulty.reaction * (0.7 + Math.random() * 0.65);
      bot.target = visible.actor;
      return;
    }

    const destination = this.getBotDestination(bot);
    if (!bot.path.length || bot.pathIndex >= bot.path.length || bot.position.distanceTo(destination) > 4) {
      bot.path = this.map.nav.findPath(bot.position, destination, { y: 0.05 });
      bot.pathIndex = Math.min(1, bot.path.length - 1);
    }
  }

  getBotDestination(bot) {
    if (bot.tacticalRoute?.length) {
      const lastStep = bot.tacticalRoute.length - 1;
      while (bot.tacticalStep < lastStep && bot.position.distanceTo(bot.tacticalRoute[bot.tacticalStep]) < 1.1) {
        bot.tacticalStep += 1;
        bot.path = [];
        bot.pathIndex = 0;
      }
      return bot.tacticalRoute[Math.min(bot.tacticalStep, lastStep)];
    }
    if (bot.team === "defense") return bot.roleIndex < 3 ? this.map.sites.A.position : this.map.sites.B.position;
    return bot.roleIndex % 2 ? this.map.sites.B.position : this.map.sites.A.position;
  }

  moveBotAlongPath(bot, dt, speed) {
    if (!bot.path.length || bot.pathIndex < 0 || bot.pathIndex >= bot.path.length) return;
    const target = bot.path[bot.pathIndex];
    const direction = target.clone().sub(bot.position);
    direction.y = 0;
    if (direction.length() < 0.45) {
      bot.pathIndex += 1;
      return;
    }
    direction.normalize();
    const proposed = bot.position.clone().addScaledVector(direction, speed * dt);
    this.resolveActorXZ(bot.position, proposed, 0.36);
    bot.position.copy(proposed);
    bot.group.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
  }

  engageBotTarget(bot, target, time, difficulty) {
    const direction = target.position.clone().sub(bot.position);
    const distance = direction.length();
    bot.group.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
    if (time < bot.reactionReadyAt || time < bot.nextShotAt) return;
    const weapon = getWeapon(bot.weaponId);
    bot.nextShotAt = time + weapon.fireInterval * (0.92 + Math.random() * 0.28);
    const rangeFactor = clamp(1 - distance / Math.max(weapon.range, 1), 0.1, 1);
    const hit = Math.random() < difficulty.accuracy * rangeFactor * (weapon.category === "sniper" ? 1.12 : 1);
    if (hit) {
      const headshot = Math.random() < difficulty.accuracy * 0.14;
      const zone = headshot ? "head" : "body";
      const damage = calculateShotDamage(weapon, { distance, hitZone: zone, armored: target.armor > 0 }) * difficulty.damage;
      this.damageActor(target, damage, bot, weapon, zone);
    }
    const origin = bot.position.clone().add(new THREE.Vector3(0, 1.45, 0));
    const end = hit ? target.position.clone().add(new THREE.Vector3(0, 1.1, 0)) : origin.clone().add(direction.normalize().multiplyScalar(Math.min(distance + 5, weapon.range)));
    this.spawnTracer(origin, end, bot.team === "attack" ? "#f49a53" : "#72b6ff");
    this.playTone(72 + weapon.damage, 0.025, "square", 0.18);
  }

  hasLineOfSight(from, to) {
    const origin = from.clone().add(new THREE.Vector3(0, 1.25, 0));
    const target = to.clone().add(new THREE.Vector3(0, 1.25, 0));
    const direction = target.sub(origin);
    const length = direction.length();
    direction.normalize();
    this.raycaster.set(origin, direction);
    this.raycaster.far = length;
    const hit = this.raycaster.intersectObjects(this.map.raycastables, false)[0];
    return !hit || hit.distance >= length - 0.8;
  }

  updateObjective() {
    dom.interactionPrompt.classList.remove("visible");
    dom.actionProgress.classList.remove("visible");
  }

  updateRoundState(time) {
    if (this.score.attack >= this.killTarget) this.endMatch("attack");
    if (this.score.defense >= this.killTarget) this.endMatch("defense");
  }

  updateEffects(dt, time) {
    const survivors = [];
    for (const effect of this.effects) {
      if (effect.type === "grenade") {
        effect.velocity.y -= 13 * dt;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.rotation.x += dt * 5;
        effect.mesh.rotation.z += dt * 3;
        if (effect.mesh.position.y < 0.2) {
          effect.mesh.position.y = 0.2;
          effect.velocity.y = Math.abs(effect.velocity.y) * 0.42;
          effect.velocity.x *= 0.78;
          effect.velocity.z *= 0.78;
        }
        if (time >= effect.expiresAt) {
          this.explodeGrenade(effect);
          continue;
        }
      }
      if (effect.type === "area") {
        effect.mesh.rotation.y += dt * (effect.areaType === "smoke" ? 0.08 : 0.4);
        if (effect.areaType === "fire" && time >= effect.nextTickAt) {
          effect.nextTickAt = time + 0.5;
          for (const actor of [...this.bots, this.player]) {
            if (actor.alive && actor.position.distanceTo(effect.mesh.position) <= effect.radius) this.damageActor(actor, effect.damage, this.player, { name: "燃烧方块", killReward: 300 }, "body");
          }
        }
        if (time >= effect.expiresAt) {
          this.scene.remove(effect.mesh);
          continue;
        }
      }
      if (effect.type === "tracer" || effect.type === "particle") {
        effect.life -= dt;
        if (effect.velocity) effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.material.opacity = clamp(effect.life / effect.maxLife, 0, 1);
        if (effect.life <= 0) {
          this.scene.remove(effect.mesh);
          continue;
        }
      }
      survivors.push(effect);
    }
    this.effects = survivors;
  }

  spawnTracer(start, end, color) {
    const direction = end.clone().sub(start);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.effects.push({ type: "tracer", mesh: line, life: 0.075, maxLife: 0.075 });
  }

  spawnHitParticles(position, color, count) {
    this.spawnBurst(position, color, count, 0.35);
  }

  spawnBurst(position, color, count, force) {
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.07),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.copy(position);
      this.scene.add(mesh);
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(force * (0.6 + Math.random()));
      this.effects.push({ type: "particle", mesh, velocity, life: 0.35 + Math.random() * 0.3, maxLife: 0.65 });
    }
  }

  dropCurrentWeapon() {
    const slot = this.player.activeSlot;
    if (!["primary", "secondary"].includes(slot)) return;
    const weaponId = this.player.loadout[slot];
    if (!weaponId || (slot === "secondary" && weaponId === "p9")) return;
    this.spawnWeaponPickup(weaponId, slot);
    this.player.loadout[slot] = null;
    delete this.player.weaponStates[weaponId];
    this.player.activeSlot = slot === "primary" ? "secondary" : "melee";
    this.rebuildWeaponModel();
  }

  spawnWeaponPickup(weaponId, slot, position = this.player.position) {
    const weapon = getWeapon(weaponId);
    if (!weapon) return null;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, 0.82),
      new THREE.MeshStandardMaterial({ color: weapon.accent, roughness: 0.58, metalness: 0.28 }),
    );
    mesh.position.copy(position).add(new THREE.Vector3(0, 0.2, -0.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw));
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.pickups.push({ mesh, weaponId, slot });
    return mesh;
  }

  checkPickups() {
    if (!this.keys.has("KeyE") || !this.player.alive) return;
    const pickup = this.pickups.find((entry) => entry.mesh.position.distanceTo(this.player.position) < 1.6);
    if (!pickup) return;
    const weapon = getWeapon(pickup.weaponId);
    this.player.loadout[weapon.slot] = weapon.id;
    this.player.weaponStates[weapon.id] = createWeaponState(weapon.id);
    this.player.activeSlot = weapon.slot;
    this.scene.remove(pickup.mesh);
    this.pickups = this.pickups.filter((entry) => entry !== pickup);
    this.rebuildWeaponModel();
    this.toast(`拾取 ${weapon.name}`);
  }

  toggleShop(force) {
    const next = typeof force === "boolean" ? force : !this.shopOpen;
    this.shopOpen = next;
    dom.buyMenu.hidden = !next;
    if (next) {
      document.exitPointerLock?.();
      this.shopRenderKey = "";
      this.renderShopItems(true);
    } else if (!this.paused) this.requestPointerLock();
    this.mouse.hasPointerPosition = false;
    this.syncCursorMode();
  }

  renderShopCategories() {
    const frameButtons = FRAME_LIST.map((frame, index) => `
      <button class="category-button frame-button ${frame.id === this.player.frameId ? "active" : ""}" type="button" data-frame="${frame.id}">
        ${index + 1}. ${frame.name}
      </button>`).join("");
    dom.shopCategories.innerHTML = `<div class="category-heading">战斗框架</div>${frameButtons}<div class="category-heading">武器库</div>${CATEGORY_DEFINITIONS.map((category) => `
      <button class="category-button ${category.id === this.shopCategory ? "active" : ""}" type="button" data-category="${category.id}">
        ${category.shortcut}. ${category.label}
      </button>`).join("")}`;
  }

  renderShopItems(force = false) {
    if (this.shopCategory === "frames") {
      dom.shopMoney.textContent = `当前 · ${getFrame(this.player.frameId).name}`;
      dom.shopStatus.textContent = "常驻配装 · 职业能力在每次复活时保留";
      const renderKey = `frames|${this.player.frameId}`;
      if (!force && renderKey === this.shopRenderKey) return;
      this.shopRenderKey = renderKey;
      dom.shopItems.innerHTML = FRAME_LIST.map((frame) => `
        <article class="shop-item frame-card ${frame.id === this.player.frameId ? "is-equipped" : ""}" style="--frame-accent:${frame.color}">
          <div class="shop-item-head"><h3>${frame.name}</h3><strong class="shop-price">${frame.tag}</strong></div>
          <p>${frame.description}</p><div class="shop-stats"><span>${frame.ability}</span><span>生命 ${frame.health}</span><span>护甲 ${frame.armor}</span></div>
          <button class="buy-item" type="button" data-frame="${frame.id}">${frame.id === this.player.frameId ? "已装备" : "装备框架"}</button>
        </article>`).join("");
      return;
    }
    const items = getItemsByCategory(this.shopCategory);
    const context = this.purchaseContext();
    const renderKey = [
      this.shopCategory,
      this.phase,
      context.grenadeCount,
      this.player.loadout.primary,
      this.player.loadout.secondary,
    ].join("|");
    dom.shopMoney.textContent = `当前 · ${getFrame(this.player.frameId).name}`;
    dom.shopStatus.textContent = "常驻配装 · 选择武器立即装备，旧武器会落在地面";
    if (!force && renderKey === this.shopRenderKey) return;
    this.shopRenderKey = renderKey;
    dom.shopItems.innerHTML = items.map((item) => {
      const blockedReason = this.purchaseBlockReason(item, context);
      const allowed = !blockedReason;
      const buttonLabel = allowed
        ? "购买并装备"
        : blockedReason;
      const progress = item.kind === "firearm" ? this.getWeaponProgress(item.id) : null;
      const stats = item.kind === "firearm"
        ? `<span>伤害 ${item.damage}</span><span>弹匣 ${item.magazine}</span><span>射速 ${Math.round(60 / item.fireInterval)}</span><span>Lv.${progress.level} · ${progress.xp} XP</span>`
        : item.kind === "grenade" ? `<span>范围 ${item.radius}</span><span>上限 ${item.maxCarry}</span>` : `<span>${item.armor ? `护甲 ${item.armor}` : "战术工具"}</span>`;
      return `<article class="shop-item">
        <div class="shop-item-head"><h3>${item.name}</h3><strong class="shop-price">常驻</strong></div>
        <p>${item.description}</p><div class="shop-stats">${stats}</div>
        <button class="buy-item ${allowed ? "" : "is-locked"}" type="button" data-buy="${item.id}" aria-disabled="${allowed ? "false" : "true"}">${buttonLabel}</button>
      </article>`;
    }).join("");
  }

  purchaseContext() {
    const zone = this.player.team === "defense" ? this.map.buyZones.defense : this.map.buyZones.attack;
    return {
      buyPhase: this.phase === "buy" || this.phase === "live" || this.multiplayerMode,
      inBuyZone: zone.contains(this.player.position, 2.4),
      team: this.player.team === "defense" ? "defenders" : "attackers",
      grenadeCount: this.player.loadout.grenades.length,
    };
  }

  purchaseBlockReason(item, context = this.purchaseContext()) {
    if (!item) return "装备不存在";
    if (!context.buyPhase) return "尚未部署";
    if (this.phase !== "live" && !this.multiplayerMode && !context.inBuyZone) return "请返回出生区";
    if (this.phase === "buy" && this.player.money < item.price) return "资金不足";
    if (item.kind === "firearm" && item.slot === "primary" && this.player.frameId) {
      const allowedCategories = {
        assault: ["smg", "rifle"],
        scout: ["smg", "sniper"],
        bulwark: ["shotgun", "heavy"],
        support: ["rifle", "smg"],
      };
      if (!allowedCategories[this.player.frameId]?.includes(item.category)) return "当前框架不兼容";
    }
    if (item.kind === "grenade" && context.grenadeCount >= item.maxCarry) return "已达携带上限";
    if (this.phase === "buy" && !canPurchase(item, this.player.money, context)) return "当前无法购买";
    return null;
  }

  purchase(itemId) {
    if (this.purchaseInProgress) return;
    const item = getShopItem(itemId);
    const context = this.purchaseContext();
    const blockedReason = this.purchaseBlockReason(item, context);
    if (blockedReason) {
      this.toast(blockedReason);
      return;
    }
    this.purchaseInProgress = true;
    if (this.phase === "buy") this.player.money -= item.price;
    if (item.kind === "firearm") {
      const previousWeaponId = this.player.loadout[item.slot];
      if (previousWeaponId && previousWeaponId !== item.id) {
        this.spawnWeaponPickup(previousWeaponId, item.slot);
        delete this.player.weaponStates[previousWeaponId];
      }
      this.player.loadout[item.slot] = item.id;
      this.player.weaponStates[item.id] = createWeaponState(item.id);
      this.player.activeSlot = item.slot;
      this.rebuildWeaponModel();
    }
    if (item.kind === "grenade") this.player.loadout.grenades.push(item.id);
    if (item.kind === "equipment") {
      this.player.armor = Math.max(this.player.armor, item.armor ?? 0);
      this.player.helmet ||= Boolean(item.helmet);
    }
    this.toast(`已购买 ${item.name}`);
    this.playTone(460, 0.06, "square");
    this.purchaseInProgress = false;
    this.renderShopItems(true);
    this.updateHud(true);
  }

  setScoreboard(open) {
    this.scoreboardOpen = open;
    dom.scoreboard.hidden = !open;
    this.mouse.hasPointerPosition = false;
    this.syncCursorMode();
    if (open) this.renderScoreboard();
  }

  renderScoreboard() {
    const actors = [this.player, ...this.bots, ...this.remotePlayers.values()];
    dom.boardScore.textContent = `${this.score.attack} : ${this.score.defense}`;
    const rows = actors.map((actor) => `
      <div class="score-row ${actor === this.player ? "player" : ""}">
        <strong>${actor.team === "attack" ? "◆" : "◇"} ${actor.name}</strong>
        <span>${actor.kills ?? 0}</span><span>${actor.deaths ?? 0}</span><span>${actor.assists ?? 0}</span><span>${getFrame(actor.frameId ?? "assault").name}</span>
      </div>`).join("");
    dom.scoreTable.innerHTML = `<div class="score-row header"><strong>队员</strong><span>击杀</span><span>死亡</span><span>助攻</span><span>框架</span></div>${rows}`;
  }

  updateWeaponHud() {
    const id = this.currentWeaponId();
    const weapon = getWeapon(id);
    if (this.player.activeSlot === "grenade") {
      const grenade = GRENADE_LIST.find((entry) => entry.id === id);
      dom.weaponName.textContent = grenade?.name ?? "投掷物";
      dom.weaponMeta.textContent = grenade?.description ?? "";
      dom.ammoValue.innerHTML = `${this.player.loadout.grenades.length} <span>/ 4</span>`;
      return;
    }
    if (this.player.activeSlot === "melee") {
      dom.weaponName.textContent = "战术方刃";
      dom.weaponMeta.textContent = "近距离快速攻击";
      dom.ammoValue.innerHTML = `∞ <span>近战</span>`;
      return;
    }
    const state = this.currentWeaponState();
    dom.weaponName.textContent = weapon?.name ?? "无武器";
    dom.weaponMeta.textContent = state?.reloading ? "换弹中" : weapon?.description ?? "";
    dom.ammoValue.innerHTML = state ? `${state.ammo} <span>/ ${state.reserve}</span>` : `0 <span>/ 0</span>`;
  }

  updateHud(force = false) {
    const time = nowSeconds();
    if (!force && time - this.lastHudUpdate < 0.08) return;
    this.lastHudUpdate = time;
    dom.attackScore.textContent = String(this.score.attack);
    dom.defendScore.textContent = String(this.score.defense);
    dom.healthValue.textContent = String(Math.ceil(this.player.health));
    dom.armorValue.textContent = String(Math.ceil(this.player.armor));
    dom.healthMeter.style.width = `${clamp(this.player.health, 0, 100)}%`;
    dom.armorMeter.style.width = `${clamp(this.player.armor, 0, 100)}%`;
    const frame = getFrame(this.player.frameId);
    dom.moneyValue.textContent = `框架 · ${frame.name}`;
    const abilityRemaining = Math.max(0, (this.player.abilityCooldownEndsAt ?? 0) - time);
    dom.abilityValue.textContent = abilityRemaining > 0 ? `Q · 冷却 ${Math.ceil(abilityRemaining)}s` : `Q · ${frame.ability}`;
    dom.roundClock.textContent = this.phase === "live" ? "∞" : "--:--";
    dom.phaseLabel.textContent = this.phase === "live" ? "团队歼灭" : this.phase === "post" ? "比赛结束" : "等待部署";
    if (this.phase === "intro") {
      dom.phaseLabel.textContent = "等待部署";
      dom.objectiveBanner.className = "objective-banner";
      dom.objectiveBanner.innerHTML = `<strong>战术演练待命</strong> · 进入战区后开始`;
    } else if (!this.player.alive) {
      const ally = this.bots.find((bot) => bot.team === "attack" && bot.alive);
      dom.objectiveBanner.className = "objective-banner";
      const respawnIn = Math.max(0, Math.ceil(this.player.respawnAt - time));
      dom.objectiveBanner.innerHTML = `<strong>观战 ${ally?.name ?? "队友"}</strong> · ${respawnIn} 秒后复活`;
    } else if (this.phase === "buy") {
      dom.objectiveBanner.className = "objective-banner good";
      dom.objectiveBanner.innerHTML = `<strong>战备阶段</strong> · 按 B 配置框架与武器`;
    } else if (this.phase === "post") {
      dom.objectiveBanner.className = "objective-banner alert";
      dom.objectiveBanner.innerHTML = `<strong>比赛结束</strong> · ${this.score.attack} : ${this.score.defense}`;
    } else {
      dom.objectiveBanner.className = "objective-banner";
      dom.objectiveBanner.innerHTML = `<strong>团队歼灭</strong> · 先到 ${this.killTarget} 分获胜 · Q 使用战术能力`;
    }
    this.updateWeaponHud();
    if (this.shopOpen) this.renderShopItems();
    if (this.scoreboardOpen) this.renderScoreboard();
  }

  toast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    dom.toastStack.append(toast);
    setTimeout(() => toast.remove(), 1700);
  }

  playTone(frequency, duration, type = "sine", volumeScale = 1) {
    if (this.settings.volume <= 0) return;
    try {
      this.audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.028 * this.settings.volume * volumeScale, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      oscillator.connect(gain).connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch {
      // Audio feedback is optional when a browser blocks WebAudio.
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const time = nowSeconds();
    if (!this.paused && this.started && this.phase !== "post") {
      this.updatePlayer(rawDt);
      if (!this.multiplayerMode && this.phase === "live") this.updateBots(rawDt, time);
      this.updateObjective(rawDt, time);
      this.updateRoundState(time);
      this.updateEffects(rawDt, time);
      this.checkPickups();
      this.sendMultiplayerState(time);
      this.physics.step();
    }
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }
}

await RAPIER.init();
const game = new VoxelStrikeGame();
window.__voxelStrike = game;

