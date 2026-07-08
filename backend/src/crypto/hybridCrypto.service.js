import crypto from 'crypto';
import { serverKeyHolder } from './serverKeyHolder.js';

const RSA_ENCRYPTED_KEY_BYTES = 256;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

const rsaOptions = {
  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: 'sha256',
};

export function encrypt(instruction, publicKey = serverKeyHolder.publicKey) {
  const plaintext = Buffer.from(JSON.stringify(instruction));

  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(GCM_IV_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const encryptedAesKey = crypto.publicEncrypt({ key: publicKey, ...rsaOptions }, aesKey);

  if (encryptedAesKey.length !== RSA_ENCRYPTED_KEY_BYTES) {
    throw new Error(`Expected ${RSA_ENCRYPTED_KEY_BYTES}-byte RSA block, got ${encryptedAesKey.length}`);
  }

  return Buffer.concat([encryptedAesKey, iv, encrypted]).toString('base64');
}

export function decrypt(base64Ciphertext) {
  const all = Buffer.from(base64Ciphertext, 'base64');

  if (all.length < RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES + GCM_TAG_BYTES) {
    throw new Error('Ciphertext too short');
  }

  const encryptedAesKey = all.subarray(0, RSA_ENCRYPTED_KEY_BYTES);
  const iv = all.subarray(RSA_ENCRYPTED_KEY_BYTES, RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES);
  const aesCiphertext = all.subarray(RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES);

  const aesKey = crypto.privateDecrypt(
    { key: serverKeyHolder.privateKey, ...rsaOptions },
    encryptedAesKey
  );

  const tag = aesCiphertext.subarray(aesCiphertext.length - GCM_TAG_BYTES);
  const ciphertext = aesCiphertext.subarray(0, aesCiphertext.length - GCM_TAG_BYTES);

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(plaintext.toString('utf8'));
}

export function hashCiphertext(base64Ciphertext) {
  return crypto.createHash('sha256').update(base64Ciphertext).digest('hex');
}

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
