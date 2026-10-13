import Link from 'next/link';
import type {ReactNode} from 'react';
import {AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon} from 'lucide-react';
import {humanize, statusTone, type Tone} from '@/lib/brand';

/** Premium UI primitives shared by every Charis page. Server-safe, no client JS. */

export function StatusBadge({status, tone, children}: {status?: string | null; tone?: Tone; children?: ReactNode}) {
  const t = tone ?? statusTone(status);
  return <span className={`badge badge-${t}`}>{children ?? humanize(status)}</span>;
}

export function Stat({label, value, note, icon: Icon}: {label: string; value: ReactNode; note?: string; icon?: LucideIcon}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}{Icon && <span className="stat-icon"><Icon size={17} aria-hidden/></span>}</div>
      <strong className="stat-value">{value}</strong>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

export function Tile({href, icon: Icon, title, text, cta = 'Open'}: {href: string; icon: LucideIcon; title: string; text: string; cta?: string}) {
  return (
    <Link className="tile" href={href}>
      <span className="tile-icon"><Icon size={20} aria-hidden/></span>
      <strong>{title}</strong>
      <small>{text}</small>
      <span className="tile-arrow">{cta} →</span>
    </Link>
  );
}

const calloutIcon = {info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle} as const;
export function Callout({tone = 'info', children, alert}: {tone?: keyof typeof calloutIcon; children: ReactNode; alert?: boolean}) {
  const Icon = calloutIcon[tone];
  return <div className={`callout ${tone === 'info' ? '' : tone}`} role={alert || tone === 'danger' ? 'alert' : undefined}><Icon size={18} aria-hidden/><div>{children}</div></div>;
}

export function EmptyState({icon: Icon, title, text, children}: {icon: LucideIcon; title: string; text?: string; children?: ReactNode}) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={24} aria-hidden/></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Card({title, subtitle, action, children, flush}: {title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; flush?: boolean}) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''}`} style={flush || title ? {padding: 0} : undefined}>
      {title && <div className="card-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
      <div className={title ? (flush ? undefined : 'card-body') : undefined}>{children}</div>
    </section>
  );
}

/** Horizontal workflow tracker: Draft → Review → Approved → Sent. */
export function WorkflowStepper({status, queued}: {status?: string | null; queued?: boolean}) {
  const order = ['draft', 'pending_approval', 'approved', 'sent'];
  const current = queued ? 3 : status === 'rejected' ? 0 : Math.max(0, order.indexOf(status || 'draft'));
  const steps = [['Draft', 'Write and preview'], ['Review', 'Independent approver'], ['Approved', 'Ready to send'], ['Sent', 'Track delivery']];
  return (
    <ol className="stepper" aria-label="Campaign progress">
      {steps.map(([t, d], i) => (
        <li key={t} className={i < current ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="step-dot">{i < current ? '✓' : i + 1}</span><strong>{t}</strong><small>{d}</small>
        </li>
      ))}
    </ol>
  );
}
