import { ReactNode } from 'react';
export default function PageHead({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}){return <div className="pagehead"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
