import db from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHead from '@/components/PageHead';
import FollowupWorkspace from '@/components/FollowupWorkspace';
import type { Followup } from '@/lib/followups';
import { today } from '@/lib/utils';

export default async function EditFollowup({ params }: { params: Promise<{ id: string; followupId: string }> }) {
  const { id, followupId } = await params;
  const client = (await db.prepare('SELECT id,name,status FROM clients WHERE id=?').get(Number(id))) as any;
  const followups = (await db.prepare('SELECT * FROM followups WHERE client_id=? ORDER BY followup_date DESC, id DESC').all(Number(id))).map((row) => ({ ...row })) as Followup[];
  const followup = followups.find((entry) => entry.id === Number(followupId));
  if (!client || !followup) notFound();
  return <><PageHead title="Follow Ups" subtitle={`Review the complete history for ${client.name}.`} action={<Link className="btn" href={`/clients/${client.id}`}>Back to client</Link>} />
    <FollowupWorkspace client={{ ...client }} followups={followups} currentDate={today()} />
  </>;
}
