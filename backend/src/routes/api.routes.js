import { Router } from 'express';
import { serverKeyHolder } from '../crypto/serverKeyHolder.js';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import * as demoService from '../services/demo.service.js';
import { meshSimulatorService } from '../services/meshSimulator.service.js';
import * as bridgeIngestionService from '../services/bridgeIngestion.service.js';
import { idempotencyService } from '../services/idempotency.service.js';

const router = Router();

router.get('/server-key', (_req, res) => {
  res.json({
    publicKey: serverKeyHolder.getPublicKeyBase64(),
    algorithm: 'RSA-2048 / OAEP-SHA256',
    hybridScheme: 'RSA-OAEP encrypts an AES-256-GCM session key',
  });
});

router.post('/demo/send', (req, res) => {
  try {
    const { senderVpa, receiverVpa, amount, pin, ttl, startDevice } = req.body;
    const packet = demoService.createPacket(
      senderVpa,
      receiverVpa,
      amount,
      pin,
      ttl == null ? 5 : ttl
    );

    const device = startDevice == null ? 'phone-alice' : startDevice;
    meshSimulatorService.inject(device, packet);

    res.json({
      packetId: packet.packetId,
      ciphertextPreview: packet.ciphertext.substring(0, 64) + '...',
      ttl: packet.ttl,
      injectedAt: device,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mesh/state', (_req, res) => {
  const deviceData = meshSimulatorService.getDevices().map((d) => ({
    deviceId: d.deviceId,
    hasInternet: d.hasInternet,
    packetCount: d.packetCount(),
    packetIds: d.getHeldPackets().map((p) => p.packetId.substring(0, 8)),
  }));

  res.json({
    devices: deviceData,
    idempotencyCacheSize: idempotencyService.size(),
  });
});

router.post('/mesh/gossip', (_req, res) => {
  const result = meshSimulatorService.gossipOnce();
  res.json({
    transfers: result.transfers,
    deviceCounts: result.deviceCounts,
  });
});

router.post('/mesh/flush', async (_req, res) => {
  const uploads = meshSimulatorService.collectBridgeUploads();

  const results = await Promise.all(
    uploads.map(async (up) => {
      const r = await bridgeIngestionService.ingest(
        up.packet,
        up.bridgeNodeId,
        5 - up.packet.ttl
      );
      return {
        bridgeNode: up.bridgeNodeId,
        packetId: up.packet.packetId.substring(0, 8),
        outcome: r.outcome,
        reason: r.reason == null ? '' : r.reason,
        transactionId: r.transactionId == null ? -1 : r.transactionId,
      };
    })
  );

  res.json({
    uploadsAttempted: uploads.length,
    results,
  });
});

router.post('/mesh/reset', (_req, res) => {
  meshSimulatorService.resetMesh();
  idempotencyService.clear();
  res.json({ status: 'mesh and idempotency cache cleared' });
});

router.post('/bridge/ingest', async (req, res) => {
  const bridgeNodeId = req.get('X-Bridge-Node-Id') || 'unknown';
  const hopCount = parseInt(req.get('X-Hop-Count') || '0', 10);
  const result = await bridgeIngestionService.ingest(req.body, bridgeNodeId, hopCount);
  res.json(result);
});

router.get('/accounts', async (_req, res) => {
  const accounts = await Account.find().lean();
  res.json(
    accounts.map((a) => ({
      vpa: a.vpa,
      holderName: a.holderName,
      balance: parseFloat(a.balance.toString()),
      version: a.version,
    }))
  );
});

router.get('/transactions', async (_req, res) => {
  const txs = await Transaction.find().sort({ id: -1 }).limit(20).lean();
  res.json(
    txs.map((t) => ({
      id: t.id,
      packetHash: t.packetHash,
      senderVpa: t.senderVpa,
      receiverVpa: t.receiverVpa,
      amount: parseFloat(t.amount.toString()),
      signedAt: new Date(t.signedAt).toISOString(),
      settledAt: new Date(t.settledAt).toISOString(),
      bridgeNodeId: t.bridgeNodeId,
      hopCount: t.hopCount,
      status: t.status,
    }))
  );
});

export default router;
