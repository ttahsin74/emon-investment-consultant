'use client';
import ActionForm from '@/components/ActionForm';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, PhoneCall, BadgeDollarSign, ChartNoAxesCombined, Settings, LogOut, CalendarDays, CalendarCheck2, ListTodo, Megaphone, Clock3, CalendarHeart, ContactRound } from 'lucide-react';
import { logoutAction } from '@/app/actions';

const links = [
  ['/dashboard','Dashboard',LayoutDashboard],
  ['/clients','Clients',Users],
  ['/followups','Follow Ups',PhoneCall],
  ['/meetings','Meetings',CalendarDays],
  ['/appointments','Appointments',CalendarCheck2],
  ['/tasks','Task Board',ListTodo],
  // ['/notices','Office Notice',Megaphone],
  // ['/attendance','Attendance',Clock3],
  // ['/leave','Leave',CalendarHeart],
  ['/events','Event Guests',ContactRound],
  ['/sales','Sales',BadgeDollarSign],
  ['/reports','Reports',ChartNoAxesCombined],
  ['/settings','Settings',Settings],
] as const;

export default function Sidebar(){const pathname=usePathname();return <aside className="sidebar"><div className="brand"><div className="brandmark">CM</div><div><h2>Client Manager</h2><span>Professional CRM</span></div></div><div className="nav-caption">WORKSPACE</div><nav className="nav" aria-label="Main navigation">{links.map(([href,label,Icon])=>{const active=pathname===href||pathname.startsWith(`${href}/`);return <Link key={href} href={href} className={active?'active':''} aria-current={active?'page':undefined} title={label}><Icon size={18}/><span>{label}</span></Link>})}</nav><div className="sidebar-foot"><ActionForm action={logoutAction}><button aria-label="Sign out" className="btn btn-ghost" style={{width:'100%'}}><LogOut size={16}/><span>Logout</span></button></ActionForm></div></aside>}
