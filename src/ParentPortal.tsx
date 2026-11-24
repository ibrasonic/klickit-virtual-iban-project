import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { api, formatDate, formatSar, labelStatus } from './api';

type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid';
type CheckoutStatus =
  | 'awaiting_payment_confirmation'
  | 'awaiting_bank_confirmation'
  | 'partially_paid'
  | 'paid'
  | 'cancelled'
  | 'expired';
type PaymentMethod = 'virtual_iban' | 'card';

interface CardDetails {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

interface ParentInvoice {
  id: string;
  studentId: string;
  feeName: string;
  category: string;
  description: string;
  academicPeriod: string;
  dueDate: string;
  requiredAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
}

interface ParentStudent {
  id: string;
  studentCode: string;
  name: string;
  schoolName: string;
  academicYear: string;
  grade: string;
  virtualIban?: string;
  vibanStatus: string;
  outstanding: number;
  invoices: ParentInvoice[];
}

interface ParentPayment {
  id: string;
  invoiceId: string;
  studentId: string;
  studentName: string;
  invoiceName: string;
  category: string;
  providerTransactionId: string;
  amount: number;
  currency: 'SAR';
  status: 'confirmed';
  reconciliationStatus: 'reconciled';
  transactionDate: string;
  invoice: ParentInvoice;
}

interface CheckoutSession {
  id: string;
  paymentIntentId: string;
  parentId: string;
  studentId: string;
  invoiceId: string;
  requiredAmount: number;
  previouslyPaidAmount: number;
  remainingAmount: number;
  currency: 'SAR';
  createdAt: string;
  expiresAt: string;
  selectedPaymentMethod?: PaymentMethod;
  intendedAmount?: number;
  lastReceivedAmount?: number;
  lastProviderTransactionId?: string;
  transferCount: number;
  status: CheckoutStatus;
}

interface ParentOverviewData {
  parent: { id: string; name: string };
  students: ParentStudent[];
  familyOutstanding: number;
  payments: ParentPayment[];
  checkoutSession: CheckoutSession | null;
}

interface ParentSession {
  parent: { id: string; name: string } | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const activeStatuses: CheckoutStatus[] = [
  'awaiting_payment_confirmation',
  'awaiting_bank_confirmation',
  'partially_paid',
];

function useParentSession(): ParentSession {
  const [parent, setParent] = useState<ParentSession['parent']>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const result = await api<{ parent: { id: string; name: string } }>(
        '/api/parent/auth/session',
      );
      setParent(result.parent);
    } catch {
      setParent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { parent, loading, refresh };
}

function ParentStatus({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{labelStatus(status)}</span>;
}

function ParentAlert({
  children,
  variant = 'info',
}: {
  children: ReactNode;
  variant?: 'info' | 'error' | 'warning' | 'success';
}) {
  return (
    <div className={`alert alert-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

function ParentLogin({ session }: { session: ParentSession }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!session.loading && session.parent) return <Navigate to="/parent/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/api/parent/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      await session.refresh();
      navigate('/parent/dashboard', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="parent-login-page">
      <section className="parent-login-intro">
        <Link className="parent-brand parent-brand-light" to="/parent/login">
          <span>K</span>
          <div>
            <strong>Klickit</strong>
            <small>Parent Portal</small>
          </div>
        </Link>
        <div>
          <p className="eyebrow">School fees, made clear</p>
          <h1>One place for every student, invoice, and payment.</h1>
          <p>
            Review your family balance, choose a school fee, and complete each payment securely
            through Klickit Checkout.
          </p>
        </div>
        <div className="parent-login-points" aria-label="Portal features">
          <span>✓ Linked students only</span>
          <span>✓ Verified balances</span>
          <span>✓ Traceable reconciliation</span>
        </div>
      </section>
      <section className="parent-login-form-section" aria-labelledby="parent-login-heading">
        <form className="parent-login-card" onSubmit={submit}>
          <Link className="portal-switch-link" to="/">
            ← Choose another portal
          </Link>
          <p className="eyebrow">Parent access</p>
          <h2 id="parent-login-heading">Welcome back</h2>
          <p>Sign in to review and pay your family’s school fees.</p>
          {error && <ParentAlert variant="error">{error}</ParentAlert>}
          <label>
            Username
            <input
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button-primary button-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="parent-login-credentials">
            Access credentials: <strong>parent</strong> / <strong>parent</strong>
          </p>
        </form>
      </section>
    </main>
  );
}

function ParentPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="parent-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

function ParentDashboard({ data }: { data: ParentOverviewData }) {
  const activeSession =
    data.checkoutSession && activeStatuses.includes(data.checkoutSession.status)
      ? data.checkoutSession
      : null;
  const nextInvoice = data.students
    .flatMap((student) =>
      student.invoices
        .filter((invoice) => invoice.status !== 'paid')
        .map((invoice) => ({ invoice, student })),
    )
    .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate))[0];

  return (
    <>
      <section className="parent-hero">
        <div>
          <p className="eyebrow">Good afternoon, Mariam</p>
          <h1>Your family’s school fees, in one view.</h1>
          <p>Review each student’s balance and pay one selected invoice at a time.</p>
        </div>
        <div className="parent-family-total">
          <span>Family outstanding</span>
          <strong>{formatSar(data.familyOutstanding)}</strong>
          <small>Across {data.students.length} linked students</small>
        </div>
      </section>
      {activeSession && (
        <ParentAlert variant="warning">
          <strong>A Checkout session is active.</strong> Complete payment intent{' '}
          <span className="mono">{activeSession.paymentIntentId}</span> before choosing another
          invoice. <Link to="/parent/checkout">Return to Checkout</Link>
        </ParentAlert>
      )}
      <section className="parent-section-heading">
        <div>
          <p className="eyebrow">Linked students</p>
          <h2>Choose a student to review school fees</h2>
        </div>
        <Link className="text-link" to="/parent/invoices">
          View all invoices
        </Link>
      </section>
      <div className="parent-student-grid">
        {data.students.map((student) => (
          <article className="parent-student-card" key={student.id}>
            <div className="parent-student-card-head">
              <span className="parent-student-avatar" aria-hidden="true">
                {student.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)}
              </span>
              <ParentStatus status={student.outstanding === 0 ? 'paid' : 'payment_due'} />
            </div>
            <p className="eyebrow">{student.studentCode}</p>
            <h3>{student.name}</h3>
            <p>
              {student.grade} · {student.schoolName}
            </p>
            <div className="parent-student-balance">
              <span>Outstanding balance</span>
              <strong>{formatSar(student.outstanding)}</strong>
            </div>
            <div className="parent-card-meta">
              <span>{student.invoices.length} invoices</span>
              <span>{student.invoices.filter((invoice) => invoice.status === 'paid').length} paid</span>
            </div>
            <Link className="button button-secondary button-block" to={`/parent/students/${student.id}`}>
              View school fees
            </Link>
          </article>
        ))}
      </div>
      <section className="parent-dashboard-grid">
        <article className="panel parent-next-due">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Next due</p>
              <h2>Upcoming school fee</h2>
            </div>
            <span className="parent-calendar-icon" aria-hidden="true">
              {nextInvoice ? new Date(nextInvoice.invoice.dueDate).getDate() : '✓'}
            </span>
          </div>
          {nextInvoice ? (
            <>
              <strong>
                {nextInvoice.invoice.feeName} · {nextInvoice.student.name}
              </strong>
              <p>Due {formatDate(nextInvoice.invoice.dueDate)}</p>
              <div className="parent-due-amount">
                <span>Remaining</span>
                <strong>{formatSar(nextInvoice.invoice.remainingAmount)}</strong>
              </div>
            </>
          ) : (
            <p>All family invoices are paid.</p>
          )}
        </article>
        <article className="panel parent-trust-card">
          <p className="eyebrow">Protected payments</p>
          <h2>Verified before reconciliation</h2>
          <p>
            Klickit updates balances only after a provider credit is verified against the payment
            intent, student Virtual IBAN, and selected invoice.
          </p>
          <div className="parent-security-points">
            <span>✓ One active payment session</span>
            <span>✓ Unique provider transaction IDs</span>
            <span>✓ Shared parent and school records</span>
          </div>
        </article>
      </section>
    </>
  );
}

function ParentInvoiceCard({
  invoice,
  student,
  checkoutSession,
}: {
  invoice: ParentInvoice;
  student: ParentStudent;
  checkoutSession: CheckoutSession | null;
}) {
  const activeSession =
    checkoutSession && activeStatuses.includes(checkoutSession.status) ? checkoutSession : null;
  const currentInvoice = activeSession?.invoiceId === invoice.id;

  return (
    <article className="parent-invoice-card">
      <div className="parent-invoice-main">
        <div>
          <div className="parent-invoice-title-row">
            <span className="parent-invoice-icon" aria-hidden="true">
              ▤
            </span>
            <div>
              <p className="eyebrow">{invoice.category}</p>
              <h2>{invoice.feeName}</h2>
            </div>
          </div>
          <p>{invoice.description}</p>
          <div className="parent-invoice-meta">
            <span>{student.name}</span>
            <span>{invoice.academicPeriod}</span>
            <span>Due {formatDate(invoice.dueDate)}</span>
          </div>
        </div>
        <ParentStatus status={invoice.status} />
      </div>
      <div className="parent-invoice-amounts">
        <div>
          <span>Required</span>
          <strong>{formatSar(invoice.requiredAmount)}</strong>
        </div>
        <div>
          <span>Verified paid</span>
          <strong>{formatSar(invoice.paidAmount)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{formatSar(invoice.remainingAmount)}</strong>
        </div>
      </div>
      <div className="parent-invoice-actions">
        {invoice.status !== 'paid' && !activeSession && (
          <Link className="button button-primary" to={`/parent/checkout/start/${invoice.id}`}>
            Pay this invoice
          </Link>
        )}
        {currentInvoice && (
          <Link className="button button-primary" to="/parent/checkout">
            Continue active payment
          </Link>
        )}
        {invoice.status !== 'paid' && activeSession && !currentInvoice && (
          <span className="parent-blocked-action">
            Complete the active Checkout session before paying another invoice.
          </span>
        )}
        {invoice.status === 'paid' && (
          <span className="parent-paid-message">✓ This invoice is fully paid and reconciled</span>
        )}
        <Link className="text-link" to={`/parent/history?student=${student.id}`}>
          View payment history
        </Link>
      </div>
    </article>
  );
}

function ParentInvoices({
  data,
  selectedStudentId,
}: {
  data: ParentOverviewData;
  selectedStudentId?: string;
}) {
  const [studentFilter, setStudentFilter] = useState(selectedStudentId ?? 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const rows = data.students.flatMap((student) =>
    student.invoices.map((invoice) => ({ student, invoice })),
  );
  const visible = rows.filter(
    ({ student, invoice }) =>
      (studentFilter === 'all' || student.id === studentFilter) &&
      (statusFilter === 'all' || invoice.status === statusFilter),
  );

  return (
    <>
      <ParentPageHeader
        eyebrow={selectedStudentId ? 'Student fee account' : 'Family invoices'}
        title={
          selectedStudentId
            ? `${data.students.find((student) => student.id === selectedStudentId)?.name}’s school fees`
            : 'School fees'
        }
        description="Review assigned invoices and balances calculated from verified payments."
      />
      <div className="parent-filter-bar">
        <label>
          Student
          <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
            <option value="all">All linked students</option>
            {data.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Invoice status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <span>{visible.length} invoices</span>
      </div>
      <div className="parent-invoice-list">
        {visible.map(({ student, invoice }) => (
          <ParentInvoiceCard
            key={invoice.id}
            invoice={invoice}
            student={student}
            checkoutSession={data.checkoutSession}
          />
        ))}
      </div>
    </>
  );
}

function StudentInvoicesRoute({ data }: { data: ParentOverviewData }) {
  const { studentId } = useParams();
  if (!data.students.some((student) => student.id === studentId)) {
    return <Navigate to="/parent/dashboard" replace />;
  }
  return <ParentInvoices data={data} selectedStudentId={studentId} />;
}

function ParentHistory({ data }: { data: ParentOverviewData }) {
  const location = useLocation();
  const [studentFilter, setStudentFilter] = useState(
    new URLSearchParams(location.search).get('student') ?? 'all',
  );
  const visible = data.payments.filter(
    (payment) => studentFilter === 'all' || payment.studentId === studentFilter,
  );

  return (
    <>
      <ParentPageHeader
        eyebrow="Payment records"
        title="Payment and reconciliation history"
        description="Every amount shown here was verified by the provider and reconciled in the backend."
      />
      <div className="parent-filter-bar">
        <label>
          Student
          <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
            <option value="all">All linked students</option>
            {data.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <span>{visible.length} transactions</span>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Student and invoice</th>
                <th scope="col">Date</th>
                <th scope="col">Amount</th>
                <th scope="col">Payment</th>
                <th scope="col">Reconciliation</th>
                <th scope="col">Transaction ID</th>
                <th scope="col">Invoice balance</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <strong>{payment.studentName}</strong>
                    <small className="parent-table-subtitle">
                      {payment.category} · {payment.invoiceName}
                    </small>
                  </td>
                  <td>{formatDate(payment.transactionDate)}</td>
                  <td>
                    <strong>{formatSar(payment.amount)}</strong>
                  </td>
                  <td>
                    <ParentStatus status={payment.status} />
                  </td>
                  <td>
                    <ParentStatus status={payment.reconciliationStatus} />
                  </td>
                  <td className="mono">{payment.providerTransactionId}</td>
                  <td>
                    <strong>{formatSar(payment.invoice.paidAmount)} paid</strong>
                    <small className="parent-table-subtitle">
                      {formatSar(payment.invoice.remainingAmount)} remaining
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CheckoutPage({
  data,
  refresh,
}: {
  data: ParentOverviewData;
  refresh: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const session = data.checkoutSession;
  const student = data.students.find((item) => item.id === session?.studentId);
  const invoice = student?.invoices.find((item) => item.id === session?.invoiceId);
  const [amount, setAmount] = useState(session?.remainingAmount.toString() ?? '');
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session?.status !== 'awaiting_bank_confirmation') return;
    const timer = window.setInterval(() => void refresh(), 750);
    return () => window.clearInterval(timer);
  }, [refresh, session?.status]);

  useEffect(() => {
    if (session && session.status !== 'awaiting_bank_confirmation') {
      setAmount(session.remainingAmount.toString());
    }
  }, [session?.remainingAmount, session?.status]);

  if (!session || !student || !invoice) return <Navigate to="/parent/invoices" replace />;

  async function selectMethod(paymentMethod: PaymentMethod) {
    setError('');
    try {
      await api(`/api/parent/checkout/${session!.id}/method`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentMethod }),
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The payment method could not be saved.');
    }
  }

  async function submitTransfer(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (session!.selectedPaymentMethod === 'card') {
      const digits = cardDetails.cardNumber.replace(/\s/g, '');
      if (!cardDetails.cardholderName.trim()) {
        setError('Enter the cardholder name.');
        return;
      }
      if (!/^\d{16}$/.test(digits)) {
        setError('Card number must contain exactly 16 digits.');
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardDetails.expiry)) {
        setError('Expiry date must use MM/YY with a valid month.');
        return;
      }
      if (!/^\d{3}$/.test(cardDetails.cvc)) {
        setError('CVC must contain exactly 3 digits.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api(`/api/parent/checkout/${session!.id}/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          intendedAmount:
            session!.selectedPaymentMethod === 'virtual_iban'
              ? Number(amount)
              : session!.remainingAmount,
          ...(session!.selectedPaymentMethod === 'card'
            ? {
                cardDetails: {
                  ...cardDetails,
                  cardNumber: cardDetails.cardNumber.replace(/\s/g, ''),
                },
              }
            : {}),
        }),
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The transfer could not be started.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    await api(`/api/parent/checkout/${session!.id}/cancel`, { method: 'POST' });
    await refresh();
    navigate('/parent/invoices', { replace: true });
  }

  const shortfall =
    session.intendedAmount && session.lastReceivedAmount !== undefined
      ? session.intendedAmount - session.lastReceivedAmount
      : 0;

  return (
    <main className="parent-checkout-page">
      <header className="parent-checkout-header">
        <Link className="parent-brand" to="/parent/dashboard">
          <span>K</span>
          <div>
            <strong>Klickit</strong>
            <small>Checkout</small>
          </div>
        </Link>
        <div className="parent-checkout-security">
          🔒{' '}
          {session.selectedPaymentMethod === 'card'
            ? 'Card payment secured by HyperPay'
            : 'Provider-verified Checkout'}
        </div>
      </header>
      <div className="parent-checkout-body">
        <section className="parent-checkout-flow">
          <div className="parent-checkout-step">
            <span>1</span>
            <div>
              <small>Student</small>
              <strong>{student.name}</strong>
            </div>
          </div>
          <div className="parent-checkout-step">
            <span>2</span>
            <div>
              <small>Invoice</small>
              <strong>{invoice.feeName}</strong>
            </div>
          </div>
          <div className="parent-checkout-step active">
            <span>3</span>
            <div>
              <small>Payment</small>
              <strong>{labelStatus(session.status)}</strong>
            </div>
          </div>
        </section>
        <div className="parent-checkout-grid">
          <section className="parent-checkout-card">
            {session.status === 'paid' ? (
              <div className="parent-payment-result parent-payment-result-success">
                <span aria-hidden="true">✓</span>
                <p className="eyebrow">Payment verified</p>
                <h1>Payment successful</h1>
                <p>
                  {session.lastProviderTransactionId?.startsWith('HYP-')
                    ? 'HyperPay approved the card payment. The invoice was paid, and the reconciliation result is now visible in both parent and school records.'
                    : 'The provider credit was verified, the invoice was paid, and the reconciliation result is now visible in both parent and school records.'}
                </p>
                <strong>{formatSar(session.lastReceivedAmount ?? 0)} received</strong>
                <small className="mono">{session.lastProviderTransactionId}</small>
                <Link className="button button-primary" to="/parent/history">
                  View reconciled payment
                </Link>
              </div>
            ) : (
              <>
                <div className="parent-checkout-title">
                  <div>
                    <p className="eyebrow">Payment method</p>
                    <h1>Choose how to complete this invoice</h1>
                  </div>
                  <span className="parent-secure-badge">Protected payment</span>
                </div>
                <p>
                  Bank transfer requires the full remaining balance for each attempt. Card payment
                  charges the complete remaining amount automatically.
                </p>
                {error && <ParentAlert variant="error">{error}</ParentAlert>}
                {session.status === 'partially_paid' && session.lastReceivedAmount !== undefined && (
                  <ParentAlert variant="warning">
                    <strong>{formatSar(session.lastReceivedAmount)} was received and reconciled.</strong>{' '}
                    {shortfall > 0 && (
                      <>This is {formatSar(shortfall)} less than your entered amount. </>
                    )}
                    Pay the remaining {formatSar(session.remainingAmount)} to complete this invoice.
                  </ParentAlert>
                )}
                <div className="parent-payment-methods">
                  <button
                    className={session.selectedPaymentMethod === 'virtual_iban' ? 'selected' : ''}
                    type="button"
                    disabled={session.status === 'awaiting_bank_confirmation'}
                    onClick={() => void selectMethod('virtual_iban')}
                  >
                    <span className="parent-method-icon">↗</span>
                    <span>
                      <strong>Bank transfer</strong>
                      <small>Enter and transfer the full remaining balance</small>
                    </span>
                    <i aria-hidden="true" />
                  </button>
                  <button
                    className={session.selectedPaymentMethod === 'card' ? 'selected' : ''}
                    type="button"
                    disabled={session.status === 'awaiting_bank_confirmation'}
                    onClick={() => void selectMethod('card')}
                  >
                    <span className="parent-method-icon">▣</span>
                    <span>
                      <strong>Debit or credit card</strong>
                      <small>Charge the full remaining balance automatically</small>
                    </span>
                    <i aria-hidden="true" />
                  </button>
                </div>
                {session.selectedPaymentMethod === 'virtual_iban' && (
                  <div className="parent-transfer-instructions parent-method-details">
                    <div className="parent-method-details-heading">
                      <div>
                        <p className="eyebrow">Bank transfer details</p>
                        <strong>Transfer the complete outstanding amount</strong>
                      </div>
                      <span>{formatSar(session.remainingAmount)}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>Beneficiary</dt>
                        <dd>{student.schoolName}</dd>
                      </div>
                      <div>
                        <dt>Student Virtual IBAN</dt>
                        <dd className="mono">{student.virtualIban}</dd>
                      </div>
                    </dl>
                  </div>
                )}
                {session.selectedPaymentMethod === 'card' && (
                  <div className="parent-method-details">
                    <div className="parent-hyperpay-brand" aria-label="HyperPay Secure Checkout">
                      <span className="parent-hyperpay-symbol" aria-hidden="true">H</span>
                      <span>
                        <strong>HyperPay</strong>
                        <small>Secure Checkout</small>
                      </span>
                      <em>Card processing</em>
                    </div>
                    <div className="parent-card-charge">
                      <span className="parent-card-visual" aria-hidden="true">
                        <i />
                        <strong>HyperPay</strong>
                        <small>SECURE CARD PAYMENT</small>
                      </span>
                      <div>
                        <p className="eyebrow">HyperPay secure checkout</p>
                        <h2>{formatSar(session.remainingAmount)}</h2>
                      </div>
                    </div>
                  </div>
                )}
                {session.status === 'awaiting_bank_confirmation' ? (
                  <div className="parent-receiving-state" role="status" aria-live="polite">
                    <span className="spinner" aria-hidden="true" />
                    <div>
                      <strong>
                        {session.selectedPaymentMethod === 'card'
                          ? 'Processing securely with HyperPay…'
                          : 'Receiving transfer confirmation…'}
                      </strong>
                      <p>
                        {session.selectedPaymentMethod === 'card'
                          ? 'HyperPay is authorizing the card payment. This normally takes about five seconds.'
                          : 'The provider is verifying the bank credit. This normally takes about five seconds.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <form className="parent-transfer-form" onSubmit={submitTransfer}>
                    {session.selectedPaymentMethod === 'virtual_iban' && (
                      <>
                        <label>
                          Amount you will transfer
                          <div className="parent-amount-input">
                            <span>SAR</span>
                            <input
                              type="number"
                              min={session.remainingAmount}
                              max={session.remainingAmount}
                              step="1"
                              value={amount}
                              onChange={(event) => setAmount(event.target.value)}
                              required
                            />
                          </div>
                        </label>
                        <small>
                          Enter the full {formatSar(session.remainingAmount)} remaining balance.
                          Reconciliation still uses only the provider-confirmed amount.
                        </small>
                      </>
                    )}
                    {session.selectedPaymentMethod === 'card' && (
                      <div className="parent-card-fields">
                        <label className="parent-cardholder-field">
                          Name on card
                          <input
                            type="text"
                            autoComplete="cc-name"
                            maxLength={80}
                            value={cardDetails.cardholderName}
                            onChange={(event) =>
                              setCardDetails((current) => ({
                                ...current,
                                cardholderName: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label className="parent-card-number-field">
                          Card number
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-number"
                            maxLength={19}
                            placeholder="1234 5678 9012 3456"
                            value={cardDetails.cardNumber}
                            onChange={(event) => {
                              const digits = event.target.value.replace(/\D/g, '').slice(0, 16);
                              setCardDetails((current) => ({
                                ...current,
                                cardNumber: digits.replace(/(\d{4})(?=\d)/g, '$1 '),
                              }));
                            }}
                            required
                          />
                        </label>
                        <label>
                          Expiry (MM/YY)
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            maxLength={5}
                            placeholder="MM/YY"
                            value={cardDetails.expiry}
                            onChange={(event) => {
                              const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
                              setCardDetails((current) => ({
                                ...current,
                                expiry:
                                  digits.length > 2
                                    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                                    : digits,
                              }));
                            }}
                            required
                          />
                        </label>
                        <label>
                          CVC
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            maxLength={3}
                            placeholder="123"
                            value={cardDetails.cvc}
                            onChange={(event) =>
                              setCardDetails((current) => ({
                                ...current,
                                cvc: event.target.value.replace(/\D/g, '').slice(0, 3),
                              }))
                            }
                            required
                          />
                        </label>
                        <div className="parent-card-confirmation">
                          <span>Total card charge</span>
                          <strong>{formatSar(session.remainingAmount)}</strong>
                        </div>
                      </div>
                    )}
                    <div className="parent-checkout-actions">
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={!session.selectedPaymentMethod || submitting}
                      >
                        {submitting
                          ? session.selectedPaymentMethod === 'card'
                            ? 'Connecting to HyperPay…'
                            : 'Contacting provider…'
                          : session.selectedPaymentMethod === 'card'
                            ? `Pay ${formatSar(session.remainingAmount)} with HyperPay`
                            : `Confirm ${formatSar(session.remainingAmount)} transfer`}
                      </button>
                      <button className="button button-ghost" type="button" onClick={() => void cancel()}>
                        Cancel session
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
          <aside className="parent-order-summary">
            <p className="eyebrow">Payment summary</p>
            <h2>{invoice.feeName}</h2>
            <p>
              {student.name} · {invoice.academicPeriod}
            </p>
            <dl>
              <div>
                <dt>Required amount</dt>
                <dd>{formatSar(session.requiredAmount)}</dd>
              </div>
              <div>
                <dt>Verified paid</dt>
                <dd>− {formatSar(session.previouslyPaidAmount)}</dd>
              </div>
              <div>
                <dt>Amount remaining</dt>
                <dd>{formatSar(session.remainingAmount)}</dd>
              </div>
            </dl>
            <div className="parent-intent">
              <span>Payment intent</span>
              <strong className="mono">{session.paymentIntentId}</strong>
              <span>Status</span>
              <strong>{labelStatus(session.status)}</strong>
              {session.lastProviderTransactionId && (
                <>
                  <span>Latest provider transaction</span>
                  <strong className="mono">{session.lastProviderTransactionId}</strong>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StartCheckout({
  data,
  refresh,
}: {
  data: ParentOverviewData;
  refresh: () => Promise<void>;
}) {
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function start() {
      const activeSession =
        data.checkoutSession && activeStatuses.includes(data.checkoutSession.status);
      if (!activeSession) {
        try {
          await api('/api/parent/checkout', {
            method: 'POST',
            body: JSON.stringify({ invoiceId }),
          });
          await refresh();
        } catch {
          await refresh();
        }
      }
      navigate('/parent/checkout', { replace: true });
    }
    void start();
  }, [data.checkoutSession, invoiceId, navigate, refresh]);

  return (
    <main className="parent-checkout-page">
      <div className="loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Preparing secure Checkout…
      </div>
    </main>
  );
}

function ParentLayout({
  data,
  refresh,
  session,
}: {
  data: ParentOverviewData;
  refresh: () => Promise<void>;
  session: ParentSession;
}) {
  const navigate = useNavigate();
  const activeCheckout =
    data.checkoutSession && activeStatuses.includes(data.checkoutSession.status);

  async function logout() {
    await api('/api/parent/auth/logout', { method: 'POST' });
    await session.refresh();
    navigate('/parent/login', { replace: true });
  }

  return (
    <div className="parent-shell">
      <a className="skip-link" href="#parent-main">
        Skip to main content
      </a>
      <header className="parent-topbar">
        <Link className="parent-brand" to="/parent/dashboard">
          <span>K</span>
          <div>
            <strong>Klickit</strong>
            <small>Parent Portal</small>
          </div>
        </Link>
        <nav aria-label="Parent portal">
          <NavLink to="/parent/dashboard">Overview</NavLink>
          <NavLink to="/parent/invoices">School fees</NavLink>
          <NavLink to="/parent/history">Payment history</NavLink>
          {activeCheckout && <NavLink to="/parent/checkout">Checkout</NavLink>}
        </nav>
        <div className="parent-account">
          <span className="avatar">MH</span>
          <div>
            <strong>{data.parent.name}</strong>
            <small>Parent account</small>
          </div>
          <button className="button button-ghost button-small" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>
      <main id="parent-main" className="parent-content" tabIndex={-1}>
        <Routes>
          <Route path="/parent/dashboard" element={<ParentDashboard data={data} />} />
          <Route path="/parent/invoices" element={<ParentInvoices data={data} />} />
          <Route path="/parent/students/:studentId" element={<StudentInvoicesRoute data={data} />} />
          <Route path="/parent/history" element={<ParentHistory data={data} />} />
          <Route path="*" element={<Navigate to="/parent/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function ProtectedParentPortal({ session }: { session: ParentSession }) {
  const [data, setData] = useState<ParentOverviewData | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setData(await api<ParentOverviewData>('/api/parent/overview'));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The parent records could not be loaded.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (error) return <ParentAlert variant="error">{error}</ParentAlert>;
  if (!data) {
    return (
      <div className="loading">
        <span className="spinner" aria-hidden="true" />
        Loading parent records…
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/parent/checkout/start/:invoiceId"
        element={<StartCheckout data={data} refresh={refresh} />}
      />
      <Route
        path="/parent/checkout"
        element={<CheckoutPage data={data} refresh={refresh} />}
      />
      <Route path="*" element={<ParentLayout data={data} refresh={refresh} session={session} />} />
    </Routes>
  );
}

export default function ParentPortal() {
  const session = useParentSession();
  if (session.loading) {
    return (
      <div className="loading">
        <span className="spinner" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/parent/login" element={<ParentLogin session={session} />} />
      <Route
        path="*"
        element={
          session.parent ? (
            <ProtectedParentPortal session={session} />
          ) : (
            <Navigate to="/parent/login" replace />
          )
        }
      />
    </Routes>
  );
}
