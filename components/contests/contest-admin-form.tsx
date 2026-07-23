import { createContest } from "@/app/(main)/contests/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRADE_LEVELS } from "@/lib/practice/question-bank";

export function ContestAdminForm() {
  const defaultStart = new Date(Date.now() + 10 * 60000);
  defaultStart.setSeconds(0, 0);
  const localValue = new Date(defaultStart.getTime() + 9 * 60 * 60000).toISOString().slice(0, 16);
  return <form action={createContest} className="grid gap-4 sm:grid-cols-2">
    <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="contest-title">대회명</Label><Input id="contest-title" name="title" minLength={2} maxLength={100} required placeholder="예: 중2 수학 주간 챌린지" /></div>
    <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="contest-description">안내</Label><Input id="contest-description" name="description" maxLength={2000} placeholder="대회 규칙과 범위를 적어주세요." /></div>
    <div className="flex flex-col gap-2"><Label>학년</Label><select name="grade_level" className="h-10 rounded-md border border-input bg-background px-3">{GRADE_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}</select></div>
    <div className="flex flex-col gap-2"><Label>과목</Label><select name="subject_id" className="h-10 rounded-md border border-input bg-background px-3"><option value="math">수학</option><option value="english">영어</option><option value="social">사회</option><option value="science">과학</option></select></div>
    <div className="flex flex-col gap-2"><Label htmlFor="contest-start">시작 시각</Label><Input id="contest-start" name="starts_at" type="datetime-local" defaultValue={localValue} required /></div>
    <div className="flex flex-col gap-2"><Label htmlFor="contest-duration">진행 시간(분)</Label><Input id="contest-duration" name="duration_minutes" type="number" min={10} max={240} defaultValue={60} required /></div>
    <Button type="submit" className="sm:col-span-2">10문제 대회 만들기</Button>
  </form>;
}
