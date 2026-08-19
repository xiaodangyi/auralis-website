import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 4176);
const KILL_TARGET = 100;
const RESPAWN_MS = 3000;
const rooms = new Map();

const safeText = (value, fallback, maxLength = 18) => {
  const text = String(value ?? "").trim().replace(/[^\p{L}\p{N}_-]/gu, "");
  return text.slice(0, maxLength) || fallback;
};
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { id: roomId, players: new Map(), score: { attack: 0, defense: 0 }, winner: null });
  return rooms.get(roomId);
}

function chooseTeam(room) {
  const counts = { attack: 0, defense: 0 };
  for (const player of room.players.values()) counts[player.team] += 1;
  return counts.attack <= counts.defense ? "attack" : "defense";
}

function spawnFor(team, index = 0) {
  const z = [-8, -3, 3, 8, 0][index % 5];
  return { x: team === "attack" ? -25 : 25, y: 0.05, z };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    position: player.position,
    yaw: player.yaw,
    pitch: player.pitch,
    weaponId: player.weaponId,
    frameId: player.frameId,
    health: player.health,
    armor: player.armor,
    alive: player.alive,
    kills: player.kills,
    deaths: player.deaths,
    respawnAt: player.respawnAt,
    spawnProtectedUntil: player.spawnProtectedUntil,
  };
}

function snapshot(room) {
  return {
    type: "snapshot",
    room: room.id,
    score: room.score,
    target: KILL_TARGET,
    winner: room.winner,
    players: [...room.players.values()].map(publicPlayer),
  };
}

function broadcast(room, message = snapshot(room)) {
  const payload = JSON.stringify(message);
  for (const player of room.players.values()) {
    if (player.socket.readyState === WebSocket.OPEN) player.socket.send(payload);
  }
}

function handleJoin(socket, message) {
  const roomId = safeText(message.room, "public", 12).toLowerCase();
  const room = getRoom(roomId);
  const id = randomUUID();
  const team = chooseTeam(room);
  const teamIndex = [...room.players.values()].filter((player) => player.team === team).length;
  const player = {
    id,
    socket,
    room,
    name: safeText(message.name, `玩家${room.players.size + 1}`),
    team,
    position: spawnFor(team, teamIndex),
    yaw: team === "attack" ? -Math.PI / 2 : Math.PI / 2,
    pitch: 0,
    weaponId: "p9",
    frameId: safeText(message.frameId, "assault", 16),
    health: 100,
    armor: 0,
    alive: true,
    kills: 0,
    deaths: 0,
    respawnAt: 0,
    // Initial deployment can be tested immediately; protection starts after a respawn.
    spawnProtectedUntil: 0,
    lastHitAt: 0,
  };
  room.players.set(id, player);
  socket.player = player;
  socket.send(JSON.stringify({ type: "welcome", id, room: roomId, team, score: room.score, target: KILL_TARGET }));
  broadcast(room);
}

function handleState(player, message) {
  if (!player.alive) return;
  const position = message.position ?? {};
  player.position = {
    x: clamp(finite(position.x), -28.5, 28.5),
    y: clamp(finite(position.y, 0.05), 0.05, 8),
    z: clamp(finite(position.z), -22.5, 22.5),
  };
  player.yaw = finite(message.yaw);
  player.pitch = clamp(finite(message.pitch), -1.42, 1.42);
  player.weaponId = safeText(message.weaponId, "p9", 24);
  player.frameId = safeText(message.frameId, player.frameId, 16);
  broadcast(player.room);
}

function restartRoom(room) {
  room.score = { attack: 0, defense: 0 };
  room.winner = null;
  const teamCounts = { attack: 0, defense: 0 };
  for (const player of room.players.values()) {
    const spawn = spawnFor(player.team, teamCounts[player.team]++);
    player.position = spawn;
    player.health = 100;
    player.armor = 0;
    player.alive = true;
    player.kills = 0;
    player.deaths = 0;
    player.respawnAt = 0;
    player.spawnProtectedUntil = Date.now() + 2000;
  }
  broadcast(room, { ...snapshot(room), event: { type: "restart" } });
}

function handleHit(attacker, message) {
  const room = attacker.room;
  if (!attacker.alive || room.winner) return;
  const target = room.players.get(String(message.targetId));
  if (!target?.alive || target.team === attacker.team) return;
  if (target.spawnProtectedUntil > Date.now()) return;
  const now = Date.now();
  if (now - attacker.lastHitAt < 35) return;
  attacker.lastHitAt = now;
  target.health -= clamp(finite(message.damage), 1, 180);
  if (target.health > 0) return;
  target.health = 0;
  target.alive = false;
  target.deaths += 1;
  target.respawnAt = now + RESPAWN_MS;
  attacker.kills += 1;
  room.score[attacker.team] += 1;
  if (room.score[attacker.team] >= KILL_TARGET) room.winner = attacker.team;
  broadcast(room, {
    ...snapshot(room),
    event: { type: "kill", attackerId: attacker.id, victimId: target.id, weaponId: safeText(message.weaponId, "p9"), zone: message.zone === "head" ? "head" : "body" },
  });
}

const server = new WebSocketServer({ port: PORT, host: "0.0.0.0" });
server.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (!socket.player && message.type === "join") return handleJoin(socket, message);
    if (!socket.player) return;
    if (message.type === "state") handleState(socket.player, message);
    if (message.type === "hit") handleHit(socket.player, message);
    if (message.type === "restart") restartRoom(socket.player.room);
  });
  socket.on("close", () => {
    const player = socket.player;
    if (!player) return;
    player.room.players.delete(player.id);
    broadcast(player.room);
    if (!player.room.players.size) rooms.delete(player.room.id);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    let changed = false;
    for (const player of room.players.values()) {
      if (!room.winner && !player.alive && now >= player.respawnAt) {
        player.alive = true;
        player.health = 100;
        player.position = spawnFor(player.team, player.kills + player.deaths);
        player.respawnAt = 0;
        player.spawnProtectedUntil = now + 2000;
        changed = true;
      }
    }
    if (changed) broadcast(room);
  }
}, 200);

console.log(`Voxel Strike multiplayer server: ws://0.0.0.0:${PORT}`);

