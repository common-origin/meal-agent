"use client";

import { useState } from "react";
import { Typography, Stack, Tag, tokens } from "@common-origin/design-system";
import type { AggregatedIngredient } from "@/lib/shoppingListAggregator";
import { estimateIngredientCost } from "@/lib/colesMapping";

interface ShoppingListItemProps {
  item: AggregatedIngredient;
  showPantryBadge?: boolean;
  showColesMapping?: boolean;
}

export default function ShoppingListItem({ 
  item, 
  showPantryBadge = true,
  showColesMapping = true 
}: ShoppingListItemProps) {
  const [expanded, setExpanded] = useState(false);
  
  const hasMultipleSources = item.sourceRecipes.length > 1;
  
  // Get Coles mapping
  const colesInfo = showColesMapping 
    ? estimateIngredientCost(item.normalizedName, item.totalQty, item.unit)
    : null;
  
  return (
    <div
      onClick={() => hasMultipleSources && setExpanded(!expanded)}
      onKeyDown={(e) => {
        if (hasMultipleSources && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      role={hasMultipleSources ? "button" : undefined}
      aria-expanded={hasMultipleSources ? expanded : undefined}
      aria-label={hasMultipleSources 
        ? `${item.name}, ${item.totalQty} ${item.unit}, used in ${item.sourceRecipes.length} recipes. ${expanded ? 'Collapse' : 'Expand'} to see details.`
        : `${item.name}, ${item.totalQty} ${item.unit}`
      }
      tabIndex={hasMultipleSources ? 0 : -1}
      style={{
        padding: "8px 12px",
        minHeight: "44px",
        borderRadius: tokens.base.border.radius[2],
        backgroundColor: item.isPantryStaple && showPantryBadge ? tokens.semantic.color.background["interactive-subtle"] : tokens.semantic.color.background.default,
        cursor: hasMultipleSources ? "pointer" : "default",
        transition: "background-color 0.2s",
        border: colesInfo?.mapped ? `1px solid ${tokens.semantic.color.border.default}` : "1px solid transparent"
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" gap="sm" alignItems="center">
          <Typography variant="body">{item.name}</Typography>
          {item.isPantryStaple && showPantryBadge && (
            <Tag 
              variant="interactive"
              aria-label="Pantry staple item"
            >
              Pantry
            </Tag>
          )}
          {colesInfo?.mapped && (
            <Tag 
              variant={colesInfo.confidence === 'high' ? "success" : "warning"}
              aria-label={colesInfo.requiresChoice ? "Multiple options available" : "Matched to Coles product"}
            >
              {colesInfo.requiresChoice ? "Choice" : "Mapped"}
            </Tag>
          )}
        </Stack>
        
        <Stack direction="row" gap="sm" alignItems="center">
          <Typography>
            <strong>{item.totalQty} {item.unit}</strong>
          </Typography>
          {colesInfo?.mapped && (
            <Typography 
              color="success"
              aria-label={`Estimated cost ${colesInfo.estimatedCost.toFixed(2)} dollars`}
            >
              <strong>~${colesInfo.estimatedCost.toFixed(2)}</strong>
            </Typography>
          )}
          {hasMultipleSources && (
            <span 
              aria-hidden="true"
              style={{ fontSize: "12px", color: "#666" }}
            >
              {expanded ? "▼" : "▶"} {item.sourceRecipes.length} recipes
            </span>
          )}
        </Stack>
      </Stack>
      
      {expanded && hasMultipleSources && (
        <div 
          role="region"
          aria-label="Recipe breakdown"
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid #dee2e6"
          }}
        >
          <Stack direction="column" gap="xs">
            {item.sourceRecipes.map((source, idx) => (
              <Stack key={idx} direction="row" justifyContent="space-between" alignItems="center">
                <div style={{ color: "#666", fontSize: "13px" }}>
                  • {source.recipeTitle}
                </div>
                <div style={{ color: "#666", fontSize: "13px" }}>
                  {Math.round(source.qty * 10) / 10} {item.unit}
                </div>
              </Stack>
            ))}
          </Stack>
        </div>
      )}
      
      {/* Coles Product Info */}
      {colesInfo?.mapped && colesInfo.product && (
        <div 
          role="region"
          aria-label="Coles product information"
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid #dee2e6"
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="small" color="subdued">
              <strong>Coles:</strong> {colesInfo.product.name}
              {colesInfo.product.brand && ` (${colesInfo.product.brand})`}
            </Typography>
            <Typography variant="small" color="subdued">
              {colesInfo.packsNeeded}x {colesInfo.product.packSize}{colesInfo.product.packUnit} @ ${colesInfo.product.price}
            </Typography>
          </Stack>
          {colesInfo.requiresChoice && (
            <div 
              role="note"
              style={{ fontSize: "11px", color: "#856404", marginTop: "4px" }}
            >
              <span role="img" aria-label="Information">ℹ️</span> Multiple options available - choose in-store or online
            </div>
          )}
        </div>
      )}
    </div>
  );
}
