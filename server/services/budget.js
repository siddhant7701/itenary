import { insert, newId, now, q, tx } from '../db.js';
import { badRequest } from '../lib/http.js';
import { memberIds } from './trips.js';

export const EXPENSE_CATEGORIES = ['stay', 'transport', 'food', 'activities', 'shopping', 'other'];

/** Add an expense. `shares` is an optional { userId: amount } map for custom splits. */
export function addExpense({ tripId, paidBy, title, category = 'other', amount, shares = null, bookingId = null, spentOn = null }) {
  const total = Math.round(amount);
  if (!(total > 0)) throw badRequest('Amount must be greater than zero');
  let split = [];
  if (shares && Object.keys(shares).length) {
    split = Object.entries(shares).map(([userId, a]) => ({ userId, amount: Math.round(Number(a) || 0) })).filter((s) => s.amount > 0);
    const sum = split.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(sum - total) > 1) throw badRequest(`Custom split adds up to ₹${sum}, but the expense is ₹${total}`);
  } else {
    const ids = memberIds(tripId);
    const base = Math.floor(total / ids.length);
    let remainder = total - base * ids.length;
    split = ids.map((userId) => ({ userId, amount: base + (remainder-- > 0 ? 1 : 0) }));
  }
  const expense = {
    id: newId(),
    trip_id: tripId,
    paid_by: paidBy,
    title,
    category: EXPENSE_CATEGORIES.includes(category) ? category : 'other',
    amount: total,
    split_type: shares ? 'custom' : 'equal',
    booking_id: bookingId,
    spent_on: spentOn || now().slice(0, 10),
    created_at: now(),
  };
  tx(() => {
    insert('expenses', expense);
    for (const s of split) insert('expense_shares', { expense_id: expense.id, user_id: s.userId, amount: s.amount });
  });
  return expense;
}

export function computeBudget(tripId) {
  const trip = q.get('SELECT id, budget FROM trips WHERE id = ?', tripId);
  const members = q.all(
    `SELECT u.id, u.name, u.avatar_url, u.upi_id FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY m.joined_at`,
    tripId,
  );
  const expenses = q.all('SELECT * FROM expenses WHERE trip_id = ? ORDER BY spent_on DESC, created_at DESC', tripId);
  const shares = q.all(`SELECT s.* FROM expense_shares s JOIN expenses e ON e.id = s.expense_id WHERE e.trip_id = ?`, tripId);
  const settlements = q.all('SELECT * FROM settlements WHERE trip_id = ? ORDER BY created_at DESC', tripId);

  const net = Object.fromEntries(members.map((m) => [m.id, { paid: 0, share: 0, settled_out: 0, settled_in: 0 }]));
  const ensure = (id) => (net[id] ||= { paid: 0, share: 0, settled_out: 0, settled_in: 0 });
  for (const e of expenses) if (e.paid_by) ensure(e.paid_by).paid += e.amount;
  for (const s of shares) ensure(s.user_id).share += s.amount;
  for (const s of settlements) {
    if (s.status !== 'paid') continue;
    ensure(s.from_user).settled_out += s.amount;
    ensure(s.to_user).settled_in += s.amount;
  }

  const balances = members.map((m) => {
    const n = net[m.id];
    return { user_id: m.id, name: m.name, avatar_url: m.avatar_url, upi_id: m.upi_id, paid: n.paid, share: n.share, net: n.paid - n.share + n.settled_out - n.settled_in };
  });

  // Greedy minimum-transactions settlement plan
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.user_id, amt: b.net })).sort((a, b) => b.amt - a.amt);
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.user_id, amt: -b.net })).sort((a, b) => b.amt - a.amt);
  const suggestions = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amt, creditors[j].amt);
    if (amt >= 1) suggestions.push({ from_user: debtors[i].id, to_user: creditors[j].id, amount: Math.round(amt) });
    debtors[i].amt -= amt;
    creditors[j].amt -= amt;
    if (debtors[i].amt < 1) i++;
    if (creditors[j].amt < 1) j++;
  }

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ category: c, amount: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((c) => c.amount > 0);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    budget: trip?.budget || 0,
    total_spent: total,
    per_person: members.length ? Math.round(total / members.length) : 0,
    by_category: byCategory,
    balances,
    suggestions,
    expenses: expenses.map((e) => ({ ...e, shares: shares.filter((s) => s.expense_id === e.id) })),
    settlements,
  };
}
