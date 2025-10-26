import { Typography } from "@common-origin/design-system";

export type ConflictChipProps = {
  conflict: string;
};

export default function ConflictChip({ conflict }: ConflictChipProps) {
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 8px",
      backgroundColor: "#f8d7da",
      border: "1px solid #f5c6cb",
      borderRadius: "4px",
      fontSize: "12px"
    }}>
      <Typography variant="small">⚠️ {conflict}</Typography>
    </span>
  );
}