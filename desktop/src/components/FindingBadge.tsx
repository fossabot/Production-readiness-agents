import type { Severity } from "../../../src/types.js";

interface FindingBadgeProps {
  severity: Severity;
  count?: number;
}

const SEVERITY_COLORS: Record<Severity, { bg: string; text: string }> = {
  Critical: { bg: "#fed7d7", text: "#c53030" },
  High: { bg: "#feebc8", text: "#c05621" },
  Medium: { bg: "#fefcbf", text: "#975a16" },
  Low: { bg: "#c6f6d5", text: "#276749" },
};

export function FindingBadge({ severity, count }: FindingBadgeProps) {
  const colors = SEVERITY_COLORS[severity];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.2rem 0.6rem",
        borderRadius: "12px",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
      }}
    >
      {severity}
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}
