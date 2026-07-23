import { Palette } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { normalizeRatingTiers } from "@/lib/battle/rating";
import { saveDeveloperRatingTiers } from "../../actions";
import { RatingTierEditor } from "@/components/developer/rating-tier-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Rating Tier Settings" };

export default async function DeveloperRatingTiersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { admin } = await requireDeveloper();
  const params = await searchParams;
  const { data } = await admin.from("app_settings").select("rating_tiers").eq("id", true).maybeSingle();
  const tiers = normalizeRatingTiers(data?.rating_tiers).map(({ min, max, name, color }) => ({ min, max, name, color }));
  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Palette className="h-6 w-6 text-emerald-400" />Rating Tier Settings</h1><p className="mt-1 text-sm text-zinc-400">0~5000 Rating의 계급 수, 영문 이름, 연속 범위와 표시 색상을 관리합니다.</p></div>
    {params.error && <p className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">범위가 연속되는지, 첫 값이 0이고 마지막 값이 5000인지 확인해주세요.</p>}
    {params.updated && <p className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">Rating 계급 설정을 저장하고 전체 사용자 화면에 반영했습니다.</p>}
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">Global Rating Ladder</CardTitle></CardHeader><CardContent><RatingTierEditor initial={tiers} action={saveDeveloperRatingTiers} /></CardContent></Card>
  </div>;
}
