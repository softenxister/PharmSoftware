import { requireAuthenticatedUser } from '@server/auth/pharmUser';
import { readQzCredentials, signQzMessage, validQzRequest } from '@server/hardware/qzSigning';

export async function GET() {
  try { await requireAuthenticatedUser(); }
  catch { return Response.json({ error: 'Sign in to use counter hardware.' }, { status: 401 }); }
  try {
    const { certificate } = await readQzCredentials();
    return new Response(certificate, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Counter signing is not configured or its certificate has expired. Run the counter signing setup on the server.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // The browser must originate the signing request from Pharm itself. Do not
  // accept cross-site requests or expose an arbitrary digest-signing endpoint.
  const origin = request.headers.get('origin');
  const expected = process.env.PHARM_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site'
      || !request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'Hardware signing requires a same-origin request.' }, { status: 403 });
  }
  try { await requireAuthenticatedUser(); }
  catch { return Response.json({ error: 'Sign in to use counter hardware.' }, { status: 401 }); }
  const message = await request.text();
  try {
    if (Buffer.byteLength(message) > 2 * 1024 * 1024 || !validQzRequest(JSON.parse(message))) throw new Error();
  } catch {
    return Response.json({ error: 'This hardware request is not supported or has expired.' }, { status: 400 });
  }
  try {
    const { key } = await readQzCredentials();
    return new Response(signQzMessage(message, key), { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Counter signing is unavailable. Check the server signing certificate.' }, { status: 503 });
  }
}
