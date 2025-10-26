import { Stack, Typography, Avatar } from "@common-origin/design-system";

export type Chef = {
  id: string;
  name: string;
  picture?: string;
  specialties: string[];
};

export type ChefPickerProps = {
  chefs: Chef[];
  selectedChefId?: string;
  onChefSelect?: (chefId: string) => void;
};

export default function ChefPicker({ chefs, selectedChefId, onChefSelect }: ChefPickerProps) {
  return (
    <Stack direction="column" gap="md">
      <Typography variant="h3">Choose a Chef</Typography>
      
      <div style={{ display: "flex", flexDirection: "row", gap: "16px", flexWrap: "wrap" }}>
        {chefs.map((chef) => (
          <div
            key={chef.id}
            onClick={() => onChefSelect?.(chef.id)}
            style={{
              padding: "12px",
              border: `2px solid ${selectedChefId === chef.id ? "#007bff" : "#dee2e6"}`,
              borderRadius: "8px",
              cursor: "pointer",
              backgroundColor: selectedChefId === chef.id ? "#f8f9ff" : "white",
              transition: "all 0.2s ease"
            }}
          >
            <Stack direction="column" gap="sm" alignItems="center">
              <Avatar 
                name={chef.name} 
                picture={chef.picture}
                size="md" 
              />
              <Typography variant="body">{chef.name}</Typography>
              <Typography variant="small">
                {chef.specialties.join(", ")}
              </Typography>
            </Stack>
          </div>
        ))}
      </div>
    </Stack>
  );
}