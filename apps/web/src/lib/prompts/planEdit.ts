/**
 * Prompts for reading a typed plan edit (#38) into per-night edits. The
 * new dinners themselves are generated afterwards, one per night, through
 * the normal generation prompt with this step's `guidance`.
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface PlanEditNight {
  day: number;
  title: string | null;
  cuisine?: string | null;
  protein?: string | null;
}

export interface PlanEditRequest {
  instruction: string;
  plan: PlanEditNight[];
  /** This session's recent edits, oldest first, so "lighter than that" has a referent. */
  history: { instruction: string; summary: string }[];
}

export function buildPlanEditSystemPrompt(): string {
  return `You help an Australian household edit their week of dinners. Read their instruction and decide which nights change.

RULES
- Days are numbered 0 = Monday to 6 = Sunday. Only change nights the instruction is about; leave every other night alone.
- "replace": the night gets a new dinner. Put what it should be in "guidance": a short, concrete brief taken from the instruction (e.g. "lighter, no cream", "something special for a Saturday", "vegetarian", "quick, under 20 minutes"). If they just don't fancy it, use "something different".
- An empty night they want filled is also "replace".
- An instruction that is only a night's name (e.g. "Tuesday:" or "Tuesday") means replace that night with "something different".
- "remove": they don't want a dinner that night (e.g. "we're out Wednesday").
- "this", "that", "it" and "again" refer to the recent edits listed, so a follow-up like "lighter than that" changes the same night again.
- If the instruction is unclear, or isn't about this week's dinners, return no edits and ask one short question in "question".
- "reply" is one short sentence in the second person saying what will change, e.g. "Swapping Tuesday for something lighter." Never mention AI.`;
}

export function buildPlanEditPrompt({ instruction, plan, history }: PlanEditRequest): string {
  const nights = DAYS.map((name, day) => {
    const night = plan.find((n) => n.day === day);
    if (!night?.title) return `${day} ${name}: (no dinner planned)`;
    const facts = [night.cuisine, night.protein].filter(Boolean).join(', ');
    return `${day} ${name}: ${night.title}${facts ? ` (${facts})` : ''}`;
  });
  const lines = ['THIS WEEK', ...nights];
  if (history.length > 0) {
    lines.push('', 'RECENT EDITS (oldest first)', ...history.map((h) => `- "${h.instruction}" → ${h.summary}`));
  }
  lines.push('', 'INSTRUCTION', instruction);
  return lines.join('\n');
}
