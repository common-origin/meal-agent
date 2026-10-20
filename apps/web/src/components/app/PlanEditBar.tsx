"use client";

import { AgentInput, Box, Button, Stack } from "@common-origin/design-system";

/** Shown under the input until there's a reply. */
const DEFAULT_STATUS = "Change any night, add one or drop one. Press Enter to send.";

/** Test id on the AgentInput; the plan page uses it to focus the field from "Change". */
export const PLAN_EDIT_INPUT_TEST_ID = "plan-edit-input";

export interface PlanEditBarProps {
  /** One line under the input: what changed, the model's question, or an error. */
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
  /**
   * Resolves once the instruction is handled (AgentInput then clears the
   * field); rejects if it couldn't be, so AgentInput keeps the text.
   */
  onSubmit: (instruction: string) => Promise<void>;
}

/**
 * The plan's edit input, docked at the bottom of the viewport (#38): the
 * design system's AgentInput, with Accept, Discard and Undo above it. The
 * dock is a sticky Box, so a phone keyboard pushes it up rather than
 * covering it.
 */
export default function PlanEditBar({
  message,
  previewOpen,
  acceptCount,
  acceptPending,
  onAccept,
  onDiscard,
  canUndo,
  onUndo,
  busy,
  disabled,
  value,
  onChange,
  onSubmit,
}: PlanEditBarProps) {
  return (
    <Box
      position="sticky"
      bottom="0"
      mt="lg"
      p="md"
      bg="default"
      border="strong"
      borderRadius="lg"
      role="region"
      aria-label="Change the plan"
      style={{ zIndex: 20 }}
    >
      <Stack direction="column" gap="sm">
        {previewOpen ? (
          <Stack direction="row" gap="sm" justifyContent="flex-end">
            <Button variant="secondary" size="small" onClick={onDiscard}>
              Discard
            </Button>
            <Button variant="primary" size="small" onClick={onAccept} disabled={acceptPending || acceptCount === 0}>
              {acceptPending ? "Generating..." : acceptCount === 1 ? "Accept" : `Accept ${acceptCount} changes`}
            </Button>
          </Stack>
        ) : canUndo ? (
          <Stack direction="row" gap="sm" justifyContent="flex-end">
            <Button variant="secondary" size="small" onClick={onUndo}>
              Undo
            </Button>
          </Stack>
        ) : null}
        <AgentInput
          label="Tell me what to change"
          value={value}
          onChange={onChange}
          onSubmit={({ text }) => onSubmit(text.trim())}
          placeholder={
            previewOpen
              ? "Refine it, e.g. no, something with fish"
              : "Tell me what to change, e.g. swap Tuesday for something lighter"
          }
          // Voice is on by default in AgentInput; where the browser can't do it, it replaces the
          // status line with "not supported". Off until the household decides they want it.
          enableVoice={false}
          isSubmitting={busy}
          disabled={disabled}
          // Always set: AgentInput's built-in helper is banking copy ("Ask about transactions…").
          statusMessage={message?.tone === "info" ? message.text : DEFAULT_STATUS}
          // A failed submit rejects, which puts AgentInput in its error state: it keeps the
          // typed text and shows this in its status line (with its own fallback copy if unset).
          errorMessage={message?.tone === "error" ? message.text : undefined}
          data-testid={PLAN_EDIT_INPUT_TEST_ID}
        />
      </Stack>
    </Box>
  );
}
