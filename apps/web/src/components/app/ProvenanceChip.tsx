import { Typography } from "@common-origin/design-system";

export type ProvenanceChipProps = {
  source: string;
  verified?: boolean;
};

export default function ProvenanceChip({ source, verified = false }: ProvenanceChipProps) {
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 8px",
      backgroundColor: verified ? "#d4edda" : "#fff3cd",
      border: `1px solid ${verified ? "#c3e6cb" : "#ffeaa7"}`,
      borderRadius: "4px",
      fontSize: "12px"
    }}>
      <Typography variant="small">
        {verified ? "✓" : "📍"} {source}
      </Typography>
    </span>
  );
}