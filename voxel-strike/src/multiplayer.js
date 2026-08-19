export class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.id = null;
    this.room = null;
    this.team = null;
    this.connected = false;
    this.listeners = new Map();
  }

  on(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, payload) {
    this.listeners.get(type)?.(payload);
  }

  connect({ url, room, name }) {
    this.disconnect();
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("连接超时"));
      }, 6000);

      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ type: "join", room, name }));
      });
      socket.addEventListener("message", (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "welcome") {
          clearTimeout(timeout);
          this.id = message.id;
          this.room = message.room;
          this.team = message.team;
          this.connected = true;
          resolve(message);
        }
        this.emit(message.type, message);
      });
      socket.addEventListener("close", () => {
        clearTimeout(timeout);
        const wasConnected = this.connected;
        this.connected = false;
        if (wasConnected) this.emit("disconnect", {});
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        if (!this.connected) reject(new Error("无法连接房间服务器"));
      });
    });
  }

  send(type, payload = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, ...payload }));
  }

  sendState(state) {
    this.send("state", state);
  }

  sendHit(targetId, damage, weaponId, zone) {
    this.send("hit", { targetId, damage, weaponId, zone });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    this.id = null;
    this.room = null;
    this.team = null;
  }
}

