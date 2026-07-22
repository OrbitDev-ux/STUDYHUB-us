"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface ExportRow {
  date: string;
  study_minutes: number;
  goal_achievement_rate: number;
  recommended_next: string | null;
}

export function ReportTools({ history }: { history: ExportRow[] }) {
  const t = useTranslations("report");

  function downloadCsv() {
    const rows = [
      [t("csvDate"), t("studyMinutesLabel"), t("csvGoalRate"), t("recommendedNext")],
      ...history.map((item) => [item.date, item.study_minutes, item.goal_achievement_rate, item.recommended_next ?? ""]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `studyhub-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={history.length === 0}>
        <Download className="h-4 w-4" /> {t("downloadCsv")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> {t("printReport")}
      </Button>
    </div>
  );
}

function csvCell(value: string | number): string {
  let text = String(value).replace(/"/g, '""');
  // 스프레드시트 수식 주입 방지
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text}"`;
}
