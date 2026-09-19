import ActionForm from '@/components/ActionForm';
import Link from 'next/link';import PageHead from '@/components/PageHead';import ClientForm from '@/components/ClientForm';import { createClient } from '@/app/actions';
export default function NewClient(){return <><PageHead title="Add Client" subtitle="Create a new client profile."/><section className="card card-pad form-card"><ActionForm action={createClient}><ClientForm/><div className="form-actions"><Link className="btn" href="/clients">Cancel</Link><button className="btn btn-primary">Create Client</button></div></ActionForm></section></>}
