import { useMemo, useState } from "react";
import { InlineAlert, AILabel, ActionSheet, Button, Stack, Box, Typography } from "@common-origin/design-system";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { MealCardProps } from "./MealCard";
import type { ProposedNight } from "@/lib/planEdit";
import { explainReasons } from "@/lib/explainer";
import { distinctTags } from "@/lib/dayCard";
import SortableDay from "./SortableDay";
import DayCard, { MealActionsSkeleton, MealSkeleton } from "./DayCard";
import PlanMeal from "./PlanMeal";

export type WeekPlanListProps = {
  meals: (MealCardProps | null)[];
  /** Monday to Sunday as "27 Oct", shown under each day (#160). */
  dates?: string[];
  onSwapClick?: (dayIndex: number) => void;
  onGenerateClick?: (dayIndex: number) => void;
  onAddSavedRecipeClick?: (dayIndex: number) => void;
  /** Days whose AI recipe is still being generated; each shows a skeleton (#95). */
  generatingDays?: number[];
  /** Per-day generation errors (friendly copy, #96), shown with a Retry button. */
  dayErrors?: Record<number, string>;
  onRetryDay?: (dayIndex: number) => void;
  onDeleteClick?: (dayIndex: number) => void;
  /** Skeletons for every night, for the initial load only. */
  isGeneratingPlan?: boolean;
  /** Drag a meal to another position; the nights between shift along. */
  onReorder?: (oldIndex: number, newIndex: number) => void;
  /** "Move to another night…": swaps two nights' meals (#160). */
  onMoveNight?: (fromIndex: number, toIndex: number) => void;
  /** "Fill empty nights": shown when two or more nights are empty (#160). */
  onFillEmptyClick?: () => void;
  /** Nights a typed edit proposes to change, shown in place until accepted or discarded (#38). */
  proposals?: Record<number, ProposedNight>;
  /** Retry one proposed night whose generation failed. */
  onRetryProposal?: (dayIndex: number) => void;
  /** Keep the plan's meal on a night whose proposal failed, dropping it from the preview. */
  onKeepNight?: (dayIndex: number) => void;
  /** "Change this" on a meal: puts the night in the edit input (#38). */
  onChangeClick?: (dayIndex: number) => void;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A meal's reason tags, as its card would label them. */
const tagsOf = (meal: MealCardProps) => explainReasons(meal.reasons ?? [], meal.title, 3).map((chip) => chip.text);

/** The week as a Monday–Sunday list (#38, #160), one card per night. */
export default function WeekPlanList({
  meals,
  dates = [],
  onSwapClick,
  onGenerateClick,
  onAddSavedRecipeClick,
  generatingDays = [],
  dayErrors = {},
  onRetryDay,
  onDeleteClick,
  isGeneratingPlan,
  onReorder,
  onMoveNight,
  onFillEmptyClick,
  proposals = {},
  onRetryProposal,
  onKeepNight,
  onChangeClick,
}: WeekPlanListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay before drag starts on touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // The night whose "Move to another night…" sheet is open
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  // Moving was switched off (e.g. generation started): close the sheet for good, not just hide it
  if (!onMoveNight && moveFrom !== null) setMoveFrom(null);

  // Nights showing a skeleton now. A night that was loading last render and isn't
  // now has just got its meal, which fades in (#177). Kept with the list's shape
  // (loading nights, proposals, meals) and worked out during render whenever the
  // shape changes, so the render that mounts the meal sees it, and any later mount
  // (accepting a proposal, adding a meal) changes the shape and clears it.
  const loadingNow = isGeneratingPlan
    ? DAYS.map((_, i) => i)
    : [
        ...generatingDays,
        ...Object.entries(proposals).flatMap(([i, p]) => (p.kind === "replace" && p.status === "loading" ? [Number(i)] : [])),
      ];
  const loadingKey = [...new Set(loadingNow)].sort((a, b) => a - b).join(",");
  const shape = `${loadingKey}|${Object.keys(proposals).sort().join(",")}|${DAYS.map((_, i) => (meals[i] ? 1 : 0)).join("")}`;
  const [loading, setLoading] = useState({ shape, key: loadingKey, justLoaded: [] as number[] });
  if (loading.shape !== shape) {
    const now = new Set(loadingNow);
    const before = loading.key ? loading.key.split(",").map(Number) : [];
    setLoading({ shape, key: loadingKey, justLoaded: before.filter((i) => !now.has(i)) });
  }
  const justLoaded = (index: number) => loading.justLoaded.includes(index);

  // Tags the whole week shares don't tell meals apart, so they're hidden (#160)
  const tagsByNight = useMemo(
    () => distinctTags(DAYS.map((_, i) => (meals[i] ? tagsOf(meals[i]) : null))),
    [meals]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = DAYS.indexOf(active.id as string);
    const newIndex = DAYS.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
      onReorder(oldIndex, newIndex);
    }
  };

  if (isGeneratingPlan) {
    return (
      <Box mt="xl">
        <Stack direction="column" gap="md">
          {DAYS.map((day, index) => (
            <DayCard key={day} day={day} date={dates[index]} actions={<MealActionsSkeleton withChange={Boolean(onChangeClick)} />}>
              <MealSkeleton label={`Loading recipe for ${day}`} />
            </DayCard>
          ))}
        </Stack>
      </Box>
    );
  }

  // No plan yet (meals is []) is a week to compose, not seven nights to fill
  const emptyNights =
    meals.length === 0 ? 0 : DAYS.filter((_, i) => !meals[i] && !generatingDays.includes(i) && !proposals[i]).length;
  const moving = moveFrom !== null ? meals[moveFrom] : null;

  return (
    <Box mt="xl">
      <Stack direction="column" gap="md">
        {onFillEmptyClick && emptyNights >= 2 && (
          <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
            <Typography variant="small" color="subdued">
              {emptyNights} nights still empty
            </Typography>
            <Button variant="secondary" size="medium" iconName="add" onClick={onFillEmptyClick}>
              Fill empty nights
            </Button>
          </Stack>
        )}

        {/* A stable id keeps dnd-kit's generated aria-describedby the same on server and client. */}
        <DndContext id="week-plan-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={DAYS} strategy={verticalListSortingStrategy}>
            <Stack direction="column" gap="md">
              {DAYS.map((day, index) => {
                const date = dates[index];

                // Each night shows its own skeleton until its own request resolves (#95)
                if (generatingDays.includes(index)) {
                  return (
                    <DayCard key={day} day={day} date={date} actions={<MealActionsSkeleton withChange={Boolean(onChangeClick)} />}>
                      <MealSkeleton label={`Generating AI recipe for ${day}`} />
                    </DayCard>
                  );
                }

                // A typed edit proposes something else for this night (#38)
                const proposal = proposals[index];
                if (proposal) {
                  return (
                    <ProposedNightView
                      key={day}
                      proposal={proposal}
                      current={meals[index] ?? null}
                      day={day}
                      date={date}
                      fadeIn={justLoaded(index)}
                      onRetry={onRetryProposal ? () => onRetryProposal(index) : undefined}
                      onKeep={onKeepNight ? () => onKeepNight(index) : undefined}
                    />
                  );
                }

                // A night whose generation failed: the error, and a retry for just this night
                const error = dayErrors[index];
                if (error && !meals[index]) {
                  return (
                    <DayCard
                      key={day}
                      day={day}
                      date={date}
                      layout="stacked"
                      tone="empty"
                      actions={
                        onRetryDay && (
                          <Button variant="secondary" size="medium" onClick={() => onRetryDay(index)}>
                            Retry this day
                          </Button>
                        )
                      }
                    >
                      <InlineAlert variant="error">
                        {error}
                      </InlineAlert>
                    </DayCard>
                  );
                }

                return (
                  <SortableDay
                    key={day}
                    id={day}
                    day={day}
                    date={date}
                    index={index}
                    meal={meals[index] ?? null}
                    tags={tagsByNight[index] ?? []}
                    canReorder={Boolean(onReorder)}
                    fadeIn={justLoaded(index)}
                    onSwapClick={onSwapClick}
                    onDeleteClick={onDeleteClick}
                    onGenerateClick={onGenerateClick}
                    onAddSavedRecipeClick={onAddSavedRecipeClick}
                    onChangeClick={onChangeClick}
                    onMoveClick={onMoveNight ? setMoveFrom : undefined}
                  />
                );
              })}
            </Stack>
          </SortableContext>
        </DndContext>
      </Stack>

      <ActionSheet
        isOpen={moveFrom !== null && moving !== null && Boolean(onMoveNight)}
        onClose={() => setMoveFrom(null)}
        title={moveFrom !== null ? `Move ${DAYS[moveFrom]}'s dinner` : undefined}
        description={moving ? moving.title : undefined}
        actions={
          moveFrom === null
            ? []
            : DAYS.flatMap((day, to) =>
                to === moveFrom
                  ? []
                  : [
                      {
                        id: day,
                        label: meals[to] ? `${day}: swap with ${meals[to]!.title}` : `${day} (nothing planned)`,
                        onSelect: () => {
                          onMoveNight?.(moveFrom, to);
                          setMoveFrom(null);
                        },
                      },
                    ]
              )
        }
      />
    </Box>
  );
}

