import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return new NextResponse('Unauthorized', { status: 401 });

  const from = request.nextUrl.searchParams.get('from') || '';
  const to = request.nextUrl.searchParams.get('to') || '';
  let where = '1=1';
  const args: string[] = [];
  if (from) { where += ' AND date(s.sale_date)>=date(?)'; args.push(from); }
  if (to) { where += ' AND date(s.sale_date)<=date(?)'; args.push(to); }

  const sales = (await db.prepare(`SELECT s.sale_date AS "Sale Date", c.name AS "Client", c.phone AS "Phone", s.service AS "Property / Service", s.invoice_number AS "Invoice", s.amount AS "Amount", s.discount AS "Discount", s.final_amount AS "Final Amount", s.paid_amount AS "Paid Amount", s.payment_status AS "Payment Status", s.payment_method AS "Payment Method" FROM sales s JOIN clients c ON c.id=s.client_id WHERE ${where} ORDER BY date(s.sale_date) DESC`).all(...args)) as Record<string, unknown>[];
  const clients = (await db.prepare('SELECT name AS "Name", profession AS "Profession", company AS "Company", phone AS "Phone", email AS "Email", deal_type AS "Deal Type", property_type AS "Property Type", preferred_location AS "Preferred Location", budget_range AS "Budget Range", status AS "Stage", source AS "Source", created_at AS "Added" FROM clients ORDER BY id DESC').all()) as Record<string, unknown>[];
  const followups = (await db.prepare(`SELECT c.name AS "Client", c.phone AS "Phone", f.followup_date AS "Follow Up Date", f.type AS "Type", f.discussion AS "Discussion", f.result AS "Result", f.next_followup_date AS "Next Follow Up", f.status AS "Status" FROM followups f JOIN clients c ON c.id=f.client_id ORDER BY date(COALESCE(NULLIF(f.next_followup_date,''),f.followup_date)) ASC`).all()) as Record<string, unknown>[];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sales), 'Sales Report');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(clients), 'Clients');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(followups), 'Follow Ups');
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const suffix = from || to ? `-${from || 'start'}-to-${to || 'today'}` : '';

  return new NextResponse(new Uint8Array(output), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="crm-report${suffix}.xlsx"`,
    },
  });
}
