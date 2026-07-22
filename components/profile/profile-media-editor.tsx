"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

const BUCKET = "profile-media";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function ProfileMediaEditor({
  userId,
  nickname,
  avatarUrl,
  bannerUrl,
}: {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}) {
  const t = useTranslations("profile");
  const [avatar, setAvatar] = useState(avatarUrl);
  const [banner, setBanner] = useState(bannerUrl);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function upload(kind: "avatar" | "banner", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
      setError(t("imageInvalid"));
      return;
    }

    setUploading(kind);
    setError(null);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${kind}-${crypto.randomUUID()}.${extension}`;
    const oldUrl = kind === "avatar" ? avatar : banner;

    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const column = kind === "avatar" ? "avatar_url" : "banner_url";
      const { error: profileError } = await supabase.from("profiles").update({ [column]: data.publicUrl }).eq("id", userId);
      if (profileError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw profileError;
      }

      if (kind === "avatar") setAvatar(data.publicUrl);
      else setBanner(data.publicUrl);

      const oldPath = storagePath(oldUrl);
      if (oldPath?.startsWith(`${userId}/`)) void supabase.storage.from(BUCKET).remove([oldPath]);
    } catch {
      setError(t("imageUploadError"));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div>
      <div
        className="group relative h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/70 to-accent"
        style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <button
          type="button"
          onClick={() => bannerInput.current?.click()}
          disabled={uploading !== null}
          className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all hover:bg-black/30 hover:opacity-100 focus-visible:bg-black/30 focus-visible:opacity-100"
          aria-label={t("changeBanner")}
        >
          {uploading === "banner" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
        </button>
      </div>

      <div className="-mt-16 flex items-end gap-4 px-2">
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          disabled={uploading !== null}
          className={cn(
            "group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-secondary text-3xl font-bold",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label={t("changeAvatar")}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : nickname?.[0] ?? "?"}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {uploading === "avatar" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          </span>
        </button>
        <p className="mb-1 text-xs text-muted-foreground">{t("imageHint")}</p>
      </div>

      {error && <p role="alert" className="mx-2 mt-2 text-xs text-destructive">{error}</p>}
      <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => upload("avatar", event)} />
      <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => upload("banner", event)} />
    </div>
  );
}

function storagePath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  const path = index === -1 ? undefined : url.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}
