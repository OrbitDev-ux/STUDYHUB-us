import { activityLevel, type ActivityDay } from "@/lib/streak/activity";

const LEVEL_STYLES = [
  "bg-secondary", "bg-emerald-200 dark:bg-emerald-950", "bg-emerald-400 dark:bg-emerald-800",
  "bg-emerald-600 dark:bg-emerald-600", "bg-emerald-800 dark:bg-emerald-400",
];

export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const monthLabels = new Map<number, string>();
  days.forEach((day, index) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    if (date.getUTCDate() <= 7 && date.getUTCDay() === 0) {
      monthLabels.set(Math.floor(index / 7), `${date.getUTCMonth() + 1}월`);
    }
  });
  const weekCount = Math.ceil(days.length / 7);

  return <div className="overflow-x-auto pb-2">
    <div className="min-w-[760px]">
      <div className="mb-2 ml-8 grid text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))` }}>
        {Array.from({ length: weekCount }, (_, week) => <span key={week}>{monthLabels.get(week) ?? ""}</span>)}
      </div>
      <div className="flex gap-2">
        <div className="grid h-[98px] grid-rows-7 gap-1 text-[9px] text-muted-foreground"><span /><span>월</span><span /><span>수</span><span /><span>금</span><span /></div>
        <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
          {days.map((day) => {
            const level = activityLevel(day.score);
            const description = `${day.date} · ${day.minutes}분 · ${day.problems}문제 · 완료 ${day.completions}개`;
            return <div key={day.date} title={description} aria-label={description} className={`aspect-square min-h-[10px] min-w-[10px] rounded-[3px] border border-black/5 ${LEVEL_STYLES[level]}`} />;
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><span className="mr-1">적음</span>{LEVEL_STYLES.map((style, index) => <span key={index} className={`h-3 w-3 rounded-[3px] ${style}`} />)}<span className="ml-1">많음</span></div>
    </div>
  </div>;
}
