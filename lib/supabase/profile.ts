import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * 요청(렌더) 하나 안에서 layout.tsx와 각 page.tsx가 같은 유저의 profiles 행을
 * 각자 다시 조회하던 것을, React의 요청 단위 캐시로 묶어 한 번만 쿼리하게 한다.
 * 인자를 userId(문자열)로만 두어야 React.cache()가 호출부마다 같은 결과로 묶인다.
 */
export const getCachedProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
});
