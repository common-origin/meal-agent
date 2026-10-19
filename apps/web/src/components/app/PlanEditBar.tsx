"use client";

import { forwardRef, useState, type FormEvent } from "react";
import styled from "styled-components";
import { Button, Stack, Typography } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";

// Docked to the bottom of the viewport while the plan scrolls (#38). Sticky,
// not fixed, so a phone keyboard pushes it up rather than covering it.
const Bar = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 20;
  margin-top: ${tokens.semantic.spacing.layout.lg};
  padding: ${tokens.semantic.spacing.layout.sm} ${tokens.semantic.spacing.layout.md};
  background: ${tokens.semantic.color.background.default};
  border: 1px solid ${tokens.semantic.color.border.strong};
  border-radius: ${tokens.base.border.radius[4]};
`;

const InputRow = styled.form`
  display: flex;
  gap: ${tokens.semantic.spacing.layout.sm};
  align-items: center;
`;

const Input = styled.input`
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 ${tokens.semantic.spacing.layout.sm};
  font: ${tokens.semantic.typography.body};
  font-size: 16px; /* 16px stops iOS zooming in on focus */
  border: 1px solid ${tokens.semantic.color.border.default};
  border-radius: ${tokens.base.border.radius[3]};
  background: ${tokens.semantic.color.background.surface};
  color: ${tokens.semantic.color.text.default};
`;

export interface PlanEditBarProps {
  /** One line: what changed, the model's question, or an error. */
  message?: { text: string; tone: "info" | "error" } | null;
  /** True while a preview is open: Accept and Discard show. */
  previewOpen: boolean;
  /** Nights an accept would change; Accept waits while any are still generating. */
  acceptCount: number;
  acceptPending: boolean;
  onAccept: () => void;
  onDiscard: () => void;
  /** Set after an accept, until the next change: offers Undo. */
  canUndo: boolean;
  onUndo: () => void;
  busy: boolean;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (instruction: string) => void;
}

/** "Tell me what to change…": the plan's edit input, its reply line and its Accept/Discard/Undo (#38). */
const PlanEditBar = forwardRef<HTMLInputElement, PlanEditBarProps>(function PlanEditBar(
  { message, previewOpen, acceptCount, acceptPending, onAccept, onDiscard, canUndo, onUndo, busy, disabled, value, onChange, onSubmit },
  inputRef
) {
  const [empty, setEmpty] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const instruction = value.trim();
    if (!instruction) {
      setEmpty(true);
      return;
    }
    onSubmit(instruction);
  };

  const showActions = previewOpen || canUndo;
  return (
    <Bar role="region" aria-label="Change the plan">
      <Stack direction="column" gap="sm">
        {(message || showActions || empty) && (
          <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between" wrap>
            <div aria-live="polite">
              <Typography variant="small" color={message?.tone === "error" || empty ? "error" : "subdued"}>
                {empty ? "Type what you'd like to change first." : message?.text ?? ""}
              </Typography>
            </div>
            {previewOpen ? (
              <Stack direction="row" gap="sm">
                <Button variant="secondary" size="small" onClick={onDiscard}>
                  Discard
                </Button>
                <Button variant="primary" size="small" onClick={onAccept} disabled={acceptPending || acceptCount === 0}>
                  {acceptPending ? "Generating..." : acceptCount === 1 ? "Accept" : `Accept ${acceptCount} changes`}
                </Button>
              </Stack>
            ) : canUndo ? (
              <Button variant="secondary" size="small" onClick={onUndo}>
                Undo
              </Button>
            ) : null}
          </Stack>
        )}
        <InputRow onSubmit={submit}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setEmpty(false);
              onChange(e.target.value);
            }}
            placeholder={previewOpen ? "Refine it, e.g. no, something with fish" : "Tell me what to change, e.g. swap Tuesday for something lighter"}
            aria-label="Tell me what to change"
            maxLength={300}
            disabled={disabled}
            enterKeyHint="send"
          />
          <Button variant="primary" size="medium" type="submit" disabled={busy || disabled}>
            {busy ? "Working..." : "Send"}
          </Button>
        </InputRow>
      </Stack>
    </Bar>
  );
});

export default PlanEditBar;