/** A night as a typed edit proposes it: highlighted, naming the meal it replaces (#38). */
function ProposedNightView({
  proposal,
  current,
  day,
  date,
  fadeIn,
  onRetry,
  onKeep,
}: {
  proposal: ProposedNight;
  current: MealCardProps | null;
  day: string;
  date?: string;
  /** The proposal is replacing its loading skeleton (#177). */
  fadeIn: boolean;
  onRetry?: () => void;
  onKeep?: () => void;
}) {
  const replaces = current ? (
    // <s>: the meal this proposal replaces, struck through.
    <Typography as="s" variant="small" color="subdued">
      {current.title}
    </Typography>
  ) : (
    <Typography variant="small" color="subdued">New dinner</Typography>
  );

  return (
    <DayCard day={day} date={date} tone="proposal" actions={<AILabel kind={proposal.kind === "remove" ? "removal" : "suggested"} />}>
      <Stack direction="column" gap="sm">
        {proposal.kind === "remove" ? (
          <>
            {current && replaces}
            <Typography variant="label">No dinner this night</Typography>
          </>
        ) : (
          <>
            {replaces}
            {proposal.status === "loading" && (
              <MealSkeleton label={`Finding something new for ${day}`} />
            )}
            {proposal.status === "ready" && <PlanMeal {...proposal.meal} tags={tagsOf(proposal.meal)} disableLink fadeIn={fadeIn} />}
            {proposal.status === "failed" && (
              <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
                <InlineAlert variant="error">
                  {proposal.error}
                </InlineAlert>
                <Stack direction="row" gap="sm">
                  {onKeep && (
                    <Button variant="naked" size="medium" onClick={onKeep}>
                      Keep as is
                    </Button>
                  )}
                  {onRetry && (
                    <Button variant="secondary" size="medium" onClick={onRetry}>
                      Try again
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}
          </>
        )}
      </Stack>
    </DayCard>
  );
}
