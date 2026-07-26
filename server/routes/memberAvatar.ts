import { decodeMemberAvatarDataUrl } from "@/lib/memberAvatar";
import { requireAuthenticatedUser } from "@server/auth/pharmUser";
import { readMemberAvatar } from "@server/db/memberRepository";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const memberId = new URL(request.url).searchParams.get("memberId")?.trim();
  if (!memberId || memberId.length > 200) {
    return Response.json({ error: "Member id is invalid." }, { status: 400 });
  }

  try {
    const storedAvatar = await readMemberAvatar(memberId);
    const avatar = storedAvatar ? decodeMemberAvatarDataUrl(storedAvatar) : null;
    if (!avatar) return Response.json({ error: "Member avatar was not found." }, { status: 404 });
    const body = new ArrayBuffer(avatar.bytes.byteLength);
    new Uint8Array(body).set(avatar.bytes);

    return new Response(body, {
      headers: {
        "cache-control": "private, max-age=31536000, immutable",
        "content-length": String(avatar.bytes.byteLength),
        "content-type": avatar.contentType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Unable to load member avatar." }, { status: 500 });
  }
}
