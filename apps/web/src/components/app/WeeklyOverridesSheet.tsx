"use client";

import { useState } from "react";
import { Stack, Typography, IconButton, Sheet } from "@common-origin/design-system";
import { saveWeeklyOverrides } from "@/lib/storage";
import { nextWeekMondayISO } from "@/lib/schedule";
import { track } from "@/lib/analytics";
import type { WeeklyOverrides, PantryItem } from "@/lib/types/recipe";

type WeeklyOverridesSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function WeeklyOverridesSheet({ 
  isOpen, 
  onClose, 
  onSuccess 
}: WeeklyOverridesSheetProps) {
  const [dinners, setDinners] = useState(5);
  const [servingsPerMeal, setServingsPerMeal] = useState(4);
  const [kidFriendlyWeeknights, setKidFriendlyWeeknights] = useState(true);
  const [glutenLight, setGlutenLight] = useState(false);
  const [highProtein, setHighProtein] = useState(false);
  const [organicPreferred, setOrganicPreferred] = useState(false);
  const [pantryAdds, setPantryAdds] = useState<PantryItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState<PantryItem["unit"]>("unit");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const overrides: WeeklyOverrides = {
      weekOfISO: nextWeekMondayISO(),
      dinners,
      servingsPerMeal,
      kidFriendlyWeeknights,
      dietAdjust: { glutenLight, highProtein, organicPreferred },
      pantryAdds
    };

    const success = saveWeeklyOverrides(overrides);
    
    if (success) {
      // Track analytics
      track("override_saved", { 
        weekOfISO: overrides.weekOfISO, 
        dinners 
      });
      
      onSuccess();
      onClose();
    }
  };

  const addPantryItem = () => {
    if (newItemName && newItemQty) {
      setPantryAdds([
        ...pantryAdds,
        { name: newItemName, qty: Number(newItemQty), unit: newItemUnit }
      ]);
      setNewItemName("");
      setNewItemQty("");
      setNewItemUnit("unit");
    }
  };

  const removePantryItem = (index: number) => {
    setPantryAdds(pantryAdds.filter((_, i) => i !== index));
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      variant="drawer"
      height="90vh"
      title="Next Week's Preferences"
    >
      <form onSubmit={handleSubmit}>
        <Stack direction="column" gap="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h2">Next Week&apos;s Preferences</Typography>
            <IconButton
              variant="naked"
              iconName="close"
              size="medium"
              onClick={onClose}
              aria-label="Close weekly preferences sheet"
            />
          </Stack>

            {/* Dinners */}
            <Stack direction="column" gap="sm">
              <label htmlFor="dinners">
                <Typography variant="body">Number of dinners (1-7)</Typography>
              </label>
              <input
                id="dinners"
                type="number"
                min="1"
                max="7"
                value={dinners}
                onChange={(e) => setDinners(Number(e.target.value))}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  fontSize: "16px"
                }}
              />
            </Stack>

            {/* Servings per meal */}
            <Stack direction="column" gap="sm">
              <label htmlFor="servings">
                <Typography variant="body">Servings per meal</Typography>
              </label>
              <input
                id="servings"
                type="number"
                min="1"
                max="12"
                value={servingsPerMeal}
                onChange={(e) => setServingsPerMeal(Number(e.target.value))}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  fontSize: "16px"
                }}
              />
            </Stack>

            {/* Kid-friendly weeknights */}
            <Stack direction="row" gap="sm" alignItems="center">
              <input
                id="kidFriendly"
                type="checkbox"
                checked={kidFriendlyWeeknights}
                onChange={(e) => setKidFriendlyWeeknights(e.target.checked)}
                style={{ width: "20px", height: "20px" }}
              />
              <label htmlFor="kidFriendly">
                <Typography variant="body">Kid-friendly weeknights</Typography>
              </label>
            </Stack>

            {/* Diet adjustments */}
            <Stack direction="column" gap="sm">
              <Typography variant="h4">Diet Adjustments</Typography>
              
              <Stack direction="row" gap="sm" alignItems="center">
                <input
                  id="glutenLight"
                  type="checkbox"
                  checked={glutenLight}
                  onChange={(e) => setGlutenLight(e.target.checked)}
                  style={{ width: "20px", height: "20px" }}
                />
                <label htmlFor="glutenLight">
                  <Typography variant="body">Gluten light</Typography>
                </label>
              </Stack>

              <Stack direction="row" gap="sm" alignItems="center">
                <input
                  id="highProtein"
                  type="checkbox"
                  checked={highProtein}
                  onChange={(e) => setHighProtein(e.target.checked)}
                  style={{ width: "20px", height: "20px" }}
                />
                <label htmlFor="highProtein">
                  <Typography variant="body">High protein</Typography>
                </label>
              </Stack>

              <Stack direction="row" gap="sm" alignItems="center">
                <input
                  id="organicPreferred"
                  type="checkbox"
                  checked={organicPreferred}
                  onChange={(e) => setOrganicPreferred(e.target.checked)}
                  style={{ width: "20px", height: "20px" }}
                />
                <label htmlFor="organicPreferred">
                  <Typography variant="body">Organic preferred</Typography>
                </label>
              </Stack>
            </Stack>

            {/* Pantry additions */}
            <Stack direction="column" gap="sm">
              <Typography variant="h4">Additional Pantry Items</Typography>
              
              {pantryAdds.length > 0 && (
                <Stack direction="column" gap="xs">
                  {pantryAdds.map((item, index) => (
                    <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body">
                        {item.name} - {item.qty} {item.unit}
                      </Typography>
                      <button
                        type="button"
                        onClick={() => removePantryItem(index)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc3545",
                          cursor: "pointer"
                        }}
                      >
                        Remove
                      </button>
                    </Stack>
                  ))}
                </Stack>
              )}

              <Stack direction="row" gap="sm" alignItems="flex-end">
                <div style={{ flex: 2 }}>
                  <Stack direction="column" gap="xs">
                    <label htmlFor="itemName">
                      <Typography variant="small">Item name</Typography>
                    </label>
                    <input
                      id="itemName"
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g. Olive oil"
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #dee2e6",
                        borderRadius: "6px",
                        fontSize: "14px",
                        width: "100%"
                      }}
                    />
                  </Stack>
                </div>

                <div style={{ flex: 1 }}>
                  <Stack direction="column" gap="xs">
                    <label htmlFor="itemQty">
                      <Typography variant="small">Qty</Typography>
                    </label>
                    <input
                      id="itemQty"
                      type="number"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      placeholder="1"
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #dee2e6",
                        borderRadius: "6px",
                        fontSize: "14px",
                        width: "100%"
                      }}
                    />
                  </Stack>
                </div>

                <div style={{ flex: 1 }}>
                  <Stack direction="column" gap="xs">
                    <label htmlFor="itemUnit">
                      <Typography variant="small">Unit</Typography>
                    </label>
                    <select
                      id="itemUnit"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value as PantryItem["unit"])}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #dee2e6",
                        borderRadius: "6px",
                        fontSize: "14px",
                        width: "100%"
                      }}
                    >
                      <option value="unit">unit</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  </Stack>
                </div>

                <button
                  type="button"
                  onClick={addPantryItem}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Add
                </button>
              </Stack>
            </Stack>

            {/* Submit button */}
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold"
              }}
            >
              Save Preferences for Next Week
            </button>
          </Stack>
        </form>
    </Sheet>
  );
}