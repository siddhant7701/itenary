import { useState } from 'react';
import { toast } from 'sonner';
import { Banknote, Check, HandCoins, Send, X } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, Tabs, useConfirm } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { fmtDateTime, inr, timeAgo } from '../../lib/format';
import DataTable from './DataTable';
import { CopyText, MiniStat, PAYOUT_STATUS, StatusBadge, UserCell, qs, useAdmin, usePrompt, useQueryParams } from './kit';

const DEFAULTS = { status: '' };

export default function Payouts() {
  const [f, setF] = useQueryParams(DEFAULTS);
  const all = useFetch('/admin/payouts', { scope: 'admin' });
  const filteredFetch = useFetch(f.status ? `/admin/payouts${qs({ status: f.status })}` : null, { scope: 'admin' });
  const { data, loading, error } = f.status ? filteredFetch : all;
  const reload = () => {
    all.reload();
    if (f.status) filteredFetch.reload();
  };
  const { refresh } = useAdmin();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [busy, setBusy] = useState(null);

  const everything = all.data?.payouts || [];
  const pending = everything.filter((p) => p.status === 'requested' || p.status === 'approved');
  const paid = everything.filter((p) => p.status === 'paid');
  const count = (s) => everything.filter((p) => p.status === s).length;

  const update = async (p, status) => {
    let note;
    if (status === 'rejected') {
      note = await prompt({
        title: `Reject ${inr(p.amount)} payout?`,
        description: `${p.creator_name} will be notified with your note. Their earnings stay in their balance.`,
        label: 'Reason',
        placeholder: 'e.g. UPI ID could not be verified — please update it and request again',
        confirmLabel: 'Reject payout',
        tone: 'danger',
        required: true,
        maxLength: 200,
      });
      if (note === null) return;
    }
    if (status === 'paid') {
      const ok = await confirm({ title: `Send ${inr(p.amount)} to ${p.creator_name}?`, description: `A UPI payout will be made to ${p.upi_id}. This can’t be reversed from here.`, confirmLabel: 'Send payout' });
      if (!ok) return;
    }
    setBusy(p.id + status);
    try {
      await adminApi.patch(`/admin/payouts/${p.id}`, { status, note });
      toast.success(status === 'paid' ? `${inr(p.amount)} sent to ${p.upi_id}` : status === 'approved' ? 'Payout approved' : 'Payout rejected');
      reload();
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    { key: 'creator', header: 'Creator', mobile: 'title', render: (p) => <UserCell user={{ id: p.creator_id, name: p.creator_name }} sub={p.creator_phone} to={`/admin/users/${p.creator_id}`} /> },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-display text-[15px] font-extrabold tabular-nums text-ink">{inr(p.amount)}</span> },
    { key: 'upi_id', header: 'UPI ID', stop: true, render: (p) => <CopyText value={p.upi_id} /> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge map={PAYOUT_STATUS} value={p.status} /> },
    {
      key: 'created_at',
      header: 'Requested',
      render: (p) => (
        <span className="whitespace-nowrap text-muted" title={fmtDateTime(p.created_at)}>
          {timeAgo(p.created_at)}
        </span>
      ),
    },
    {
      key: 'processed_at',
      header: 'Processed',
      render: (p) => (
        <div className="max-w-[220px]">
          <div className="whitespace-nowrap text-muted">{p.processed_at ? fmtDateTime(p.processed_at) : '—'}</div>
          {p.note && <div className="truncate text-[11.5px] text-muted">“{p.note}”</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stop: true,
      wide: true,
      render: (p) =>
        p.status === 'requested' || p.status === 'approved' ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {p.status === 'requested' && (
              <Button size="xs" variant="soft" icon={Check} loading={busy === p.id + 'approved'} disabled={!!busy} onClick={() => update(p, 'approved')}>
                Approve
              </Button>
            )}
            <Button size="xs" variant="success" icon={Send} loading={busy === p.id + 'paid'} disabled={!!busy} onClick={() => update(p, 'paid')}>
              Mark paid
            </Button>
            <Button size="xs" variant="danger-soft" icon={X} loading={busy === p.id + 'rejected'} disabled={!!busy} onClick={() => update(p, 'rejected')}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Creator payouts" subtitle="Creators request their marketplace earnings to a UPI ID. Approve, pay or reject each request." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Awaiting action" value={pending.length} hint={`${inr(pending.reduce((s, p) => s + p.amount, 0))} to send`} />
        <MiniStat label="Approved, unpaid" value={count('approved')} />
        <MiniStat label="Paid out" value={inr(paid.reduce((s, p) => s + p.amount, 0))} hint={`${paid.length} payouts`} />
        <MiniStat label="Rejected" value={count('rejected')} />
      </div>
      <Tabs
        className="mb-4"
        value={f.status || 'all'}
        onChange={(status) => setF({ status: status === 'all' ? '' : status })}
        tabs={[
          { id: 'all', label: 'All', icon: Banknote },
          { id: 'requested', label: 'Requested', count: count('requested') },
          { id: 'approved', label: 'Approved', count: count('approved') },
          { id: 'paid', label: 'Paid' },
          { id: 'rejected', label: 'Rejected' },
        ]}
      />
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.payouts}
          loading={loading}
          rowClassName={(p) => (p.status === 'requested' ? 'bg-marigold-50/40' : '')}
          empty={<EmptyState icon={HandCoins} title={f.status ? `No ${PAYOUT_STATUS[f.status]?.label.toLowerCase()} payouts` : 'No payout requests yet'} description="When creators withdraw their marketplace earnings, requests show up here." />}
        />
      )}
    </div>
  );
}
