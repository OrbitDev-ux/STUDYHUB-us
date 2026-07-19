"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** 폼 제출 중엔 버튼을 비활성화해 중복 제출(연타로 인한 중복 요청)을 막는다. */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {children}
    </Button>
  );
}
