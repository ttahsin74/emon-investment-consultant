export type Followup = {
  id: number;
  client_id: number;
  followup_date: string;
  type: string;
  discussion: string;
  result: string | null;
  next_followup_date: string | null;
  status: string;
};

// Keep the CRM's canonical deal stages while accepting familiar closure terms.
export function closedLeadStatus(status: string): "Closed Won" | "Closed Lost" | null {
  const value = status.trim().toLowerCase();
  if (["closed won", "converted", "deal won", "deal closed", "closed", "won"].includes(value)) return "Closed Won";
  if (["closed lost", "deal lost", "lost", "not interested"].includes(value)) return "Closed Lost";
  return null;
}

export const closedStatusesSql = "('closed won','converted','deal won','deal closed','closed','won','closed lost','deal lost','lost','not interested')";
// All queue queries use the same rule, including legacy closed leads.
export const activeFollowupSql = `f.status='Pending' AND lower(trim(c.status)) NOT IN ${closedStatusesSql}`;

export function readFollowup(data: FormData) {
  const value = (name: string) => String(data.get(name) ?? "").trim();
  const date = value("followup_date");
  const discussion = value("discussion");
  const inputStatus = value("status") || "Pending";
  const closure = closedLeadStatus(inputStatus);
  const status = closure || inputStatus;
  if (!["Pending", "Completed", "Closed Won", "Closed Lost"].includes(status)) throw new Error("Select a valid follow-up status.");
  const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!discussion || !validDate(date)) throw new Error("Add a valid follow-up date and discussion.");
  const nextDate = status === "Pending" ? value("next_followup_date") : "";
  if (status === "Pending" && !nextDate) throw new Error("Choose the next follow-up date to continue.");
  if (nextDate && (!validDate(nextDate) || nextDate < date)) throw new Error("Next follow-up date must be on or after the current follow-up date.");
  const type = value("type") || "Call";
  if (!["Call", "WhatsApp", "Email", "Site Visit", "Meeting", "Other"].includes(type)) throw new Error("Select a valid contact type.");
  return { date, discussion, status, closure, nextDate, type, result: value("result") };
}
