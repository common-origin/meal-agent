"use client";

import { useState, type KeyboardEvent } from "react";
import { Button, InputChip, Stack, TextField, Typography } from "@common-origin/design-system";
import { MAX_SETTING_TEXT_LENGTH } from "@/lib/types/settings";

/** Matches `textList` in lib/api/schemas.ts, which rejects longer lists. */
export const MAX_TEXT_LIST_ITEMS = 30;

interface TextListFieldProps {
  label: string;
  helperText?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}

/**
 * Adds a trimmed item unless it is empty, already listed (ignoring case) or
 * the list is full. Returns the list unchanged in those cases.
 */
export function addListItem(values: string[], raw: string): string[] {
  const item = raw.trim().slice(0, MAX_SETTING_TEXT_LENGTH);
  if (!item || values.length >= MAX_TEXT_LIST_ITEMS) return values;
  if (values.some((v) => v.toLowerCase() === item.toLowerCase())) return values;
  return [...values, item];
}

/**
 * A free-text list setting: type an item and press Enter or Add, and each
 * item shows as a chip with a remove button.
 */
export default function TextListField({ label, helperText, placeholder, values, onChange }: TextListFieldProps) {
  const [draft, setDraft] = useState("");
  const atCap = values.length >= MAX_TEXT_LIST_ITEMS;

  const add = () => {
    const next = addListItem(values, draft);
    if (next !== values) onChange(next);
    // Clear the field for a duplicate too, so it reads as already added.
    if (draft.trim() && !atCap) setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Don't submit a surrounding form.
      e.preventDefault();
      add();
    }
  };

  return (
    <Stack direction="column" gap="sm">
      <Stack direction="row" gap="sm" alignItems="flex-end">
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField
            label={label}
            placeholder={placeholder}
            value={draft}
            maxLength={MAX_SETTING_TEXT_LENGTH}
            disabled={atCap}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <Button variant="secondary" size="large" iconName="add" onClick={add} disabled={atCap || !draft.trim()}>
          Add
        </Button>
      </Stack>
      {/* Below the row rather than TextField's helperText, so Add lines up with the input */}
      {atCap || helperText ? (
        <Typography variant="small" color="subdued">
          {atCap ? `You can add up to ${MAX_TEXT_LIST_ITEMS}. Remove one to add another.` : helperText}
        </Typography>
      ) : null}
      {values.length > 0 ? (
        <Stack direction="row" gap="xs" wrap>
          {values.map((value) => (
            <InputChip
              key={value}
              aria-label={`Remove ${value}`}
              onDismiss={() => onChange(values.filter((v) => v !== value))}
            >
              {value}
            </InputChip>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
