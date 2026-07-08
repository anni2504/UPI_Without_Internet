import { VirtualDevice } from './virtualDevice.js';

class MeshSimulatorService {
  constructor() {
    this.devices = new Map();
    this.seedDefaultDevices();
  }

  seedDefaultDevices() {
    this.devices.set('phone-alice', new VirtualDevice('phone-alice', false));
    this.devices.set('phone-relay1', new VirtualDevice('phone-relay1', false));
    this.devices.set('phone-relay2', new VirtualDevice('phone-relay2', false));
    this.devices.set('phone-relay3', new VirtualDevice('phone-relay3', false));
    this.devices.set('phone-bridge', new VirtualDevice('phone-bridge', true));
  }

  getDevices() {
    return [...this.devices.values()];
  }

  inject(senderDeviceId, packet) {
    const sender = this.devices.get(senderDeviceId);
    if (!sender) {
      throw new Error(`Unknown device: ${senderDeviceId}`);
    }
    sender.hold(packet);
    console.log(
      `Packet ${packet.packetId.substring(0, 8)} injected at ${senderDeviceId} (TTL=${packet.ttl})`
    );
  }

  gossipOnce() {
    let transfers = 0;
    const deviceList = this.getDevices();

    const snapshot = new Map();
    for (const d of deviceList) {
      snapshot.set(d.deviceId, d.getHeldPackets());
    }

    for (const src of deviceList) {
      for (const pkt of snapshot.get(src.deviceId)) {
        if (pkt.ttl <= 0) continue;
        for (const dst of deviceList) {
          if (dst.deviceId === src.deviceId) continue;
          if (dst.holds(pkt.packetId)) continue;

          dst.hold({
            packetId: pkt.packetId,
            ttl: pkt.ttl - 1,
            createdAt: pkt.createdAt,
            ciphertext: pkt.ciphertext,
          });
          transfers++;
        }
      }
    }

    console.log(`Gossip round complete: ${transfers} packet transfers`);
    return { transfers, deviceCounts: this.snapshotMap() };
  }

  snapshotMap() {
    const m = {};
    for (const d of this.devices.values()) {
      m[d.deviceId] = d.packetCount();
    }
    return m;
  }

  collectBridgeUploads() {
    const out = [];
    for (const d of this.devices.values()) {
      if (!d.hasInternet) continue;
      for (const pkt of d.getHeldPackets()) {
        out.push({ bridgeNodeId: d.deviceId, packet: pkt });
      }
    }
    return out;
  }

  resetMesh() {
    for (const d of this.devices.values()) {
      d.clear();
    }
  }
}

export const meshSimulatorService = new MeshSimulatorService();
