import { Stack, Typography, Avatar } from "@common-origin/design-system";

export type MealCardProps = {
  title: string;
  chef: string;
  timeMins: number;
  kidsFriendly?: boolean;
  conflicts?: string[];
};

export default function MealCard({ 
  title, 
  chef, 
  timeMins, 
  kidsFriendly = false, 
  conflicts = [] 
}: MealCardProps) {
  return (
    <div style={{ 
      border: "1px solid #e9ecef", 
      borderRadius: "8px", 
      padding: "16px", 
      backgroundColor: "white" 
    }}>
      <Stack direction="column" gap="md">
        <Typography variant="h3">{title}</Typography>
        
        <Stack direction="row" gap="sm" alignItems="center">
          <Avatar name={chef} size="sm" />
          <Typography variant="body">{chef}</Typography>
        </Stack>
        
        <Stack direction="row" gap="md" alignItems="center">
          <Typography variant="small">{timeMins} mins</Typography>
          {kidsFriendly && (
            <Typography variant="small">
              👶 Kid-friendly
            </Typography>
          )}
        </Stack>
        
        {conflicts.length > 0 && (
          <Stack direction="column" gap="xs">
            <Typography variant="small">
              Conflicts:
            </Typography>
            {conflicts.map((conflict, index) => (
              <Typography key={index} variant="small">
                • {conflict}
              </Typography>
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  );
}