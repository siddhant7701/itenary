import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowRight, HandCoins, Plus, Receipt, Trash2 } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Progress, SectionTitle, Segmented, Select, Skeleton, StatCard, useConfirm } from '../../components/ui';
import UpiPaySheet from '../../components/UpiPaySheet';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { useSocketEvent } from '../../lib/socket';
import { EXPENSE_CATEGORY, fmtDate, inr } from '../../lib/format';

function ExpenseModal({ open, onClose, ctx, onSaved }) {
  const { data, tripId, user } = ctx;
  const [form, setForm] = useState({ title: '', amount: '', category: 'food', paid_by: user.id, spent_on: new Date().toISOString().slice(0, 10) });
  const [split, setSplit] = useState('equal');
  const [shares, setShares] = useState({});
  const [busy, setBusy] = useState(false);
  const amount = Number(String(form.amount).replace(/\D/g, '')) || 0;
  const customTotal = Object.values(shares).reduce((s, v) => s + (Number(v) || 0), 0);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/trips/${tripId}/expenses`, { ...form, amount, shares: split === 'custom' ? shares : undefined });
      toast.success('Expense added');
      onSaved();
      onClose();
      setForm((f) => ({ ...f, title: '', amount: '' }));
      setShares({});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add an expense" size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="What for?"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Dinner at Mall Road" required maxLength={120} /></Field>
          <Field label="Amount ₹"><Input inputMode="numeric" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="1200" required /></Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EXPENSE_CATEGORY).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, category: k }))} className={clsx('chip', form.category === k && 'chip-active')}>{v.emoji} {v.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by">
            <Select value={form.paid_by} onChange={(e) => setForm((f) => ({ ...f, paid_by: e.target.value }))}>
              {data.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === user.id ? 'You' : m.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.spent_on} onChange={(e) => setForm((f) => ({ ...f, spent_on: e.target.value }))} /></Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Split</span>
            <Segmented size="sm" value={split} onChange={setSplit} options={[{ value: 'equal', label: 'Equally' }, { value: 'custom', label: 'Custom' }]} />
          </div>
          {split === 'equal' ? (
            <p className="rounded-xl bg-paper px-3 py-2.5 text-[13px] text-muted">{amount ? `${inr(Math.floor(amount / data.members.length))} each` : 'Split equally'} across {data.members.length} travellers</p>
          ) : (
            <div className="space-y-2">
              {data.members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <Avatar user={{ ...m, id: m.user_id }} size={28} />
                  <span className="flex-1 text-sm font-medium">{m.name}</span>
                  <Input inputMode="numeric" className="w-28" value={shares[m.user_id] || ''} onChange={(e) => setShares((s) => ({ ...s, [m.user_id]: e.target.value.replace(/\D/g, '') }))} placeholder="0" />
                </div>
              ))}
              <p className={clsx('text-right text-xs font-semibold', customTotal === amount ? 'text-emerald-700' : 'text-rose-600')}>{inr(customTotal)} of {inr(amount)} assigned</p>
            </div>
          )}
        </div>
        <Button type="submit" className="w-full" loading={busy} disabled={!amount || (split === 'custom' && customTotal !== amount)}>Add expense</Button>
      </form>
    </Modal>
  );
}

export default function BudgetTab({ ctx }) {
  const { data, tripId, user, isOwner } = ctx;
  const { data: b, loading, reload } = useFetch(`/trips/${tripId}/budget/split`);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(null);
  const confirm = useConfirm();
  useSocketEvent('trip:event', (ev) => ev.tripId === tripId && ev.type === 'expense' && reload());

  if (loading || !b) return <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>;

  const name = (id) => (id === user.id ? 'You' : data.members.find((m) => m.user_id === id)?.name.split(' ')[0] || 'Someone');
  const member = (id) => data.members.find((m) => m.user_id === id);
  const me = b.balances.find((x) => x.user_id === user.id);
  const pie = b.by_category.map((c) => ({ ...c, ...EXPENSE_CATEGORY[c.category] }));
  const openRequests = b.settlements.filter((s) => s.status === 'requested');

  async function requestMoney(s) {
    try {
      await api.post(`/trips/${tripId}/settlements`, { from_user: s.from_user, to_user: s.to_user, amount: s.amount, note: 'Trip settle-up' });
      toast.success(`Requested ${inr(s.amount)} from ${name(s.from_user)} — they’ve been notified`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function payDirect(s) {
    // create the settlement (from me → them), then pay it
    const r = await api.post(`/trips/${tripId}/settlements`, { from_user: s.from_user, to_user: s.to_user, amount: s.amount, note: 'Trip settle-up' });
    setPaying(r.settlement);
  }

  async function removeExpense(e) {
    if (!(await confirm({ title: `Delete “${e.title}”?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/trips/${tripId}/expenses/${e.id}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total spent" value={inr(b.total_spent)} hint={b.budget ? `of ${inr(b.budget)} budget` : 'No budget set'} icon={Receipt} />
        <StatCard label="Per person" value={inr(b.per_person)} hint={`${data.members.length} travellers`} icon={HandCoins} tone="marigold" />
        <StatCard label="You paid" value={inr(me?.paid || 0)} hint={`Your share ${inr(me?.share || 0)}`} tone="blue" />
        <StatCard label={me?.net >= 0 ? 'You get back' : 'You owe'} value={inr(Math.abs(me?.net || 0))} tone={me?.net >= 0 ? 'green' : 'red'} />
      </div>

      {b.budget > 0 && (
        <Card>
          <div className="flex justify-between text-sm"><span className="font-semibold">Budget used</span><span className="font-bold">{Math.round((b.total_spent / b.budget) * 100)}%</span></div>
          <Progress value={b.total_spent} max={b.budget} className="mt-2 h-3" tone={b.total_spent > b.budget ? 'red' : b.total_spent > b.budget * 0.8 ? 'marigold' : 'plum'} />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <SectionTitle title="Where the money went" />
          {pie.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No expenses yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} dataKey="amount" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                      {pie.map((p) => <Cell key={p.category} fill={p.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => inr(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-2">
                {pie.map((p) => (
                  <div key={p.category} className="flex items-center gap-2 text-[13.5px]">
                    <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="flex-1">{p.emoji} {p.label}</span>
                    <span className="font-bold">{inr(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 space-y-3">
            <div className="label">Each member’s contribution</div>
            {b.balances.map((x) => (
              <div key={x.user_id} className="flex items-center gap-3">
                <Avatar user={{ id: x.user_id, name: x.name, avatar_url: x.avatar_url }} size={30} />
                <div className="flex-1">
                  <div className="flex justify-between text-[13px]"><span className="font-semibold">{name(x.user_id)}</span><span className="text-muted">paid {inr(x.paid)} · share {inr(x.share)}</span></div>
                  <Progress value={x.paid} max={Math.max(1, ...b.balances.map((y) => y.paid))} className="mt-1" tone={x.net >= 0 ? 'green' : 'marigold'} />
                </div>
                <span className={clsx('w-20 text-right text-[13px] font-bold', x.net >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{x.net >= 0 ? '+' : '−'}{inr(Math.abs(x.net))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Settle up" subtitle="Fewest UPI transfers to square everyone off" />
          {openRequests.length > 0 && (
            <div className="mb-4 space-y-2">
              {openRequests.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-marigold-200 bg-marigold-50/60 p-3">
                  <Badge tone="marigold">Requested</Badge>
                  <span className="flex-1 text-[13.5px]"><b>{name(s.from_user)}</b> → <b>{name(s.to_user)}</b> · {inr(s.amount)}</span>
                  {s.from_user === user.id ? (
                    <Button size="xs" onClick={() => setPaying(s)}>Pay via UPI</Button>
                  ) : s.to_user === user.id ? (
                    <Button size="xs" variant="ghost" onClick={() => api.post(`/settlements/${s.id}/decline`).then(reload).catch((e) => toast.error(e.message))}>Cancel</Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {b.suggestions.length === 0 ? (
            <EmptyState emoji="🤝" title="All square!" description="Nobody owes anybody. Chai’s on whoever’s closest." className="py-8" />
          ) : (
            <div className="space-y-2">
              {b.suggestions.map((s, i) => {
                const pending = openRequests.some((r) => r.from_user === s.from_user && r.to_user === s.to_user);
                const toUpi = b.balances.find((x) => x.user_id === s.to_user)?.upi_id;
                return (
                  <div key={i} className="flex flex-wrap items-center gap-3 rounded-2xl bg-paper p-3">
                    <Avatar user={{ ...member(s.from_user), id: s.from_user }} size={30} />
                    <ArrowRight className="size-4 text-muted" />
                    <Avatar user={{ ...member(s.to_user), id: s.to_user }} size={30} />
                    <div className="min-w-0 flex-1 text-[13.5px]">
                      <b>{name(s.from_user)}</b> pays <b>{name(s.to_user)}</b>
                      {toUpi && <div className="truncate text-[11px] text-muted">UPI: {toUpi}</div>}
                    </div>
                    <span className="font-bold">{inr(s.amount)}</span>
                    {!pending && s.from_user === user.id && <Button size="xs" onClick={() => payDirect(s)}>Pay now</Button>}
                    {!pending && s.to_user === user.id && <Button size="xs" variant="soft" onClick={() => requestMoney(s)}>Request</Button>}
                    {pending && <Badge tone="marigold">Requested</Badge>}
                  </div>
                );
              })}
            </div>
          )}
          {b.settlements.filter((s) => s.status === 'paid').length > 0 && (
            <div className="mt-5">
              <div className="label">Settled</div>
              {b.settlements.filter((s) => s.status === 'paid').map((s) => (
                <div key={s.id} className="flex justify-between py-1 text-[13px] text-muted"><span>{name(s.from_user)} → {name(s.to_user)}</span><span className="font-semibold text-emerald-700">✓ {inr(s.amount)}</span></div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5">
          <SectionTitle title="Expenses" subtitle="Bookings made through Itenary are added automatically" className="mb-0" />
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>Add</Button>
        </div>
        <div className="mt-3 divide-y divide-line">
          {b.expenses.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Log fuel, tolls, dinners — anything the group shares.</p>}
          {b.expenses.map((e) => {
            const c = EXPENSE_CATEGORY[e.category] || EXPENSE_CATEGORY.other;
            return (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${c.color}14` }}>{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{e.title} {e.booking_id && <Badge tone="plum" className="ml-1">Booking</Badge>}</div>
                  <div className="text-[12px] text-muted">{name(e.paid_by)} paid · {fmtDate(e.spent_on, 'D MMM')} · {e.split_type === 'custom' ? 'custom split' : 'split equally'}</div>
                </div>
                <span className="font-bold">{inr(e.amount)}</span>
                {!e.booking_id && (e.paid_by === user.id || isOwner) && (
                  <button onClick={() => removeExpense(e)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-600" aria-label="Delete expense"><Trash2 className="size-4" /></button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <ExpenseModal open={adding} onClose={() => setAdding(false)} ctx={ctx} onSaved={reload} />
      {paying && (
        <UpiPaySheet
          open={!!paying}
          onClose={() => setPaying(null)}
          amount={paying.amount}
          title={`Pay ${name(paying.to_user)}`}
          lines={[{ label: 'To', value: member(paying.to_user)?.name || '' }, { label: 'For', value: data.trip.name }]}
          onPay={(auth) => api.post(`/settlements/${paying.id}/pay`, auth)}
          onDone={() => {
            toast.success('Settled! 🤝');
            reload();
          }}
        />
      )}
    </div>
  );
}
