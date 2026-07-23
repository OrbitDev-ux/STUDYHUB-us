"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({ message }: { message: string }) {
  return <Button
    type="submit"
    size="sm"
    variant="destructive"
    onClick={(event) => {
      if (!window.confirm(message)) event.preventDefault();
    }}
  >
    <Trash2 className="h-3.5 w-3.5" />
    삭제
  </Button>;
}
