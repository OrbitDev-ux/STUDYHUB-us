"use client";

import { useState } from "react";
import { CheckSquare2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BulkAuditSelectAll() {
  const [selected, setSelected] = useState(false);
  function toggle() {
    const next = !selected;
    document
      .querySelectorAll<HTMLInputElement>('input[form="bulk-audit-form"][name="audit_log_id"]')
      .forEach((checkbox) => { checkbox.checked = next; });
    setSelected(next);
  }
  return <Button type="button" size="sm" variant="outline" onClick={toggle}>
    {selected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare2 className="h-3.5 w-3.5" />}
    {selected ? "전체 해제" : "현재 페이지 전체 선택"}
  </Button>;
}
