-- ---------------------------------------------------------------------------
-- 로그인/가입 시도에 대한 앱 레벨 rate limiting을 위한 기록 테이블.
-- Vercel 서버리스 환경에서는 인스턴스가 여러 개라 인메모리 카운터를 못 쓰므로,
-- 이미 쓰고 있는 Supabase에 기록해 여러 인스턴스에서도 일관되게 카운트한다.
-- 사용자 소유 데이터가 아니라 service_role(admin 클라이언트)로만 접근하므로
-- RLS는 켜두되 별도 정책 없이 기본 거부(anon/authenticated 접근 불가)로 둔다.
-- ---------------------------------------------------------------------------

create table public.auth_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index auth_attempts_key_created_idx on public.auth_attempts (key, created_at);

alter table public.auth_attempts enable row level security;
