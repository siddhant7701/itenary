import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Crown, ShieldCheck, ShieldUser, UserPlus, Users as UsersIcon } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { fmtDate, timeAgo } from '../../lib/format';
import DataTable from './DataTable';
import { ChipToggle, FilterBar, FilterSelect, Pagination, SearchBox, StatusBadge, USER_STATUS, UserCell, VERIFICATION_STATUS, qs, useQueryParams } from './kit';

const DEFAULTS = { q: '', role: '', status: '', verification: '', plan: '', page: 1 };
const LIMIT = 25;

export function CreateAdminModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) return setError('Name and email are required.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    try {
      const { user } = await adminApi.post('/admin/admins', { name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success(`${user.name} can now sign in to the admin console`);
      setForm({ name: '', email: '', password: '' });
      onCreated?.(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create admin"
      description="Admins can see every trip, booking and payment, and act on them. Share credentials securely."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} icon={ShieldUser}>
            Create admin
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input value={form.name} onChange={set('name')} maxLength={60} placeholder="e.g. Ananya Rao" />
        </Field>
        <Field label="Work email">
          <Input type="email" value={form.email} onChange={set('email')} maxLength={120} placeholder="ananya@itenary.com" autoComplete="off" />
        </Field>
        <Field label="Temporary password" hint="At least 8 characters. Ask them to change it from Settings → Account.">
          <Input type="text" value={form.password} onChange={set('password')} maxLength={200} autoComplete="new-password" />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const [f, setF] = useQueryParams(DEFAULTS);
  const [creating, setCreating] = useState(false);
  const path = `/admin/users${qs({ q: f.q, role: f.role, status: f.status, verification: f.verification, plan: f.plan, page: f.page, limit: LIMIT })}`;
  const { data, loading, error, reload } = useFetch(path, { scope: 'admin' });
  const filtered = f.q || f.role || f.status || f.verification || f.plan;

  const columns = [
    {
      key: 'user',
      header: 'User',
      mobile: 'title',
      render: (u) => <UserCell user={u} sub={[u.phone, u.email].filter(Boolean).join(' · ') || '—'} />,
    },
    {
      key: 'tags',
      header: 'Role & plan',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.role === 'admin' && (
            <Badge tone="dark" icon={ShieldUser}>
              Admin
            </Badge>
          )}
          {u.plan === 'plus' ? (
            <Badge tone="marigold" icon={Crown}>
              Plus
            </Badge>
          ) : (
            u.role !== 'admin' && <Badge>Free</Badge>
          )}
          {u.verification_status === 'pending' && <StatusBadge map={VERIFICATION_STATUS} value="pending" />}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge map={USER_STATUS} value={u.status} /> },
    { key: 'home_city', header: 'City', render: (u) => u.home_city || <span className="text-muted">—</span> },
    { key: 'trip_count', header: 'Trips', align: 'right', render: (u) => <span className="tabular-nums">{u.trip_count}</span> },
    { key: 'booking_count', header: 'Bookings', align: 'right', render: (u) => <span className="tabular-nums">{u.booking_count}</span> },
    { key: 'itinerary_count', header: 'Itineraries', align: 'right', render: (u) => <span className="tabular-nums">{u.itinerary_count}</span> },
    { key: 'created_at', header: 'Joined', render: (u) => <span className="whitespace-nowrap text-muted">{fmtDate(u.created_at)}</span> },
    { key: 'last_seen_at', header: 'Last seen', render: (u) => <span className="whitespace-nowrap text-muted">{u.last_seen_at ? timeAgo(u.last_seen_at) : 'Never'}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={data ? `${data.total.toLocaleString('en-IN')} ${filtered ? 'matching accounts' : 'accounts'}` : 'Travellers, creators and staff'}
        actions={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Create admin
          </Button>
        }
      />
      <FilterBar>
        <SearchBox value={f.q} onChange={(q) => setF({ q })} placeholder="Search name, phone or email" className="sm:w-72" />
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Role"
            value={f.role}
            onChange={(role) => setF({ role })}
            options={[
              { value: '', label: 'All roles' },
              { value: 'user', label: 'Travellers' },
              { value: 'admin', label: 'Admins' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={f.status}
            onChange={(status) => setF({ status })}
            options={[
              { value: '', label: 'Any status' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
          <ChipToggle icon={ShieldCheck} active={f.verification === 'pending'} onClick={() => setF({ verification: f.verification === 'pending' ? '' : 'pending' })}>
            Verification pending
          </ChipToggle>
          <ChipToggle icon={Crown} active={f.plan === 'plus'} onClick={() => setF({ plan: f.plan === 'plus' ? '' : 'plus' })}>
            Plus members
          </ChipToggle>
          {filtered && (
            <Button variant="ghost" size="sm" className="h-10" onClick={() => setF({ q: '', role: '', status: '', verification: '', plan: '' })}>
              Clear filters
            </Button>
          )}
        </div>
      </FilterBar>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.users}
            loading={loading}
            onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
            empty={<EmptyState icon={UsersIcon} title="No users found" description={filtered ? 'Try a different search or clear the filters.' : 'Travellers will appear here as they sign up.'} />}
          />
          <Pagination page={f.page} limit={LIMIT} total={data?.total || 0} onChange={(page) => setF({ page })} />
        </>
      )}

      <CreateAdminModal open={creating} onClose={() => setCreating(false)} onCreated={() => reload()} />
    </div>
  );
}
