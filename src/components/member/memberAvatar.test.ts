import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberAvatar } from "./MemberAvatar";
import { decodeMemberAvatarDataUrl, isAllowedMemberAvatarFile } from "@/lib/memberAvatar";

test("member avatar upload accepts supported images within the size limit", () => {
  assert.equal(isAllowedMemberAvatarFile({ type: "image/png", size: 512 * 1024 }), true);
  assert.equal(isAllowedMemberAvatarFile({ type: "image/jpeg", size: 12_000 }), true);
  assert.equal(isAllowedMemberAvatarFile({ type: "image/webp", size: 12_000 }), true);
});

test("member avatar upload rejects unsupported and oversized files", () => {
  assert.equal(isAllowedMemberAvatarFile({ type: "image/svg+xml", size: 12_000 }), false);
  assert.equal(isAllowedMemberAvatarFile({ type: "image/png", size: (512 * 1024) + 1 }), false);
  assert.equal(isAllowedMemberAvatarFile({ type: "image/png", size: 0 }), false);
});

test("stored member avatars decode to cacheable binary image responses", () => {
  const decoded = decodeMemberAvatarDataUrl("data:image/png;base64,aGVsbG8=");

  assert.equal(decoded?.contentType, "image/png");
  assert.equal(decoded ? new TextDecoder().decode(decoded.bytes) : null, "hello");
  assert.equal(decodeMemberAvatarDataUrl("https://example.com/avatar.png"), null);
  assert.equal(decodeMemberAvatarDataUrl("data:image/svg+xml;base64,aGVsbG8="), null);
});

test("member avatar renders the saved profile image globally", () => {
  const markup = renderToStaticMarkup(
    createElement(MemberAvatar, { name: "Anong Srisuk", avatarUrl: "data:image/png;base64,member-photo" }),
  );

  assert.match(markup, /<img/);
  assert.match(markup, /src="data:image\/png;base64,member-photo"/);
  assert.match(markup, /alt="Anong Srisuk"/);
});

test("member avatar falls back to initials when no image is saved", () => {
  const markup = renderToStaticMarkup(createElement(MemberAvatar, { name: "Anong Srisuk", avatarUrl: null }));

  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, />AS</);
});
