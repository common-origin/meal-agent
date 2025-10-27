"use client";

import { useState } from "react";
import { Typography, Stack } from "@common-origin/design-system";
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
        padding: "12px",
        minHeight: "44px",
        borderRadius: "4px",
        backgroundColor: item.isPantryStaple && showPantryBadge ? "#fff3cd" : "white",
        cursor: hasMultipleSources ? "pointer" : "default",
        transition: "background-color 0.2s",
        border: colesInfo?.mapped ? "1px solid #d4edda" : "1px solid transparent"
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" gap="sm" alignItems="center">
          <Typography variant="body">{item.name}</Typography>
          {item.isPantryStaple && showPantryBadge && (
            <span 
              aria-label="Pantry staple item"
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                backgroundColor: "#856404",
                color: "white",
                borderRadius: "3px"
              }}
            >
              Pantry
            </span>
          )}
          {colesInfo?.mapped && (
            <span 
              aria-label={colesInfo.requiresChoice ? "Multiple options available" : "Matched to Coles product"}
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                backgroundColor: colesInfo.confidence === 'high' ? "#28a745" : "#ffc107",
                color: colesInfo.confidence === 'high' ? "white" : "#000",
                borderRadius: "3px"
              }}
            >
              {colesInfo.requiresChoice ? "? Choice" : "✓ Mapped"}
            </span>
          )}
        </Stack>
        
        <Stack direction="row" gap="sm" alignItems="center">
          <Typography variant="small">
            {item.totalQty} {item.unit}
          </Typography>
          {colesInfo?.mapped && (
            <span 
              aria-label={`Estimated cost ${colesInfo.estimatedCost.toFixed(2)} dollars`}
              style={{ fontSize: "13px", color: "#28a745", fontWeight: "600" }}
            >
              ~${colesInfo.estimatedCost.toFixed(2)}
            </span>
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
            <div style={{ fontSize: "12px", color: "#666" }}>
              <strong>Coles:</strong> {colesInfo.product.name}
              {colesInfo.product.brand && ` (${colesInfo.product.brand})`}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {colesInfo.packsNeeded}x {colesInfo.product.packSize}{colesInfo.product.packUnit} @ ${colesInfo.product.price}
            </div>
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
