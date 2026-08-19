import assert from "node:assert/strict";
import { WebSocket } from "ws";

const url = process.env.VOXEL_WS_URL || "ws://127.0.0.1:4176";
const room = `smoke-${Date.now()}`;

function openPlayer(name) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => reject(new Error(`${name} connection timed out`)), 3000);
    socket.once("open", () => socket.send(JSON.stringify({ type: "join", room, name })));
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type !== "welcome") return;
      clearTimeout(timeout);
      resolve({ socket, welcome: message });
    });
    socket.once("error", reject);
  });
}

function waitFor(socket, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("multiplayer message timed out"));
    }, timeoutMs);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

const first = await openPlayer("SmokeA");
const second = await openPlayer("SmokeB");

try {
  assert.notEqual(first.welcome.team, second.welcome.team, "first two players must join opposing teams");
  const rosterPromise = waitFor(first.socket, (message) => message.type === "snapshot" && message.players?.length === 2);
  second.socket.send(JSON.stringify({ type: "state", position: { x: 20, y: 0.05, z: 0 }, yaw: 0, pitch: 0, weaponId: "p9" }));
  const roster = await rosterPromise;
  assert.equal(roster.players.length, 2);

  const killPromise = waitFor(first.socket, (message) => message.event?.type === "kill");
  first.socket.send(JSON.stringify({ type: "hit", targetId: second.welcome.id, damage: 180, weaponId: "hammer", zone: "head" }));
  const killed = await killPromise;
  assert.equal(killed.event.attackerId, first.welcome.id);
  assert.equal(killed.event.victimId, second.welcome.id);
  assert.equal(killed.score[first.welcome.team], 1, "server must award one team kill point");
  console.log("Voxel Strike multiplayer smoke test: OK");
} finally {
  first.socket.close();
  second.socket.close();
}

