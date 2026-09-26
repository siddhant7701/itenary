import { Router } from 'express';
import { insert, newId, now, q, update } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { badRequest, forbidden, int, notFound, oneOf, str, date } from '../lib/http.js';
import { EXPENSE_CATEGORIES, addExpense, computeBudget } from '../services/budget.js';
import { collect, checkUpiAuthorisation } from '../services/payments.js';
import { notify } from '../services/notify.js';
import { emitTrip } from '../realtime.js';
import { requireMember } from '../services/trips.js';
import { saveMessage } from '../agent/concierge.js';

const router = Router();

const rupee = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

router.get('/trips/:id/budget/split', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  res.json(computeBudget(trip.id));
});

router.post('/trips/:id/expenses', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const paidBy = req.body.paid_by || req.user.id;
  if (!q.get('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, paidBy)) throw badRequest('The payer must be a trip member');
  let shares = null;
  if (req.body.shares && typeof req.body.shares === 'object') {
    shares = {};
    for (const [uid, amt] of Object.entries(req.body.shares)) {
      if (!q.get('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, uid)) throw badRequest('Split includes someone who is not on this trip');
      shares[uid] = amt;
    }
  }
  const expense = addExpense({
    tripId: trip.id,
    paidBy,
    title: str(req.body.title, 'Title', { required: true, max: 120 }),
    category: oneOf(req.body.category, 'Category', EXPENSE_CATEGORIES) || 'other',
    amount: int(req.body.amount, 'Amount', { required: true, min: 1, max: 10_000_000 }),
    shares,
    spentOn: date(req.body.spent_on, 'Date'),
  });
  emitTrip(trip.id, 'expense', {}, req.user.id);
  res.status(201).json({ expense });
});

router.delete('/trips/:id/expenses/:eid', requireAuth, (req, res) => {
  const { trip, member } = requireMember(req.params.id, req.user);
  const e = q.get('SELECT * FROM expenses WHERE id = ? AND trip_id = ?', req.params.eid, trip.id);
  if (!e) throw notFound('Expense not found');
  if (e.booking_id) throw badRequest('This expense comes from a booking. Cancel the booking to remove it.');
  if (e.paid_by !== req.user.id && member.role !== 'owner') throw forbidden('Only the payer or trip owner can delete this expense');
  q.run('DELETE FROM expenses WHERE id = ?', e.id);
  emitTrip(trip.id, 'expense', {}, req.user.id);
  res.json({ ok: true });
});

// Request money from a member (UPI payout request between travellers).
router.post('/trips/:id/settlements', requireAuth, (req, res) => {
  const { trip } = requireMember(req.params.id, req.user);
  const from = String(req.body.from_user || '');
  const to = String(req.body.to_user || req.user.id);
  if (from === to) throw badRequest('Choose two different people');
  for (const uid of [from, to]) if (!q.get('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?', trip.id, uid)) throw badRequest('Both people must be on this trip');
  if (req.user.id !== from && req.user.id !== to) throw forbidden('You can only create settlements you are part of');
  const amount = int(req.body.amount, 'Amount', { required: true, min: 1, max: 10_000_000 });
  const s = insert('settlements', { id: newId(), trip_id: trip.id, from_user: from, to_user: to, amount, status: 'requested', note: str(req.body.note, 'Note', { max: 200 }) || '', requested_by: req.user.id, created_at: now() });
  const toName = q.value('SELECT name FROM users WHERE id = ?', to);
  if (req.user.id === to) {
    notify(from, { type: 'settlement', title: `${toName} requested ${rupee(amount)}`, body: `Settle up for ${trip.name} with one tap via UPI.`, link: `/app/trips/${trip.id}?tab=budget` });
  }
  emitTrip(trip.id, 'expense', {}, req.user.id);
  res.status(201).json({ settlement: s });
});

router.post('/settlements/:sid/pay', requireAuth, (req, res) => {
  const s = q.get('SELECT * FROM settlements WHERE id = ?', req.params.sid);
  if (!s) throw notFound('Settlement not found');
  const { trip } = requireMember(s.trip_id, req.user);
  if (s.from_user !== req.user.id) throw forbidden('Only the person who owes can pay this');
  if (s.status !== 'requested') throw badRequest(`This settlement is already ${s.status}`);
  checkUpiAuthorisation(req.body);
  const payment = collect({ userId: req.user.id, payeeUserId: s.to_user, amount: s.amount, purpose: 'settlement', tripId: trip.id, upiApp: req.body.upi_app, meta: { settlement_id: s.id } });
  update('settlements', s.id, { status: 'paid', payment_id: payment.id, settled_at: now() });
  notify(s.to_user, { type: 'settlement_paid', title: `${req.user.name} paid you ${rupee(s.amount)}`, body: `UPI ref ${payment.upi_ref} · ${trip.name}`, link: `/app/trips/${trip.id}?tab=budget` });
  saveMessage({ tripId: trip.id, channel: 'group', senderType: 'system', content: `${req.user.name} settled ${rupee(s.amount)} with ${q.value('SELECT name FROM users WHERE id = ?', s.to_user)} via UPI ✅` });
  emitTrip(trip.id, 'expense', {}, req.user.id);
  res.json({ settlement: q.get('SELECT * FROM settlements WHERE id = ?', s.id), payment });
});

router.post('/settlements/:sid/decline', requireAuth, (req, res) => {
  const s = q.get('SELECT * FROM settlements WHERE id = ?', req.params.sid);
  if (!s) throw notFound('Settlement not found');
  requireMember(s.trip_id, req.user);
  if (![s.from_user, s.to_user].includes(req.user.id)) throw forbidden();
  if (s.status !== 'requested') throw badRequest(`This settlement is already ${s.status}`);
  update('settlements', s.id, { status: 'declined', settled_at: now() });
  emitTrip(s.trip_id, 'expense', {}, req.user.id);
  res.json({ ok: true });
});

export default router;
