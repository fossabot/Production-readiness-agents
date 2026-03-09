import type { PolicyReviewStatus } from "../../electron/types/model-policy.js";

interface PolicyStatusBadgeProps {
  status: PolicyReviewStatus;
  reviewByDate: string;
  confidence?: "high" | "medium" | "low";
  previewDependency?: boolean;
}

const STATUS_META: Record<PolicyReviewStatus, { label: string; background: string; color: string }> = {
  fresh: { label: "حديثة", background: "#c6f6d5", color: "#22543d" },
  "review-soon": { label: "تقترب من المراجعة", background: "#fef3c7", color: "#92400e" },
  stale: { label: "متقادمة", background: "#fed7d7", color: "#9b2c2c" },
};

const CONFIDENCE_META = {
  high: "ثقة عالية",
  medium: "ثقة متوسطة",
  low: "ثقة منخفضة",
} as const;

export function PolicyStatusBadge({ status, reviewByDate, confidence, previewDependency = false }: PolicyStatusBadgeProps) {
  const meta = STATUS_META[status];
  const lines = [
    meta.label,
    confidence ? CONFIDENCE_META[confidence] : null,
    previewDependency ? "يتأثر بنماذج تجريبية" : null,
    `المراجعة قبل ${new Date(reviewByDate).toLocaleDateString("ar-EG")}`,
  ].filter(Boolean);

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: "column",
      gap: "0.2rem",
      padding: "0.45rem 0.75rem",
      borderRadius: "10px",
      background: meta.background,
      color: meta.color,
      fontSize: "0.78rem",
      lineHeight: 1.35,
      minWidth: 130,
    }}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}
