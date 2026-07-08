import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { serverKeyHolder } from '../src/crypto/serverKeyHolder.js';
import { encrypt, decrypt } from '../src/crypto/hybridCrypto.service.js';
import { idempotencyService } from '../src/services/idempotency.service.js';
import * as demoService from '../src/services/demo.service.js';
import * as bridgeIngestionService from '../src/services/bridgeIngestion.service.js';
import { Account } from '../src/models/Account.js';

let memoryServer;

before(async () => {
  serverKeyHolder.init();
  memoryServer = await MongoMemoryReplSet.create({
    replSet: { storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(memoryServer.getUri('upimesh'));
  await demoService.seedAccounts();
});

beforeEach(() => {
  idempotencyService.clear();
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

function decimalToNumber(value) {
  return parseFloat(value.toString());
}

describe('IdempotencyConcurrency', () => {
  it('encryptDecryptRoundTrip', () => {
    const original = {
      senderVpa: 'alice@demo',
      receiverVpa: 'bob@demo',
      amount: 123.45,
      pinHash: 'abcdef',
      nonce: 'nonce-1',
      signedAt: Date.now(),
    };

    const ct = encrypt(original, serverKeyHolder.publicKey);
    const decrypted = decrypt(ct);

    assert.equal(decrypted.senderVpa, original.senderVpa);
    assert.equal(decrypted.receiverVpa, original.receiverVpa);
    assert.equal(decrypted.amount, original.amount);
    assert.equal(decrypted.nonce, original.nonce);
  });

  it('tamperedCiphertextIsRejected', async () => {
    const packet = demoService.createPacket('alice@demo', 'bob@demo', 50, '1234', 5);
    const chars = [...packet.ciphertext];
    const mid = Math.floor(chars.length / 2);
    chars[mid] = chars[mid] === 'A' ? 'B' : 'A';
    packet.ciphertext = chars.join('');

    const r = await bridgeIngestionService.ingest(packet, 'bridge-x', 1);
    assert.equal(r.outcome, 'INVALID');
  });

  it('singlePacketDeliveredByThreeBridgesSettlesExactlyOnce', async () => {
    const aliceBefore = decimalToNumber((await Account.findOne({ vpa: 'alice@demo' })).balance);
    const bobBefore = decimalToNumber((await Account.findOne({ vpa: 'bob@demo' })).balance);

    const packet = demoService.createPacket('alice@demo', 'bob@demo', 100, '1234', 5);

    let settled = 0;
    let duplicates = 0;

    const results = await Promise.all(
      ['bridge-0', 'bridge-1', 'bridge-2'].map((node) =>
        bridgeIngestionService.ingest(packet, node, 3)
      )
    );

    for (const r of results) {
      if (r.outcome === 'SETTLED') settled++;
      if (r.outcome === 'DUPLICATE_DROPPED') duplicates++;
    }

    assert.equal(settled, 1, 'exactly one bridge should settle');
    assert.equal(duplicates, 2, 'the other two should be duplicates');

    const aliceAfter = decimalToNumber((await Account.findOne({ vpa: 'alice@demo' })).balance);
    const bobAfter = decimalToNumber((await Account.findOne({ vpa: 'bob@demo' })).balance);

    assert.equal(aliceAfter, aliceBefore - 100);
    assert.equal(bobAfter, bobBefore + 100);
  });
});
