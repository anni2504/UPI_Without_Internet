import crypto from 'crypto';

class ServerKeyHolder {
  constructor() {
    this.keyPair = null;
  }

  init() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });

    this.publicKeyDer = publicKey;
    this.privateKeyDer = privateKey;
    this.publicKey = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
    this.privateKey = crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' });

    const fingerprint = this.getPublicKeyBase64().substring(0, 32);
    console.log(`Server RSA keypair generated (2048-bit). Public key fingerprint: ${fingerprint}...`);
  }

  getPublicKeyBase64() {
    return this.publicKeyDer.toString('base64');
  }
}

export const serverKeyHolder = new ServerKeyHolder();
