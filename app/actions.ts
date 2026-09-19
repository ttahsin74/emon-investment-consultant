"use server";
export const runtime = "nodejs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import db from "@/lib/db";
import { closedLeadStatus, readFollowup } from "@/lib/followups";
import { expectedAuthToken, getAdminEmail, isAuthenticated, updateAdminCredentials, verifyAdminCredentials } from "@/lib/auth";

const s = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const n = (v: FormDataEntryValue | null) => {
  const value = Number(v || 0);
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Enter a valid, non-negative amount.");
  return value;
};
async function requireAdmin() {
  if (!(await isAuthenticated())) redirect("/login");
}
function validateClient(data: FormData) {
  if (!s(data.get("name")) || !s(data.get("phone")))
    throw new Error("Client name and phone are required.");
  n(data.get("budget"));
}
const transaction = db.transaction;
async function requireOpenLead(clientId: number) {
  const client = (await db.prepare("SELECT status FROM clients WHERE id=?").get(clientId)) as { status: string } | undefined;
  if (!client) throw new Error("Client not found.");
  if (closedLeadStatus(client.status)) throw new Error("This lead is closed. Reopen it in Edit Client before adding follow-ups.");
}
async function requireEditableFollowup(id: number, clientId: number) {
  (await requireOpenLead(clientId));
  const record = (await db.prepare("SELECT status FROM followups WHERE id=? AND client_id=?").get(id, clientId)) as { status: string } | undefined;
  if (!record) throw new Error("Follow-up not found for this client.");
  if (record.status !== "Pending") throw new Error("This follow-up is archived. Log a new conversation instead.");
}
async function settleFollowups(clientId: number) {
  // Keep original notes and planned dates as history; remove them from the queue.
  (await db.prepare("UPDATE followups SET status='Completed' WHERE client_id=? AND status='Pending'").run(clientId));
}

export async function loginAction(formData: FormData) {
  const email = s(formData.get("email"));
  const password = s(formData.get("password"));
  if (!(await verifyAdminCredentials(email, password))) {
    redirect("/login?error=1");
  }
  const store = await cookies();
  store.set("cms_auth", (await expectedAuthToken()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  redirect("/dashboard");
}

export async function updateAdminLogin(formData: FormData) {
  await requireAdmin();
  const currentPassword = s(formData.get("current_password"));
  const email = s(formData.get("login_email")).toLowerCase();
  const password = s(formData.get("new_password"));
  if (!email || !email.includes("@")) throw new Error("Enter a valid login email.");
  if (!(await verifyAdminCredentials((await getAdminEmail()), currentPassword)))
    throw new Error("Current password is incorrect.");
  if (password.length < 6) throw new Error("New password must be at least 6 characters.");
  (await updateAdminCredentials(email, password));
  const store = await cookies();
  store.set("cms_auth", (await expectedAuthToken()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  revalidatePath("/settings");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete("cms_auth");
  redirect("/login");
}

export async function updateAdminProfile(formData: FormData) {
  await requireAdmin();
  revalidatePath("/", "layout");
  const name = s(formData.get("name")) || "Admin";
  const currentProfile = (await db
    .prepare("SELECT image_url FROM admin_profile WHERE id=1")
    .get()) as { image_url?: string } | undefined;
  const image = formData.get("image");
  let imageUrl = currentProfile?.image_url || "";

  if (image instanceof File && image.size > 0) {
    const imageTypes: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    if (!imageTypes[image.type])
      throw new Error("Please upload a PNG, JPG, WEBP or GIF image.");
    if (image.size > 5 * 1024 * 1024)
      throw new Error("Image must be smaller than 5MB");
    const extension = imageTypes[image.type];
    const filename = `${randomUUID()}.${extension}`;
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
      redirect("/settings?error=blob-config");
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`admin-profile/${filename}`, imageBuffer, {
          access: "public",
          addRandomSuffix: false,
          contentType: image.type,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        imageUrl = blob.url;
      } catch {
        redirect("/settings?error=blob-upload");
      }
    } else {
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "admin-profile",
      );
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), imageBuffer);
      imageUrl = `/uploads/admin-profile/${filename}`;
    }
  }

  (await db.prepare(
    `INSERT INTO admin_profile (id,name,phone,email,designation,image_url,updated_at) VALUES (1,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email,designation=excluded.designation,image_url=excluded.image_url,updated_at=CURRENT_TIMESTAMP`,
  ).run(
    name,
    s(formData.get("phone")),
    s(formData.get("email")),
    s(formData.get("designation")),
    imageUrl,
  ));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}

