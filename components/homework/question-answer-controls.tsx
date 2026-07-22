"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuestionAnswerControls({
  type,
  choices,
  disabled,
  onAnswer,
  submitLabel,
  placeholder,
}: {
  type: string;
  choices: string[] | null;
  disabled?: boolean;
  onAnswer: (answer: string) => Promise<void> | void;
  submitLabel: string;
  placeholder: string;
}) {
  const [answer, setAnswer] = useState("");
  const selectableChoices = choices?.filter(Boolean) ?? (type === "ox" ? ["O", "X"] : []);

  if (selectableChoices.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {selectableChoices.map((choice) => (
          <Button
            key={choice}
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-auto justify-start whitespace-normal py-3 text-left"
            onClick={() => onAnswer(choice)}
          >
            {choice}
          </Button>
        ))}
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = answer.trim();
    if (!value || disabled) return;
    void onAnswer(value);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={placeholder}
      />
      <Button type="submit" disabled={disabled || !answer.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
