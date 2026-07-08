import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { encrypt, sha256Hex } from '../crypto/hybridCrypto.service.js';
import { serverKeyHolder } from '../crypto/serverKeyHolder.js';

function money(value) {
  return mongoose.Types.Decimal128.fromString(Number(value).toFixed(2));
}

export async function seedAccounts() {
  const count = await Account.countDocuments();
  if (count === 0) {
    await Account.insertMany([
      { vpa: 'alice@demo', holderName: 'Alice', balance: money(5000), version: 0 },
      { vpa: 'bob@demo', holderName: 'Bob', balance: money(1000), version: 0 },
      { vpa: 'carol@demo', holderName: 'Carol', balance: money(2500), version: 0 },
      { vpa: 'dave@demo', holderName: 'Dave', balance: money(500), version: 0 },
    ]);
    console.log('Seeded 4 demo accounts');
  }
}

export function createPacket(senderVpa, receiverVpa, amount, pin, ttl) {
  const instruction = {
    senderVpa,
    receiverVpa,
    amount: Number(amount),
    pinHash: sha256Hex(pin),
    nonce: randomUUID(),
    signedAt: Date.now(),
  };

  const ciphertext = encrypt(instruction, serverKeyHolder.publicKey);

  return {
    packetId: randomUUID(),
    ttl,
    createdAt: Date.now(),
    ciphertext,
  };
}
