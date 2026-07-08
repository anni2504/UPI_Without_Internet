import { config } from '../config.js';
import { decrypt, hashCiphertext } from '../crypto/hybridCrypto.service.js';
import { idempotencyService } from './idempotency.service.js';
import * as settlementService from './settlement.service.js';

export async function ingest(packet, bridgeNodeId, hopCount) {
  try {
    const packetHash = hashCiphertext(packet.ciphertext);

    if (!idempotencyService.claim(packetHash)) {
      console.log(
        `DUPLICATE packet ${packetHash.substring(0, 12)}... from bridge ${bridgeNodeId} — dropped`
      );
      return { outcome: 'DUPLICATE_DROPPED', packetHash, reason: null, transactionId: null };
    }

    let instruction;
    try {
      instruction = decrypt(packet.ciphertext);
    } catch (e) {
      console.warn(`Decryption failed for packet ${packetHash.substring(0, 12)}...: ${e.message}`);
      return { outcome: 'INVALID', packetHash, reason: 'decryption_failed', transactionId: null };
    }

    const ageSeconds = Math.floor((Date.now() - instruction.signedAt) / 1000);
    if (ageSeconds > config.packetMaxAgeSeconds) {
      console.warn(`Packet ${packetHash.substring(0, 12)}... too old (${ageSeconds}s), rejected`);
      return { outcome: 'INVALID', packetHash, reason: 'stale_packet', transactionId: null };
    }
    if (ageSeconds < -300) {
      return { outcome: 'INVALID', packetHash, reason: 'future_dated', transactionId: null };
    }

    const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);
    return { outcome: 'SETTLED', packetHash, reason: null, transactionId: tx.id };
  } catch (e) {
    console.error(`Ingestion error: ${e.message}`);
    return { outcome: 'INVALID', packetHash: '?', reason: `internal_error: ${e.message}`, transactionId: null };
  }
}
