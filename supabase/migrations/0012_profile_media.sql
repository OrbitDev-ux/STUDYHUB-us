-- 프로필 아바타/배너 업로드용 공개 버킷.
-- 파일 쓰기/삭제는 경로 첫 구간이 본인 UUID인 경우에만 허용한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_media_public_read" on storage.objects;
create policy "profile_media_public_read"
on storage.objects for select
using (bucket_id = 'profile-media');

drop policy if exists "profile_media_insert_own" on storage.objects;
create policy "profile_media_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_media_update_own" on storage.objects;
create policy "profile_media_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_media_delete_own" on storage.objects;
create policy "profile_media_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