export async function createClient(formData: FormData) {
  await requireAdmin();
  revalidatePath("/", "layout");
  validateClient(formData);
  const info = {
    name: s(formData.get("name")),
    profession: s(formData.get("profession")),
    company: s(formData.get("company")),
    phone: s(formData.get("phone")),
    alt: s(formData.get("alt_phone")),
    email: s(formData.get("email")),
    address: s(formData.get("address")),
    source: s(formData.get("source")) || "Website",
    status: s(formData.get("status")) || "New Inquiry",
    service: s(formData.get("interested_service")),
    dealType: s(formData.get("deal_type")) || "Buy",
    propertyType: s(formData.get("property_type")),
    preferredLocation: s(formData.get("preferred_location")),
    budget: n(formData.get("budget")),
    budgetRange: s(formData.get("budget_range")),
    closingDate: s(formData.get("closing_date")),
    progressNote: s(formData.get("progress_note")),
    notes: s(formData.get("notes")),
    website: s(formData.get("website")),
    facebook: s(formData.get("facebook")),
    linkedin: s(formData.get("linkedin")),
  };

  if (!info.name || !info.phone) throw new Error("Name and phone are required");

  const r = (await db
    .prepare(
      `INSERT INTO clients (name,profession,company,phone,alt_phone,email,address,source,status,interested_service,deal_type,property_type,preferred_location,budget,budget_range,closing_date,progress_note,notes,website,facebook,linkedin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      info.name,
      info.profession,
      info.company,
      info.phone,
      info.alt,
      info.email,
      info.address,
      info.source,
      info.status,
      info.service,
      info.dealType,
      info.propertyType,
      info.preferredLocation,
      info.budget,
      info.budgetRange,
      info.closingDate,
      info.progressNote,
      info.notes,
      info.website,
      info.facebook,
      info.linkedin,
    ));

  (await db.prepare(
    `INSERT INTO activities (client_id,type,description) VALUES (?,?,?)`,
  ).run(
    Number(r.lastInsertRowid),
    "Client Created",
    `New ${info.dealType.toLowerCase()} inquiry created for ${info.name}.`,
  ));
  revalidatePath("/clients");
  redirect(`/clients/${r.lastInsertRowid}`);
}

export async function updateClient(id: number, formData: FormData) {
  validateClient(formData);
  await requireAdmin();
  revalidatePath("/", "layout");
  (await transaction(async () => {
    (await db.prepare(
      `UPDATE clients SET name=?,profession=?,company=?,phone=?,alt_phone=?,email=?,address=?,source=?,status=?,interested_service=?,deal_type=?,property_type=?,preferred_location=?,budget=?,budget_range=?,closing_date=?,progress_note=?,notes=?,website=?,facebook=?,linkedin=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).run(
      s(formData.get("name")),
      s(formData.get("profession")),
      s(formData.get("company")),
      s(formData.get("phone")),
      s(formData.get("alt_phone")),
      s(formData.get("email")),
      s(formData.get("address")),
      s(formData.get("source")),
      closedLeadStatus(s(formData.get("status"))) || s(formData.get("status")),
      s(formData.get("interested_service")),
      s(formData.get("deal_type")),
      s(formData.get("property_type")),
      s(formData.get("preferred_location")),
      n(formData.get("budget")),
      s(formData.get("budget_range")),
      s(formData.get("closing_date")),
      s(formData.get("progress_note")),
      s(formData.get("notes")),
      s(formData.get("website")),
      s(formData.get("facebook")),
      s(formData.get("linkedin")),
      id,
    ));

    (await db.prepare(
      `INSERT INTO activities (client_id,type,description) VALUES (?,?,?)`,
    ).run(id, "Client Updated", "Client information updated."));
    if (closedLeadStatus(s(formData.get("status")))) (await settleFollowups(id));
  }));
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: number) {
  await requireAdmin();
  revalidatePath("/", "layout");
  (await db.prepare("DELETE FROM clients WHERE id=?").run(id));
  revalidatePath("/clients");
  redirect("/clients");
}

