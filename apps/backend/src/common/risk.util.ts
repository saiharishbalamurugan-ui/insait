export type RiskLabel = "Approved" | "Flagged" | "High Risk";

export function riskLabel(riskScore: number | null | undefined): RiskLabel {
  if (riskScore == null) return "Approved";
  if (riskScore >= 75) return "High Risk";
  if (riskScore >= 20) return "Flagged";
  return "Approved";
}

export function matchConfidence(riskScore: number | null | undefined): number {
  const risk = riskScore ?? 0;
  return Math.max(91, Math.min(99.7, 99.6 - risk * 0.07));
}
