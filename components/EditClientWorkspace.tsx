'use client';
import { useState } from 'react';
import Link from 'next/link';
import ActionForm from '@/components/ActionForm';
import ClientForm from '@/components/ClientForm';
import FollowupWorkspace from '@/components/FollowupWorkspace';
import { updateClient } from '@/app/actions';
import type { Followup } from '@/lib/followups';

export default function EditClientWorkspace({ client, followups, currentDate }: { client: any; followups: Followup[]; currentDate: string }) {
  const [status, setStatus] = useState(client.status);
  return <>
    <section className="card card-pad form-card"><ActionForm action={updateClient.bind(null, client.id)}>
      <ClientForm client={client} onStatusChange={setStatus} />
      <div className="form-actions"><Link className="btn" href={`/clients/${client.id}`}>Cancel</Link><button className="btn btn-primary">Save Changes</button></div>
    </ActionForm></section>
    <FollowupWorkspace client={client} followups={followups} currentDate={currentDate} selectedLeadStatus={status} />
  </>;
}
