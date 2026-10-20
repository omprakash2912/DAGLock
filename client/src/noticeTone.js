export function getNoticeTone(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return "info";
  if (
    text.startsWith("no deadlock detected") ||
    text.startsWith("safe state") ||
    text.startsWith("process terminated") ||
    text.includes("was terminated in the simulation") ||
    text.startsWith("scenario reset") ||
    text.startsWith("loaded scenario:") ||
    text.startsWith("guided demonstration complete") ||
    text.startsWith("experiment report exported") ||
    text.startsWith("print-ready html report exported")
  ) return "success";
  if (text.startsWith("deadlock remains") || text.startsWith("deadlock detected") || text.includes("failed") || text.startsWith("cannot ")) return "danger";
  if (text.startsWith("unsafe state") || text.startsWith("fix ") || text.includes("invalid") || text.startsWith("prototype limit reached") || text.startsWith("keep at least one")) return "warning";
  return "info";
}
