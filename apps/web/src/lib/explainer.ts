/**
 * Explainability Layer
 * Converts scoring reasons into human-readable chip text
 * Designed to be swappable with LLM-based explanations in the future
 */

/**
 * Reason chip data
 */
export interface ReasonChip {
  text: string;
  variant?: 'default' | 'success' | 'warning' | 'info';
  icon?: string; // Future: emoji or icon name
}

/**
 * Mapping from reason codes to human-readable chips
 */
const REASON_CHIP_MAP: Record<string, ReasonChip> = {
  // Time-based (only recipes under 25 mins are "quick")
  "quick": {
    text: "Quick",
    variant: "success",
    icon: "⚡"
  },
  
  // Dietary
  "kid-friendly": {
    text: "Kid-friendly",
    variant: "info",
    icon: "👶"
  },
  "vegetarian": {
    text: "Vegetarian",
    variant: "info",
    icon: "🥬"
  },
  "high-protein": {
    text: "High protein",
    variant: "info",
    icon: "💪"
  },
  
  // Value & Strategy
  "favorite": {
    text: "Your favorite",
    variant: "success",
    icon: "⭐"
  },
  "best value": {
    text: "Best value",
    variant: "success",
    icon: "💰"
  },
  "bulk cook": {
    text: "Bulk cook",
    variant: "info",
    icon: "🍲"
  },
  "reuses ingredients": {
    text: "Reuses ingredients",
    variant: "info",
    icon: "♻️"
  },
  
  // Simplicity
  "simple": {
    text: "Simple recipe",
    variant: "default",
    icon: "✨"
  }
};

/**
 * Explain adapter interface
 * Allows swapping between deterministic and LLM-based explanations
 */
export interface ExplainAdapter {
  explain(reasons: string[], recipeTitle: string): ReasonChip[];
}

/**
 * Deterministic explainer
 * Maps reason codes to predefined chip text
 */
export class DeterministicExplainer implements ExplainAdapter {
  /**
   * Convert reason codes to chips (limit to 3)
   */
  explain(reasons: string[], _recipeTitle: string): ReasonChip[] {
    const chips: ReasonChip[] = [];
    
    // Prioritize reasons for display
    const priorityOrder = [
      "favorite",
      "quick",
      "best value",
      "kid-friendly",
      "bulk cook",
      "reuses ingredients",
      "high-protein",
      "vegetarian",
      "simple"
    ];
    
    // Sort reasons by priority
    const sortedReasons = [...reasons].sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a);
      const bPriority = priorityOrder.indexOf(b);
      
      if (aPriority === -1 && bPriority === -1) return 0;
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });
    
    // Take top 3 reasons
    for (const reason of sortedReasons.slice(0, 3)) {
      const chip = REASON_CHIP_MAP[reason];
      // Skip unknown reasons (no fallback chip)
      if (chip) {
        chips.push({
          ...chip,
          text: chip.text
        });
      }
    }
    
    return chips;
  }
}

/**
 * LLM-based explainer (placeholder for future implementation)
 * Would call an LLM to generate contextual explanations
 */
export class LLMExplainer implements ExplainAdapter {
  async explainAsync(
    reasons: string[],
    recipeTitle: string,
    _context?: {
      dayOfWeek?: string;
      isWeekend?: boolean;
      householdSize?: number;
    }
  ): Promise<ReasonChip[]> {
    // Future: Call LLM API with context
    // Prompt: "Explain why we selected '{recipeTitle}' for {dayOfWeek}. 
    //          Scoring reasons: {reasons}. Context: {context}"
    // Return personalized, natural language explanations
    
    // For now, fall back to deterministic
    return new DeterministicExplainer().explain(reasons, recipeTitle);
  }
  
  explain(reasons: string[], recipeTitle: string): ReasonChip[] {
    // Synchronous wrapper - falls back to deterministic
    return new DeterministicExplainer().explain(reasons, recipeTitle);
  }
}

/**
 * Default explainer instance
 */
export const explainer: ExplainAdapter = new DeterministicExplainer();

/**
 * Utility: Format reasons for display (convenience function)
 */
export function explainReasons(
  reasons: string[],
  recipeTitle: string,
  maxChips: number = 3
): ReasonChip[] {
  const chips = explainer.explain(reasons, recipeTitle);
  return chips.slice(0, maxChips);
}

/**
 * Utility: Get chip text only (for simple displays)
 */
export function getChipTexts(reasons: string[], maxChips: number = 3): string[] {
  const chips = explainReasons(reasons, "", maxChips);
  return chips.map(chip => chip.text);
}

/**
 * Utility: Add custom reason chip
 */
export function addCustomReasonMapping(
  reasonCode: string,
  chip: ReasonChip
): void {
  REASON_CHIP_MAP[reasonCode] = chip;
}

/**
 * Utility: Get all available reason mappings (for debugging)
 */
export function getReasonMappings(): Record<string, ReasonChip> {
  return { ...REASON_CHIP_MAP };
}
