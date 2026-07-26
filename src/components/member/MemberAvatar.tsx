import { useState } from "react";

type MemberAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
};

function memberInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MemberAvatar({ name, avatarUrl, className }: MemberAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const imageUrl = avatarUrl?.trim() ?? "";

  return (
    <span className={className}>
      {imageUrl && failedImageUrl !== imageUrl
        ? <img src={imageUrl} alt={name} decoding="async" onError={() => setFailedImageUrl(imageUrl)} />
        : <span aria-hidden="true">{memberInitials(name)}</span>}
    </span>
  );
}
