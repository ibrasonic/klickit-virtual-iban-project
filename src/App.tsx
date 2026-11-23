import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  ApiError,
  api,
  formatDate,
  formatSar,
  labelStatus,
  type ImportRow,
  type Invoice,
  type InvoiceGroup,
  type Payment,
  type Student,
  type User,
} from './api';
import ParentPortal from './ParentPortal';

interface SessionContext {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

function useSession(): SessionContext {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const result = await api<{ user: User }>('/api/auth/session');
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { user, loading, refresh };
}

function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}…
    </div>
  );
}

function Alert({
  children,
  variant = 'info',
}: {
  children: ReactNode;
  variant?: 'info' | 'success' | 'error' | 'warning';
}) {
  return (
    <div className={`alert alert-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{labelStatus(status)}</span>;
}

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

function ProtectedLayout({ session }: { session: SessionContext }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (session.loading) return <Loading label="Checking your session" />;
  if (!session.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    await session.refresh();
    navigate('/login', { replace: true });
  }

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '⌂' },
    { to: '/import', label: 'Import students', icon: '⇧' },
    { to: '/students', label: 'Students & VIBANs', icon: '◎' },
    { to: '/invoices', label: 'Fee invoices', icon: '▤' },
    { to: '/parents', label: 'Parent record search', icon: '⌕' },
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Primary">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <div>
            <strong>Klickit</strong>
            <span>Finance Console</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="provider-dot" aria-hidden="true" />
          <div>
            <strong>Bank integration</strong>
            <span>Sandbox connected</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="menu-button"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>
          <div className="school-identity">
            <span>{session.user.schoolName}</span>
            <small>2026/2027 Academic Year</small>
          </div>
          <div className="user-menu">
            <div className="avatar" aria-hidden="true">
              {session.user.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <strong>{session.user.name}</strong>
              <span>{session.user.role}</span>
            </div>
            <button className="button button-ghost button-small" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function LoginPage({ session }: { session: SessionContext }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!session.loading && session.user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await session.refresh();
      const target =
        typeof location.state === 'object' &&
        location.state &&
        'from' in location.state &&
        typeof location.state.from === 'string'
          ? location.state.from
          : '/dashboard';
      navigate(target, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="Product introduction">
        <div className="brand brand-light">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <div>
            <strong>Klickit</strong>
            <span>Finance Console</span>
          </div>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Virtual IBAN collections</p>
          <h1>Every school payment, identified and reconciled.</h1>
          <p>
            Import students, provision collection accounts, assign fees, and monitor every payment
            from one secure workspace.
          </p>
          <ul className="feature-list">
            <li>Bulk student onboarding</li>
            <li>Automatic Virtual IBAN assignment</li>
            <li>Live collection visibility</li>
          </ul>
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <form className="login-card" onSubmit={submit}>
          <p className="eyebrow">School finance portal</p>
          <h2 id="login-heading">Welcome back</h2>
          <p>Sign in to manage your school’s collections.</p>
          {error && <Alert variant="error">{error}</Alert>}
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button-primary button-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

interface DashboardData {
  schoolName: string;
  totals: {
    invoiced: number;
    collected: number;
    outstanding: number;
    students: number;
    paid: number;
    partiallyPaid: number;
    unpaid: number;
  };
  recentPayments: Payment[];
  audit: Array<{ id: string; action: string; detail: string; createdAt: string }>;
}

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/api/dashboard').then(setData).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <Loading label="Loading collection dashboard" />;

  const collectionRate = data.totals.invoiced
    ? Math.round((data.totals.collected / data.totals.invoiced) * 100)
    : 0;
  const openInvoices = data.totals.unpaid + data.totals.partiallyPaid;
  const totalInvoices = data.totals.paid + openInvoices;

  return (
    <>
      <section className="dashboard-welcome" aria-labelledby="dashboard-heading">
        <div>
          <p className="eyebrow">Finance overview · 2026/2027</p>
          <h1 id="dashboard-heading">Collection dashboard</h1>
          <p>Monitor school fees, verified collections, and outstanding balances.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" to="/import">
            Import students
          </Link>
          <Link className="button button-primary" to="/invoices/new">
            Create fee invoice
          </Link>
        </div>
      </section>
      <section className="metric-grid" aria-label="Collection summary">
        <article className="metric-card metric-dark">
          <div className="metric-card-head">
            <span>Total invoiced</span>
            <span className="metric-icon" aria-hidden="true">▤</span>
          </div>
          <strong>{formatSar(data.totals.invoiced)}</strong>
          <small>{totalInvoices} invoices across {data.totals.students} students</small>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Verified collections</span>
            <span className="metric-icon metric-icon-success" aria-hidden="true">✓</span>
          </div>
          <strong>{formatSar(data.totals.collected)}</strong>
          <small><span className="metric-trend">{collectionRate}%</span> of invoiced value collected</small>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Outstanding balance</span>
            <span className="metric-icon metric-icon-warning" aria-hidden="true">↗</span>
          </div>
          <strong>{formatSar(data.totals.outstanding)}</strong>
          <small>{openInvoices} invoices require attention</small>
        </article>
      </section>
      <section className="dashboard-grid dashboard-overview-grid">
        <article className="panel collection-performance">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Collection performance</p>
              <h2>Invoice portfolio</h2>
              <p>Verified payment progress across all active school fees.</p>
            </div>
            <Link className="text-link" to="/invoices">View all invoices</Link>
          </div>
          <div className="performance-layout">
            <div
              className="progress-ring"
              style={{ background: `conic-gradient(#0b8f87 ${collectionRate}%, #e8eef1 0)` }}
              role="img"
              aria-label={`${collectionRate}% of invoiced value collected`}
            >
              <div>
                <strong>{collectionRate}%</strong>
                <span>collected</span>
              </div>
            </div>
            <div className="portfolio-status-list">
              <div>
                <span className="portfolio-label"><i className="status-dot status-dot-paid" />Paid</span>
                <strong>{data.totals.paid}</strong>
              </div>
              <div>
                <span className="portfolio-label"><i className="status-dot status-dot-partial" />Partially paid</span>
                <strong>{data.totals.partiallyPaid}</strong>
              </div>
              <div>
                <span className="portfolio-label"><i className="status-dot status-dot-unpaid" />Unpaid</span>
                <strong>{data.totals.unpaid}</strong>
              </div>
            </div>
          </div>
        </article>
        <article className="panel integration-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Bank connectivity</p>
              <h2>Virtual IBAN service</h2>
              <p>Provider connection and school collection account.</p>
            </div>
            <span className="connection-state"><i />Operational</span>
          </div>
          <dl className="definition-list">
            <div>
              <dt>Provider</dt>
              <dd>Neotek / Al Rajhi Bank</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Sandbox</dd>
            </div>
            <div>
              <dt>Collection account</dt>
              <dd>•••• 4821</dd>
            </div>
          </dl>
          <Link className="button button-secondary button-block" to="/students">
            Manage student VIBANs
          </Link>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Payment activity</p>
            <h2>Recent payment transactions</h2>
            <p>Latest transactions received for student fee accounts.</p>
          </div>
          <Link className="text-link" to="/invoices">View fee records</Link>
        </div>
        {data.recentPayments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Student</th>
                  <th scope="col">Invoice</th>
                  <th scope="col">Date</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="mono">{payment.providerTransactionId}</td>
                    <td>{payment.studentName}</td>
                    <td>{payment.invoiceName}</td>
                    <td>{formatDate(payment.transactionDate)}</td>
                    <td><strong className="amount-cell">{formatSar(payment.amount)}</strong></td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No payment activity yet.</p>
        )}
      </section>
    </>
  );
}

interface PreviewData {
  previewId: string;
  rows: ImportRow[];
  summary: { total: number; valid: number; invalid: number; existing: number; new: number };
}

function ImportPage() {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function previewFile() {
    if (!file) {
      setError('Select an Excel workbook first.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    const form = new FormData();
    form.append('file', file);
    try {
      setPreview(await api<PreviewData>('/api/import/preview', { method: 'POST', body: form }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Workbook preview failed.');
    } finally {
      setLoading(false);
    }
  }

  async function commitImport() {
    if (!preview) return;
    setLoading(true);
    try {
      const result = await api<{ message: string }>('/api/import/commit', {
        method: 'POST',
        body: JSON.stringify({ previewId: preview.previewId }),
      });
      setMessage(result.message);
      setPreview(null);
      setFile(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Student onboarding"
        title="Import students from Excel"
        description="Validate student and parent records before adding them to the school database."
        actions={
          <a className="button button-secondary" href="/api/import/template">
            Download Excel template
          </a>
        }
      />
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <section className="panel upload-panel">
        <div className="step-number" aria-hidden="true">
          1
        </div>
        <div>
          <h2>Select your workbook</h2>
          <p>
            Required columns: Student ID, Student Name, Parent National ID, Parent Name, Academic
            Year, and Grade or Class.
          </p>
          <label className="file-drop" htmlFor={inputId}>
            <strong>{file ? file.name : 'Choose an .xlsx workbook'}</strong>
            <span>{file ? `${Math.ceil(file.size / 1024)} KB` : 'Maximum file size: 5 MB'}</span>
            <input
              id={inputId}
              type="file"
              accept=".xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="button button-primary"
            type="button"
            onClick={previewFile}
            disabled={!file || loading}
          >
            {loading ? 'Validating…' : 'Validate and preview'}
          </button>
        </div>
      </section>
      {preview && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Review import results</h2>
            </div>
            <div className="mini-metrics" aria-label="Import summary">
              <span>{preview.summary.valid} valid</span>
              <span>{preview.summary.new} new</span>
              <span>{preview.summary.existing} existing</span>
              <span>{preview.summary.invalid} invalid</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Student ID</th>
                  <th scope="col">Student</th>
                  <th scope="col">Parent</th>
                  <th scope="col">National ID</th>
                  <th scope="col">Class</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.studentId || '—'}</td>
                    <td>{row.studentName || '—'}</td>
                    <td>{row.parentName || '—'}</td>
                    <td className="mono">
                      {row.parentNationalId
                        ? `${row.parentNationalId.slice(0, 3)}••••••••${row.parentNationalId.slice(-3)}`
                        : '—'}
                    </td>
                    <td>{row.grade || '—'}</td>
                    <td>
                      {row.valid ? (
                        <StatusBadge status={row.existing ? 'existing' : 'valid'} />
                      ) : (
                        <span className="validation-error">{row.errors.join(' ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button className="button button-ghost" type="button" onClick={() => setPreview(null)}>
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={commitImport}
              disabled={loading || preview.summary.valid === 0}
            >
              {loading ? 'Importing…' : `Confirm import (${preview.summary.valid})`}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadStudents() {
    setLoading(true);
    try {
      const result = await api<{ students: Student[] }>(
        `/api/students?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`,
      );
      setStudents(result.students);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Students could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, [status]);

  async function provision() {
    setError('');
    setMessage('');
    try {
      const result = await api<{ created: number; reused: number; failed: number }>(
        '/api/vibans/provision',
        {
          method: 'POST',
          body: JSON.stringify({ studentIds: Array.from(selected) }),
        },
      );
      setMessage(
        `${result.created} Virtual IBANs created, ${result.reused} reused, ${result.failed} failed.`,
      );
      setSelected(new Set());
      await loadStudents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Provisioning failed.');
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Student accounts"
        title="Students & Virtual IBANs"
        description="Review imported students, collection account assignments, and provider status."
        actions={
          <button
            className="button button-primary"
            type="button"
            disabled={!selected.size}
            onClick={provision}
          >
            Provision selected ({selected.size})
          </button>
        }
      />
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <section className="panel">
        <div className="filters">
          <label>
            Search students
            <div className="input-action">
              <input
                type="search"
                placeholder="Name or student ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadStudents();
                }}
              />
              <button className="button button-secondary" type="button" onClick={loadStudents}>
                Search
              </button>
            </div>
          </label>
          <label>
            Virtual IBAN status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="not_assigned">Not assigned</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        {loading ? (
          <Loading label="Loading students" />
        ) : students.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col">Student</th>
                  <th scope="col">Parent</th>
                  <th scope="col">Class</th>
                  <th scope="col">Virtual IBAN</th>
                  <th scope="col">Status</th>
                  <th scope="col">Outstanding</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${student.name}`}
                        checked={selected.has(student.id)}
                        onChange={() => toggle(student.id)}
                      />
                    </td>
                    <td>
                      <strong>{student.name}</strong>
                      <span className="table-secondary">{student.studentCode}</span>
                    </td>
                    <td>
                      {student.parentName}
                      <span className="table-secondary">{student.parentNationalIdMasked}</span>
                    </td>
                    <td>{student.grade}</td>
                    <td className="mono">{student.viban ?? 'Not assigned'}</td>
                    <td>
                      <StatusBadge status={student.vibanStatus} />
                      {student.vibanFailureReason && (
                        <span className="table-secondary">{student.vibanFailureReason}</span>
                      )}
                    </td>
                    <td>{formatSar(student.outstanding)}</td>
                    <td>
                      <Link className="table-link" to={`/students/${student.id}`}>
                        View record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h2>No students found</h2>
            <p>Clear the filters or import student records.</p>
          </div>
        )}
      </section>
    </>
  );
}

interface StudentRecordData {
  student: Student & {
    parent: { id: string; name: string; nationalIdMasked: string };
  };
  invoices: Invoice[];
  payments: Payment[];
}

function StudentRecordPage() {
  const { id } = useParams();
  const [data, setData] = useState<StudentRecordData | null>(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [invoiceStatus, setInvoiceStatus] = useState('all');

  useEffect(() => {
    api<StudentRecordData>(`/api/students/${id}`)
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, [id]);

  const filteredInvoices = useMemo(
    () =>
      data?.invoices.filter(
        (invoice) =>
          (category === 'all' || invoice.category === category) &&
          (invoiceStatus === 'all' || invoice.status === invoiceStatus),
      ) ?? [],
    [data, category, invoiceStatus],
  );

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <Loading label="Loading student fee record" />;

  return (
    <>
      <PageHeader
        eyebrow="Student fee record"
        title={data.student.name}
        description={`${data.student.studentCode} · ${data.student.grade} · ${data.student.academicYear}`}
        actions={
          <Link className="button button-secondary" to="/students">
            Back to students
          </Link>
        }
      />
      <section className="record-grid">
        <article className="panel profile-panel">
          <p className="eyebrow">Student & family</p>
          <h2>Account details</h2>
          <dl className="definition-list">
            <div>
              <dt>Parent</dt>
              <dd>{data.student.parent.name}</dd>
            </div>
            <div>
              <dt>Parent National ID</dt>
              <dd className="mono">{data.student.parent.nationalIdMasked}</dd>
            </div>
            <div>
              <dt>Virtual IBAN status</dt>
              <dd>
                <StatusBadge status={data.student.vibanStatus} />
              </dd>
            </div>
            <div>
              <dt>Virtual IBAN</dt>
              <dd className="mono">{data.student.viban ?? 'Not assigned'}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <p className="eyebrow">Financial position</p>
          <h2>Balance summary</h2>
          <div className="record-metrics">
            <div>
              <span>Total invoiced</span>
              <strong>{formatSar(data.student.totalInvoiced)}</strong>
            </div>
            <div>
              <span>Verified paid</span>
              <strong>{formatSar(data.student.totalPaid)}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>{formatSar(data.student.outstanding)}</strong>
            </div>
          </div>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Student invoices</p>
            <h2>Fee history</h2>
          </div>
          <div className="inline-filters">
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {Array.from(new Set(data.invoices.map((invoice) => invoice.category))).map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={invoiceStatus}
                onChange={(event) => setInvoiceStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Due date</th>
                <th scope="col">Required</th>
                <th scope="col">Paid</th>
                <th scope="col">Remaining</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong>{invoice.feeName}</strong>
                    <span className="table-secondary">{invoice.category}</span>
                  </td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td>{formatSar(invoice.requiredAmount)}</td>
                  <td>{formatSar(invoice.paidAmount)}</td>
                  <td>{formatSar(invoice.remainingAmount)}</td>
                  <td>
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Verified activity</p>
            <h2>Payment & reconciliation history</h2>
          </div>
        </div>
        {data.payments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Provider transaction</th>
                  <th scope="col">Invoice</th>
                  <th scope="col">Date</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Reconciliation</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="mono">{payment.providerTransactionId}</td>
                    <td>{payment.invoiceName}</td>
                    <td>{formatDate(payment.transactionDate)}</td>
                    <td>{formatSar(payment.amount)}</td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                    <td>
                      <StatusBadge status={payment.reconciliationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No payment transactions recorded for this student.</p>
        )}
      </section>
    </>
  );
}

function InvoicesPage() {
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ invoices: InvoiceGroup[] }>('/api/invoices')
      .then((result) => setGroups(result.invoices))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Fee management"
        title="School fee invoices"
        description="Create fee assignments and monitor collection progress by invoice."
        actions={
          <Link className="button button-primary" to="/invoices/new">
            Create fee invoice
          </Link>
        }
      />
      {error && <Alert variant="error">{error}</Alert>}
      <section className="panel">
        {loading ? (
          <Loading label="Loading invoices" />
        ) : groups.length ? (
          <div className="invoice-grid">
            {groups.map((invoice) => (
              <article className="invoice-card" key={invoice.batchReference}>
                <div className="invoice-card-top">
                  <span className="category-chip">{invoice.category}</span>
                  <span>{invoice.academicPeriod}</span>
                </div>
                <h2>{invoice.feeName}</h2>
                <p>{invoice.description}</p>
                <dl className="invoice-metrics">
                  <div>
                    <dt>Expected</dt>
                    <dd>{formatSar(invoice.expected)}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>{formatSar(invoice.collected)}</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{formatSar(invoice.remaining)}</dd>
                  </div>
                </dl>
                <div className="invoice-status-row">
                  <span>{invoice.paid} paid</span>
                  <span>{invoice.partiallyPaid} partial</span>
                  <span>{invoice.unpaid} unpaid</span>
                </div>
                <Link className="button button-secondary button-block" to={`/invoices/${invoice.batchReference}`}>
                  View payment status
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>No fee invoices</h2>
            <p>Create the school’s first fee assignment.</p>
          </div>
        )}
      </section>
    </>
  );
}

function CreateInvoicePage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    feeName: '',
    category: 'Tuition',
    description: '',
    requiredAmount: '',
    dueDate: '',
    academicPeriod: '2026/2027 - Term 1',
    partialAllowed: true,
  });
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ students: Student[] }>('/api/students').then((result) => setStudents(result.students));
  }, []);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleStudent(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!selected.size) {
      setError('Select at least one student.');
      return;
    }
    setError('');
    setReviewing(true);
  }

  async function create() {
    setSubmitting(true);
    setError('');
    try {
      await api('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          requiredAmount: Number(form.requiredAmount),
          studentIds: Array.from(selected),
        }),
      });
      navigate('/invoices', { state: { message: 'Fee invoices created successfully.' } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invoice creation failed.');
      setReviewing(false);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedStudents = students.filter((student) => selected.has(student.id));

  return (
    <>
      <PageHeader
        eyebrow="Fee assignment"
        title="Create school fee invoice"
        description="Define the fee once and assign an individual invoice to selected students."
      />
      {error && <Alert variant="error">{error}</Alert>}
      {!reviewing ? (
        <form className="form-layout" onSubmit={review}>
          <section className="panel form-section">
            <h2>Fee details</h2>
            <div className="field-grid">
              <label>
                Fee name
                <input
                  value={form.feeName}
                  onChange={(event) => update('feeName', event.target.value)}
                  placeholder="e.g. Annual Transportation"
                  required
                />
              </label>
              <label>
                Fee category
                <select value={form.category} onChange={(event) => update('category', event.target.value)}>
                  {['Tuition', 'Transportation', 'Uniform', 'Activities', 'Application fee', 'Other'].map(
                    (category) => (
                      <option value={category} key={category}>
                        {category}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field-span">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  required
                />
              </label>
              <label>
                Required amount per student (SAR)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.requiredAmount}
                  onChange={(event) => update('requiredAmount', event.target.value)}
                  required
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => update('dueDate', event.target.value)}
                  required
                />
              </label>
              <label>
                Academic period
                <input
                  value={form.academicPeriod}
                  onChange={(event) => update('academicPeriod', event.target.value)}
                  required
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.partialAllowed}
                  onChange={(event) => update('partialAllowed', event.target.checked)}
                />
                Allow partial payments
              </label>
            </div>
          </section>
          <section className="panel form-section">
            <div className="panel-heading">
              <div>
                <h2>Assign students</h2>
                <p>{selected.size} students selected</p>
              </div>
              <button
                className="button button-ghost button-small"
                type="button"
                onClick={() => setSelected(new Set(students.map((student) => student.id)))}
              >
                Select all
              </button>
            </div>
            <div className="student-selection">
              {students.map((student) => (
                <label className="student-choice" key={student.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span>
                    <strong>{student.name}</strong>
                    <small>
                      {student.studentCode} · {student.grade}
                    </small>
                  </span>
                  <StatusBadge status={student.vibanStatus} />
                </label>
              ))}
            </div>
          </section>
          <div className="form-actions">
            <Link className="button button-ghost" to="/invoices">
              Cancel
            </Link>
            <button className="button button-primary" type="submit">
              Review assignment
            </button>
          </div>
        </form>
      ) : (
        <section className="panel review-card">
          <p className="eyebrow">Confirm assignment</p>
          <h2>{form.feeName}</h2>
          <p>{form.description}</p>
          <dl className="definition-list">
            <div>
              <dt>Category</dt>
              <dd>{form.category}</dd>
            </div>
            <div>
              <dt>Amount per student</dt>
              <dd>{formatSar(Number(form.requiredAmount))}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{formatDate(form.dueDate)}</dd>
            </div>
            <div>
              <dt>Students</dt>
              <dd>{selectedStudents.length}</dd>
            </div>
            <div>
              <dt>Total expected</dt>
              <dd>{formatSar(Number(form.requiredAmount) * selectedStudents.length)}</dd>
            </div>
          </dl>
          <h3>Selected students</h3>
          <ul className="selected-list">
            {selectedStudents.map((student) => (
              <li key={student.id}>
                {student.name} <span>{student.studentCode}</span>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button className="button button-ghost" type="button" onClick={() => setReviewing(false)}>
              Back to edit
            </button>
            <button className="button button-primary" type="button" disabled={submitting} onClick={create}>
              {submitting ? 'Creating…' : `Create ${selectedStudents.length} invoices`}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

interface InvoiceDetailData {
  invoice: InvoiceGroup;
  students: Array<
    Invoice & {
      studentName: string;
      studentCode: string;
      parentName: string;
      viban?: string;
      reconciliationStatus: string;
      latestPaymentDate?: string;
    }
  >;
}

function InvoiceDetailPage() {
  const { batchReference } = useParams();
  const [status, setStatus] = useState('all');
  const [data, setData] = useState<InvoiceDetailData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<InvoiceDetailData>(
      `/api/invoices/${encodeURIComponent(batchReference ?? '')}?status=${status}`,
    )
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, [batchReference, status]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <Loading label="Loading invoice payment status" />;

  const filters = [
    ['all', 'Show all', data.invoice.assignedStudents],
    ['paid', 'Paid', data.invoice.paid],
    ['partially_paid', 'Partially paid', data.invoice.partiallyPaid],
    ['unpaid', 'Unpaid', data.invoice.unpaid],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow={`${data.invoice.category} · ${data.invoice.academicPeriod}`}
        title={data.invoice.feeName}
        description={`${formatSar(data.invoice.requiredAmountPerStudent)} per student · Due ${formatDate(data.invoice.dueDate)}`}
        actions={
          <Link className="button button-secondary" to="/invoices">
            Back to invoices
          </Link>
        }
      />
      <section className="metric-grid metric-grid-compact" aria-label="Invoice collection summary">
        <article className="metric-card">
          <span>Expected</span>
          <strong>{formatSar(data.invoice.expected)}</strong>
          <small>{data.invoice.assignedStudents} assigned students</small>
        </article>
        <article className="metric-card">
          <span>Verified collected</span>
          <strong>{formatSar(data.invoice.collected)}</strong>
          <small>{data.invoice.paid} fully paid</small>
        </article>
        <article className="metric-card">
          <span>Remaining</span>
          <strong>{formatSar(data.invoice.remaining)}</strong>
          <small>{data.invoice.unpaid + data.invoice.partiallyPaid} open balances</small>
        </article>
      </section>
      <section className="panel">
        <div className="segmented-control" aria-label="Filter students by payment status">
          {filters.map(([value, label, count]) => (
            <button
              type="button"
              key={value}
              className={status === value ? 'selected' : ''}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Parent</th>
                <th scope="col">Virtual IBAN</th>
                <th scope="col">Required</th>
                <th scope="col">Paid</th>
                <th scope="col">Remaining</th>
                <th scope="col">Payment</th>
                <th scope="col">Reconciliation</th>
                <th scope="col">Latest payment</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <Link className="table-link" to={`/students/${student.studentId}`}>
                      {student.studentName}
                    </Link>
                    <span className="table-secondary">{student.studentCode}</span>
                  </td>
                  <td>{student.parentName}</td>
                  <td className="mono">{student.viban ?? 'Not assigned'}</td>
                  <td>{formatSar(student.requiredAmount)}</td>
                  <td>{formatSar(student.paidAmount)}</td>
                  <td>{formatSar(student.remainingAmount)}</td>
                  <td>
                    <StatusBadge status={student.status} />
                  </td>
                  <td>
                    <StatusBadge status={student.reconciliationStatus} />
                  </td>
                  <td>{formatDate(student.latestPaymentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

interface ParentSearchData {
  parent: { id: string; name: string; nationalIdMasked: string };
  students: Array<
    Student & {
      invoices: Invoice[];
      payments: Payment[];
    }
  >;
  familyOutstanding: number;
}

function ParentSearchPage() {
  const [nationalId, setNationalId] = useState('');
  const [data, setData] = useState<ParentSearchData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState('all');

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setData(null);
    try {
      setData(
        await api<ParentSearchData>(
          `/api/parents/search?nationalId=${encodeURIComponent(nationalId)}`,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Family records"
        title="Search by parent National ID"
        description="Retrieve linked students, Virtual IBANs, invoices, and verified payment records."
      />
      <section className="panel search-panel">
        <form onSubmit={search}>
          <label>
            Parent National ID
            <div className="input-action">
              <input
                value={nationalId}
                inputMode="numeric"
                maxLength={14}
                onChange={(event) => setNationalId(event.target.value.replace(/\D/g, ''))}
                aria-describedby="nid-help"
                required
              />
              <button className="button button-primary" type="submit" disabled={loading}>
                {loading ? 'Searching…' : 'Search records'}
              </button>
            </div>
          </label>
          <p id="nid-help" className="field-help">
            Enter the parent’s National ID. Searches are audited and restricted to this school.
          </p>
        </form>
      </section>
      {error && <Alert variant="error">{error}</Alert>}
      {data && (
        <>
          <section className="panel family-header">
            <div>
              <p className="eyebrow">Family record</p>
              <h2>{data.parent.name}</h2>
              <p className="mono">{data.parent.nationalIdMasked}</p>
            </div>
            <div className="family-balance">
              <span>Family outstanding balance</span>
              <strong>{formatSar(data.familyOutstanding)}</strong>
            </div>
          </section>
          <div className="result-toolbar">
            <span>{data.students.length} linked students</span>
            <label>
              Invoice status
              <select
                value={invoiceStatus}
                onChange={(event) => setInvoiceStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
          </div>
          {data.students.map((student) => {
            const visibleInvoices = student.invoices.filter(
              (invoice) => invoiceStatus === 'all' || invoice.status === invoiceStatus,
            );
            return (
              <section className="panel family-student" key={student.id}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{student.studentCode}</p>
                    <h2>{student.name}</h2>
                    <p>
                      {student.grade} · <StatusBadge status={student.vibanStatus} />
                    </p>
                  </div>
                  <div className="family-student-actions">
                    <span className="mono">{student.viban ?? 'VIBAN not assigned'}</span>
                    <Link className="button button-secondary button-small" to={`/students/${student.id}`}>
                      Open complete record
                    </Link>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Invoice</th>
                        <th scope="col">Required</th>
                        <th scope="col">Paid</th>
                        <th scope="col">Remaining</th>
                        <th scope="col">Due date</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.feeName}</td>
                          <td>{formatSar(invoice.requiredAmount)}</td>
                          <td>{formatSar(invoice.paidAmount)}</td>
                          <td>{formatSar(invoice.remainingAmount)}</td>
                          <td>{formatDate(invoice.dueDate)}</td>
                          <td>
                            <StatusBadge status={invoice.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function NotFoundPage() {
  return (
    <section className="empty full-page-empty">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="button button-primary" to="/dashboard">
        Return to dashboard
      </Link>
    </section>
  );
}

function SchoolApp() {
  const session = useSession();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage session={session} />} />
      <Route element={<ProtectedLayout session={session} />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentRecordPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/new" element={<CreateInvoicePage />} />
        <Route path="/invoices/:batchReference" element={<InvoiceDetailPage />} />
        <Route path="/parents" element={<ParentSearchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const location = useLocation();
  return location.pathname.startsWith('/parent') ? <ParentPortal /> : <SchoolApp />;
}
