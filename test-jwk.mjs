import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log('publicKey:', keys.publicKey);
console.log('privateKey:', keys.privateKey);

const pubBuf = Buffer.from(keys.publicKey, 'base64url');
const x = pubBuf.slice(1, 33).toString('base64url');
const y = pubBuf.slice(33, 65).toString('base64url');
const d = keys.privateKey;

const jwk = {
  kty: 'EC',
  crv: 'P-256',
  ext: true,
  x,
  y,
  d
};
console.log('jwk:', jwk);
