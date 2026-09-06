export interface QzSigningBridge {
  api: { setSha256Type(hasher: (message: string) => Promise<string>): void };
  security: {
    setCertificatePromise(resolver: (resolve: (certificate: string) => void, reject: (error: unknown) => void) => void, rejectOnFailure?: boolean): void;
    setSignatureAlgorithm(algorithm: string): void;
    setSignaturePromise(factory: (message: string) => (resolve: (signature: string) => void, reject: (error: unknown) => void) => void): void;
  };
}

const configured = new WeakSet<QzSigningBridge>();
async function readSigningResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Unable to authorize hardware request. Sign in and check the counter signing setup.');
  }
  return response.text();
}

export function configureQzSigning(qz: QzSigningBridge) {
  if (configured.has(qz)) return;
  qz.security.setCertificatePromise((resolve, reject) => {
    fetch('/api/hardware/qz-certificate', { cache: 'no-store', credentials: 'same-origin' })
      .then(readSigningResponse).then(resolve, reject);
  }, true);
  qz.security.setSignatureAlgorithm('SHA512');
  // Defer SHA-256 hashing to the server so it can validate the complete request
  // before signing its digest. QZ still receives the normal RSA/SHA-512 signature.
  qz.api.setSha256Type(async message => message);
  qz.security.setSignaturePromise(message => (resolve, reject) => {
    fetch('/api/hardware/qz-sign', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: message,
    }).then(readSigningResponse).then(resolve, reject);
  });
  configured.add(qz);
}
