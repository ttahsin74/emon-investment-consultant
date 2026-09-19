import db from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHead from '@/components/PageHead';
import EditClientWorkspace from '@/components/EditClientWorkspace';
import type { Followup } from '@/lib/followups';
import { today } from '@/lib/utils';

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = (await db.prepare('SELECT * FROM clients WHERE id=?').get(Number(id))) as any;
  if (!client) notFound();
  const followups = (await db.prepare('SELECT * FROM followups WHERE client_id=? ORDER BY followup_date DESC, id DESC').all(client.id)).map((row) => ({ ...row })) as Followup[];
  return <><PageHead title="Edit Client" subtitle={`Update ${client.name}'s information and review the complete conversation history.`} action={<Link className="btn" href="#followup-workspace">Follow-ups</Link>} />
    <EditClientWorkspace client={{ ...client }} followups={followups} currentDate={today()} />
  </>;
}