export async function addFollowup(formData: FormData) {
  await requireAdmin();
  const entry = readFollowup(formData);
  const clientId = n(formData.get("client_id"));
  (await transaction(async () => {
    (await requireOpenLead(clientId));
    (await settleFollowups(clientId));
    (await db.prepare(`INSERT INTO followups (client_id,followup_date,type,discussion,result,next_followup_date,status) VALUES (?,?,?,?,?,?,?)`)
      .run(clientId, entry.date, entry.type, entry.discussion, entry.result, entry.nextDate, entry.status));
    if (entry.closure) (await db.prepare("UPDATE clients SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(entry.closure, clientId));
    (await db.prepare("INSERT INTO activities (client_id,type,description) VALUES (?,?,?)")
      .run(clientId, entry.closure ? "Lead Closed" : "Follow Up Added", `${entry.type}: ${entry.status}. ${entry.result}`));
  }));
  revalidatePath("/", "layout");
  redirect(`/clients/${clientId}#followup-workspace`);
}

export async function completeFollowup(id: number, clientId: number) {
  await requireAdmin();
  (await transaction(async () => {
    (await requireEditableFollowup(id, clientId));
    (await db.prepare("UPDATE followups SET status='Completed' WHERE id=? AND client_id=?").run(id, clientId));
    (await db.prepare("INSERT INTO activities (client_id,type,description) VALUES (?,?,?)")
      .run(clientId, "Follow Up Completed", "Conversation completed; lead remains open."));
  }));
  revalidatePath("/", "layout");
}

export async function updateFollowup(id: number, clientId: number, formData: FormData) {
  await requireAdmin();
  const entry = readFollowup(formData);
  (await transaction(async () => {
    (await requireEditableFollowup(id, clientId));
    (await db.prepare(`UPDATE followups SET followup_date=?,type=?,discussion=?,result=?,next_followup_date=?,status=? WHERE id=? AND client_id=?`)
      .run(entry.date, entry.type, entry.discussion, entry.result, entry.nextDate, entry.status, id, clientId));
    if (entry.closure) {
      (await db.prepare("UPDATE clients SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(entry.closure, clientId));
      (await settleFollowups(clientId));
    }
    (await db.prepare("INSERT INTO activities (client_id,type,description) VALUES (?,?,?)")
      .run(clientId, entry.closure ? "Lead Closed" : "Follow Up Updated", `Follow-up saved: ${entry.status}.`));
  }));
  revalidatePath("/", "layout");
  redirect(`/clients/${clientId}#followup-workspace`);
}

export async function deleteFollowup(id: number, clientId: number) {
  await requireAdmin();
  (await transaction(async () => {
    (await requireEditableFollowup(id, clientId));
    (await db.prepare("DELETE FROM followups WHERE id=? AND client_id=?").run(id, clientId));
  }));
  revalidatePath("/", "layout");
}

export async function addSale(formData: FormData) {
  await requireAdmin();
  revalidatePath("/", "layout");
  const clientId = n(formData.get("client_id"));
  const amount = n(formData.get("amount"));
  const discount = n(formData.get("discount"));
  const finalAmount = Math.max(0, amount - discount);
  const paid = n(formData.get("paid_amount"));
  if (!s(formData.get("service")) || !s(formData.get("sale_date")))
    throw new Error("Property / service and sale date are required.");
  if (discount > amount || paid > finalAmount)
    throw new Error(
      "Discount cannot exceed the amount, and payment cannot exceed the final total.",
    );
  const paymentStatus =
    paid >= finalAmount ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
  (await db.prepare(
    `INSERT INTO sales (client_id,service,invoice_number,amount,discount,final_amount,paid_amount,payment_status,payment_method,sale_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    clientId,
    s(formData.get("service")),
    s(formData.get("invoice_number")),
    amount,
    discount,
    finalAmount,
    paid,
    paymentStatus,
    s(formData.get("payment_method")),
    s(formData.get("sale_date")),
    s(formData.get("notes")),
  ));
  (await db.prepare(
    `INSERT INTO activities (client_id,type,description) VALUES (?,?,?)`,
  ).run(clientId, "Sale Added", `${s(formData.get("service"))} sale added.`));
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/clients/${clientId}`);
  redirect("/sales");
}

export async function deleteSale(id: number, clientId: number) {
  await requireAdmin();
  revalidatePath("/", "layout");
  (await db.prepare("DELETE FROM sales WHERE id=?").run(id));
  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientProject(formData: FormData) {
  await requireAdmin();
  revalidatePath("/", "layout");
  const clientId = n(formData.get("client_id"));
  (await db.prepare(
    `INSERT INTO client_portfolio (client_id,title,project_type,description,start_date,end_date,status,price,image_url,project_url) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    clientId,
    s(formData.get("title")),
    s(formData.get("project_type")),
    s(formData.get("description")),
    s(formData.get("start_date")),
    s(formData.get("end_date")),
    s(formData.get("status")),
    n(formData.get("price")),
    s(formData.get("image_url")),
    s(formData.get("project_url")),
  ));
  (await db.prepare(
    `INSERT INTO activities (client_id,type,description) VALUES (?,?,?)`,
  ).run(
    clientId,
    "Project Added",
    `${s(formData.get("title"))} added to client portfolio.`,
  ));
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteClientProject(id: number, clientId: number) {
  await requireAdmin();
  revalidatePath("/", "layout");
  (await db.prepare("DELETE FROM client_portfolio WHERE id=?").run(id));
  revalidatePath(`/clients/${clientId}`);
}

export async function addAdminPortfolio(formData: FormData) {
  await requireAdmin();
  revalidatePath("/", "layout");
  (await db.prepare(
    `INSERT INTO admin_portfolio (title,category,client_name,description,image_url,project_url,technology,completion_date,featured) VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    s(formData.get("title")),
    s(formData.get("category")),
    s(formData.get("client_name")),
    s(formData.get("description")),
    s(formData.get("image_url")),
    s(formData.get("project_url")),
    s(formData.get("technology")),
    s(formData.get("completion_date")),
    formData.get("featured") ? 1 : 0,
  ));
  revalidatePath("/portfolio");
  redirect("/portfolio");
}

export async function deleteAdminPortfolio(id: number) {
  await requireAdmin();
  revalidatePath("/", "layout");
  (await db.prepare("DELETE FROM admin_portfolio WHERE id=?").run(id));
  revalidatePath("/portfolio");
}

export async function recordPayment(id: number, formData: FormData) {
  await requireAdmin();
  const sale = (await db.prepare("SELECT * FROM sales WHERE id=?").get(id)) as
    | { client_id: number; final_amount: number; paid_amount: number }
    | undefined;
  if (!sale) throw new Error("Sale no longer exists.");
  const payment = n(formData.get("payment"));
  const paid = Math.round((sale.paid_amount + payment) * 100) / 100;
  if (payment <= 0 || paid > sale.final_amount)
    throw new Error(
      "Enter a payment greater than zero and no more than the outstanding balance.",
    );
  (await db.prepare("UPDATE sales SET paid_amount=?, payment_status=? WHERE id=?").run(
    paid,
    paid >= sale.final_amount ? "Paid" : "Partial",
    id,
  ));
  (await db.prepare(
    "INSERT INTO activities (client_id,type,description) VALUES (?,?,?)",
  ).run(sale.client_id, "Payment Received", "Payment received: BDT " + payment));
  revalidatePath("/", "layout");
}

async function addNotification(title: string, message: string) {
  (await db.prepare("INSERT INTO notifications (title,message) VALUES (?,?)").run(
    title,
    message,
  ));
}

export async function saveDailyCollection(formData: FormData) {
  await requireAdmin();
  const date = s(formData.get("collection_date"));
  const probable = n(formData.get("probable_amount"));
  const collected = n(formData.get("collected_amount"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Select a valid collection date.");
  (await db.prepare(
    `INSERT INTO daily_collection (collection_date,probable_amount,collected_amount,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(collection_date) DO UPDATE SET probable_amount=excluded.probable_amount,collected_amount=excluded.collected_amount,updated_at=CURRENT_TIMESTAMP`,
  ).run(date, probable, collected));
  revalidatePath("/dashboard");
}

export async function addMeeting(formData: FormData) {
  await requireAdmin();
  const clientId = n(formData.get("client_id")) || null;
  const subject = s(formData.get("subject"));
  const date = s(formData.get("meeting_date"));
  if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Meeting subject and date are required.");
  (await db.prepare(
    `INSERT INTO meetings (client_id,subject,meeting_date,meeting_time,meeting_type,location,status,result,notes) VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    clientId,
    subject,
    date,
    s(formData.get("meeting_time")),
    s(formData.get("meeting_type")) || "Client Meeting",
    s(formData.get("location")),
    "Scheduled",
    "",
    s(formData.get("notes")),
  ));
  (await addNotification("Meeting scheduled", `${subject} is scheduled for ${date}.`));
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  redirect("/meetings");
}

export async function updateMeetingStatus(id: number, formData: FormData) {
  await requireAdmin();
  const status = s(formData.get("status")) || "Scheduled";
  const result = s(formData.get("result"));
  (await db.prepare("UPDATE meetings SET status=?, result=? WHERE id=?").run(
    status,
    result,
    id,
  ));
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function deleteMeeting(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM meetings WHERE id=?").run(id));
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function addAppointment(formData: FormData) {
  await requireAdmin();
  const clientId = n(formData.get("client_id")) || null;
  const title = s(formData.get("title"));
  const date = s(formData.get("appointment_date"));
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Appointment title and date are required.");
  (await db.prepare(
    `INSERT INTO appointments (client_id,title,appointment_date,appointment_time,location,status,notes) VALUES (?,?,?,?,?,?,?)`,
  ).run(
    clientId,
    title,
    date,
    s(formData.get("appointment_time")),
    s(formData.get("location")),
    "Scheduled",
    s(formData.get("notes")),
  ));
  (await addNotification(
    "Appointment scheduled",
    `${title} is scheduled for ${date}.`,
  ));
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  redirect("/appointments");
}

export async function updateAppointmentStatus(id: number, formData: FormData) {
  await requireAdmin();
  (await db.prepare("UPDATE appointments SET status=? WHERE id=?").run(
    s(formData.get("status")) || "Scheduled",
    id,
  ));
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function deleteAppointment(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM appointments WHERE id=?").run(id));
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  await requireAdmin();
  const title = s(formData.get("title"));
  const date = s(formData.get("task_date"));
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Task title and date are required.");
  const clientId = n(formData.get("client_id")) || null;
  (await db.prepare(
    `INSERT INTO tasks (client_id,title,description,task_date,priority,status) VALUES (?,?,?,?,?,?)`,
  ).run(
    clientId,
    title,
    s(formData.get("description")),
    date,
    s(formData.get("priority")) || "Normal",
    s(formData.get("status")) || "Pending",
  ));
  (await addNotification("Task added", `${title} was added to the task board.`));
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/tasks");
}

export async function updateTaskStatus(id: number, formData: FormData) {
  await requireAdmin();
  (await db.prepare(
    "UPDATE tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(s(formData.get("status")) || "Pending", id));
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTask(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM tasks WHERE id=?").run(id));
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function addNotice(formData: FormData) {
  await requireAdmin();
  const title = s(formData.get("title"));
  const body = s(formData.get("body"));
  if (!title || !body)
    throw new Error("Notice title and message are required.");
  (await db.prepare("INSERT INTO notices (title,body,status) VALUES (?,?,?)").run(
    title,
    body,
    s(formData.get("status")) || "Published",
  ));
  (await addNotification("New office notice", title));
  revalidatePath("/notices");
  revalidatePath("/dashboard");
  redirect("/notices");
}

export async function deleteNotice(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM notices WHERE id=?").run(id));
  revalidatePath("/notices");
  revalidatePath("/dashboard");
}

export async function addLeaveApplication(formData: FormData) {
  await requireAdmin();
  const start = s(formData.get("start_date"));
  const end = s(formData.get("end_date"));
  const reason = s(formData.get("reason"));
  if (!start || !end || !reason || end < start)
    throw new Error("Add a valid leave period and reason.");
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const days =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  (await db.prepare(
    "INSERT INTO leave_applications (leave_type,start_date,end_date,days,reason,status) VALUES (?,?,?,?,?,?)",
  ).run(
    s(formData.get("leave_type")) || "Casual Leave",
    start,
    end,
    days,
    reason,
    "Pending",
  ));
  (await addNotification(
    "Leave application submitted",
    `${days} day leave application submitted.`,
  ));
  revalidatePath("/leave");
  redirect("/leave");
}

export async function updateLeaveStatus(id: number, formData: FormData) {
  await requireAdmin();
  (await db.prepare("UPDATE leave_applications SET status=? WHERE id=?").run(
    s(formData.get("status")) || "Pending",
    id,
  ));
  revalidatePath("/leave");
}

export async function deleteLeave(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM leave_applications WHERE id=?").run(id));
  revalidatePath("/leave");
}

export async function saveAttendance(formData: FormData) {
  await requireAdmin();
  const date = s(formData.get("attendance_date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Select a valid attendance date.");
  (await db.prepare(
    `INSERT INTO attendance (attendance_date,check_in,check_out,status,remarks,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(attendance_date) DO UPDATE SET check_in=excluded.check_in,check_out=excluded.check_out,status=excluded.status,remarks=excluded.remarks,updated_at=CURRENT_TIMESTAMP`,
  ).run(
    date,
    s(formData.get("check_in")),
    s(formData.get("check_out")),
    s(formData.get("status")) || "Present",
    s(formData.get("remarks")),
  ));
  revalidatePath("/attendance");
  redirect("/attendance");
}

export async function deleteAttendance(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM attendance WHERE id=?").run(id));
  revalidatePath("/attendance");
}

export async function addEventGuest(formData: FormData) {
  await requireAdmin();
  const name = s(formData.get("name"));
  const eventName = s(formData.get("event_name"));
  const eventDate = s(formData.get("event_date"));
  if (!name || !eventName || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
    throw new Error("Guest name, event and date are required.");
  (await db.prepare(
    `INSERT INTO event_guests (name,phone,email,event_name,event_date,guest_type,status,remarks) VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    name,
    s(formData.get("phone")),
    s(formData.get("email")),
    eventName,
    eventDate,
    s(formData.get("guest_type")) || "Guest",
    s(formData.get("status")) || "Invited",
    s(formData.get("remarks")),
  ));
  revalidatePath("/events");
  redirect("/events");
}

export async function updateEventGuestStatus(id: number, formData: FormData) {
  await requireAdmin();
  (await db.prepare("UPDATE event_guests SET status=? WHERE id=?").run(
    s(formData.get("status")) || "Invited",
    id,
  ));
  revalidatePath("/events");
}

export async function deleteEventGuest(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("DELETE FROM event_guests WHERE id=?").run(id));
  revalidatePath("/events");
}

export async function markNotificationRead(id: number, formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("UPDATE notifications SET is_read=1 WHERE id=?").run(id));
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(formData: FormData) {
  await requireAdmin();
  void formData;
  (await db.prepare("UPDATE notifications SET is_read=1").run());
  revalidatePath("/notifications");
}
