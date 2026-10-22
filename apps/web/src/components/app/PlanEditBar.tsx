"use client";

import { forwardRef } from "react";
import { AgentInput, type AgentInputHandle, type AgentInputProps } from "@common-origin/design-system";

// The package exports AgentInputProps but not its review type.
type AgentInputReview = NonNullable<AgentInputProps["review"]>;

/** Shown under the input until there's a reply. */
const HELPER_TEXT = "Change any night, add one or drop one. Press Enter to send.";

/** The edit API's instruction limit (editPlanSchema). */
export const PLAN_EDIT_MAX_LENGTH = 300;

export interface PlanEditBarProps {
  /** One line under the input: what changed, the model's question, or an error. */
  message?: { text: string; tone: "info" | "error" } | null;
  /**
   * The open preview, if any. `id` changes with every refinement, so AgentInput
   * announces a replacement. The review bar shows once nothing is still
   * generating (AgentInput's Accept can't be disabled) and at least one night
   * would change; a failed night is retried or kept from the list itself.
   */
  preview?: { id: string; changeCount: number; pending: boolean } | null;
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

/** What the review bar says about a preview: the nights an accept would change. */
function proposalSummary(changeCount: number): string {
  return changeCount === 1 ? "1 night changes" : `${changeCount} nights change`;
}

/**
 * The plan's edit input, docked at the bottom of the page (#38): the design
 * system's AgentInput, with its review bar for Accept, Discard and Undo. The
 * ref is AgentInput's handle, so "Change" on a meal can focus the field.
 * Render it as the page's last child, with no wrapper, so the docked input
 * sticks to the bottom of the page rather than of a wrapper.
 */
const PlanEditBar = forwardRef<AgentInputHandle, PlanEditBarProps>(function PlanEditBar(
  { message, preview, onAccept, onDiscard, canUndo, onUndo, busy, disabled, value, onChange, onSubmit },
  ref
) {
  const reviewable = preview && !preview.pending && preview.changeCount > 0;
  const review: AgentInputReview | undefined = reviewable
    ? { state: "proposal", id: preview.id, summary: proposalSummary(preview.changeCount), onAccept, onDiscard }
    : !preview && canUndo
      ? { state: "applied", onUndo }
      : undefined;

  return (
    <AgentInput
      ref={ref}
      docked
      label="Tell me what to change"
      value={value}
      onChange={onChange}
      onSubmit={({ text }) => onSubmit(text.trim())}
      placeholder={
        preview
          ? "Refine it, e.g. no, something with fish"
          : "Tell me what to change, e.g. swap Tuesday for something lighter"
      }
      review={review}
      maxLength={PLAN_EDIT_MAX_LENGTH}
      // Off until the household decides they want voice.
      enableVoice={false}
      isSubmitting={busy}
      disabled={disabled}
      helperText={HELPER_TEXT}
      statusMessage={
        message?.tone === "info" ? message.text : preview?.pending ? "Finding new dinners…" : undefined
      }
      errorMessage={message?.tone === "error" ? message.text : undefined}
    />
  );
});

export default PlanEditBar;
