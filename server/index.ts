import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(express.json());

type VibanStatus = 'not_assigned' | 'pending' | 'active' | 'failed' | 'inactive';
type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid';
type PaymentStatus = 'confirmed' | 'pending' | 'failed';

interface Parent {
  id: string;
  name: string;
  nationalId: string;
}

interface Student {
  id: string;
  studentCode: string;
  name: string;
  parentId: string;
  academicYear: string;
  grade: string;
  viban?: string;
  remitterId?: string;
  vibanStatus: VibanStatus;
  vibanFailureReason?: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  batchReference: string;
  studentId: string;
  feeName: string;
  category: string;
  description: string;
  requiredAmount: number;
  dueDate: string;
  academicPeriod: string;
  partialAllowed: boolean;
  createdAt: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  studentId: string;
  providerTransactionId: string;
  amount: number;
  currency: 'SAR';
  status: PaymentStatus;
  reconciliationStatus: 'reconciled' | 'pending' | 'failed';
  transactionDate: string;
}

interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
}

interface ImportRow {
  rowNumber: number;
  studentId: string;
  studentName: string;
  parentNationalId: string;
  parentName: string;
  academicYear: string;
  grade: string;
  valid: boolean;
  existing: boolean;
  errors: string[];
}

interface ImportPreview {
  id: string;
  rows: ImportRow[];
  createdAt: string;
}

const SCHOOL_ID = 'school-green-valley';
const SCHOOL_NAME = 'Green Valley International School';
const sessions = new Map<string, { userId: string; schoolId: string; expiresAt: number }>();
const previews = new Map<string, ImportPreview>();

const parents: Parent[] = [
  { id: 'par-1', name: 'Mariam Hassan', nationalId: '12345678910' },
  { id: 'par-2', name: 'Khaled Mansour', nationalId: '28706151234568' },
  { id: 'par-3', name: 'Dina Samir', nationalId: '29211221234569' },
];

const students: Student[] = [
  {
    id: 'stu-1',
    studentCode: 'GV-1001',
    name: 'Omar Hassan',
    parentId: 'par-1',
    academicYear: '2026/2027',
    grade: 'Grade 8',
    viban: 'SA1280000000001000000001',
    remitterId: '1001',
    vibanStatus: 'active',
    createdAt: '2026-10-15T08:30:00.000Z',
  },
  {
    id: 'stu-2',
    studentCode: 'GV-1002',
    name: 'Laila Hassan',
    parentId: 'par-1',
    academicYear: '2026/2027',
    grade: 'Grade 5',
    viban: 'SA1280000000001000000002',
    remitterId: '1002',
    vibanStatus: 'active',
    createdAt: '2026-10-15T08:31:00.000Z',
  },
  {
    id: 'stu-3',
    studentCode: 'GV-1003',
    name: 'Youssef Mansour',
    parentId: 'par-2',
    academicYear: '2026/2027',
    grade: 'Grade 10',
    viban: 'SA1280000000001000000003',
    remitterId: '1003',
    vibanStatus: 'active',
    createdAt: '2026-10-15T08:32:00.000Z',
  },
  {
    id: 'stu-4',
    studentCode: 'GV-1004',
    name: 'Nour Samir',
    parentId: 'par-3',
    academicYear: '2026/2027',
    grade: 'Grade 6',
    vibanStatus: 'failed',
    vibanFailureReason: 'Provider request timed out',
    createdAt: '2026-10-15T08:33:00.000Z',
  },
];

const invoices: Invoice[] = [
  {
    id: 'inv-1',
    batchReference: 'BATCH-TUITION-2026',
    studentId: 'stu-1',
    feeName: 'Term 1 Tuition',
    category: 'Tuition',
    description: 'First-term tuition fees',
    requiredAmount: 18000,
    dueDate: '2026-11-15',
    academicPeriod: '2026/2027 - Term 1',
    partialAllowed: true,
    createdAt: '2026-10-18T09:00:00.000Z',
  },
  {
    id: 'inv-2',
    batchReference: 'BATCH-TUITION-2026',
    studentId: 'stu-2',
    feeName: 'Term 1 Tuition',
    category: 'Tuition',
    description: 'First-term tuition fees',
    requiredAmount: 15000,
    dueDate: '2026-11-15',
    academicPeriod: '2026/2027 - Term 1',
    partialAllowed: true,
    createdAt: '2026-10-18T09:00:00.000Z',
  },
  {
    id: 'inv-3',
    batchReference: 'BATCH-TUITION-2026',
    studentId: 'stu-3',
    feeName: 'Term 1 Tuition',
    category: 'Tuition',
    description: 'First-term tuition fees',
    requiredAmount: 20000,
    dueDate: '2026-11-15',
    academicPeriod: '2026/2027 - Term 1',
    partialAllowed: true,
    createdAt: '2026-10-18T09:00:00.000Z',
  },
  {
    id: 'inv-4',
    batchReference: 'BATCH-TRANSPORT-2026',
    studentId: 'stu-4',
    feeName: 'Annual Transportation',
    category: 'Transportation',
    description: 'School bus service',
    requiredAmount: 6000,
    dueDate: '2026-11-01',
    academicPeriod: '2026/2027',
    partialAllowed: false,
    createdAt: '2026-10-19T10:00:00.000Z',
  },
];

const payments: Payment[] = [
  {
    id: 'pay-1',
    invoiceId: 'inv-1',
    studentId: 'stu-1',
    providerTransactionId: 'ARB-2026-000143',
    amount: 18000,
    currency: 'SAR',
    status: 'confirmed',
    reconciliationStatus: 'reconciled',
    transactionDate: '2026-10-22T12:15:00.000Z',
  },
  {
    id: 'pay-2',
    invoiceId: 'inv-2',
    studentId: 'stu-2',
    providerTransactionId: 'ARB-2026-000144',
    amount: 5000,
    currency: 'SAR',
    status: 'confirmed',
    reconciliationStatus: 'reconciled',
    transactionDate: '2026-10-23T14:05:00.000Z',
  },
  {
    id: 'pay-3',
    invoiceId: 'inv-2',
    studentId: 'stu-2',
    providerTransactionId: 'ARB-2026-000145',
    amount: 2500,
    currency: 'SAR',
    status: 'pending',
    reconciliationStatus: 'pending',
    transactionDate: '2026-10-24T08:20:00.000Z',
  },
];

const auditLog: AuditEntry[] = [];

function now() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = parseCookies(request).klickit_session;
  const session = token ? sessions.get(token) : undefined;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    return;
  }
  response.locals.session = session;
  next();
}

function delay(milliseconds = 250) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function maskNationalId(nationalId: string) {
  return `${nationalId.slice(0, 3)}••••••••${nationalId.slice(-3)}`;
}

function confirmedPaid(invoiceId: string) {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === 'confirmed')
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function invoiceView(invoice: Invoice) {
  const paidAmount = confirmedPaid(invoice.id);
  const remainingAmount = Math.max(0, invoice.requiredAmount - paidAmount);
  const status: InvoiceStatus =
    paidAmount === 0 ? 'unpaid' : remainingAmount === 0 ? 'paid' : 'partially_paid';
  return { ...invoice, paidAmount, remainingAmount, status };
}

function studentView(student: Student) {
  const parent = parents.find((item) => item.id === student.parentId)!;
  const studentInvoices = invoices.filter((invoice) => invoice.studentId === student.id).map(invoiceView);
  const totalInvoiced = studentInvoices.reduce((sum, invoice) => sum + invoice.requiredAmount, 0);
  const totalPaid = studentInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  return {
    ...student,
    parentName: parent.name,
    parentNationalIdMasked: maskNationalId(parent.nationalId),
    invoiceCount: studentInvoices.length,
    totalInvoiced,
    totalPaid,
    outstanding: totalInvoiced - totalPaid,
  };
}

function addAudit(action: string, detail: string) {
  auditLog.unshift({ id: uid('audit'), action, detail, createdAt: now() });
}

app.post('/api/auth/login', async (request, response) => {
  await delay();
  const { email, password } = request.body as { email?: string; password?: string };
  if (email !== 'finance' || password !== 'finance') {
    response.status(401).json({ message: 'The username or password is incorrect.' });
    return;
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    userId: 'finance-user-1',
    schoolId: SCHOOL_ID,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  });
  response.setHeader(
    'Set-Cookie',
    `klickit_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
  );
  addAudit('User signed in', 'School finance session created');
  response.json({
    user: { name: 'Ahmed Mansour', role: 'School Finance User', schoolName: SCHOOL_NAME },
  });
});

app.get('/api/auth/session', requireAuth, (_request, response) => {
  response.json({
    user: { name: 'Ahmed Mansour', role: 'School Finance User', schoolName: SCHOOL_NAME },
  });
});

app.post('/api/auth/logout', requireAuth, (request, response) => {
  const token = parseCookies(request).klickit_session;
  if (token) sessions.delete(token);
  response.setHeader('Set-Cookie', 'klickit_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  addAudit('User signed out', 'School finance session invalidated');
  response.status(204).end();
});

app.get('/api/dashboard', requireAuth, async (_request, response) => {
  await delay(120);
  const views = invoices.map(invoiceView);
  response.json({
    schoolName: SCHOOL_NAME,
    totals: {
      invoiced: views.reduce((sum, invoice) => sum + invoice.requiredAmount, 0),
      collected: views.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
      outstanding: views.reduce((sum, invoice) => sum + invoice.remainingAmount, 0),
      students: students.length,
      paid: views.filter((invoice) => invoice.status === 'paid').length,
      partiallyPaid: views.filter((invoice) => invoice.status === 'partially_paid').length,
      unpaid: views.filter((invoice) => invoice.status === 'unpaid').length,
    },
    recentPayments: payments
      .slice()
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 4)
      .map((payment) => ({
        ...payment,
        studentName: students.find((student) => student.id === payment.studentId)?.name,
        invoiceName: invoices.find((invoice) => invoice.id === payment.invoiceId)?.feeName,
      })),
    audit: auditLog.slice(0, 5),
  });
});

app.get('/api/students', requireAuth, async (request, response) => {
  await delay(120);
  const search = String(request.query.search ?? '').trim().toLowerCase();
  const status = String(request.query.status ?? 'all');
  const filtered = students
    .filter((student) => {
      const matchesSearch =
        !search ||
        student.name.toLowerCase().includes(search) ||
        student.studentCode.toLowerCase().includes(search);
      const matchesStatus = status === 'all' || student.vibanStatus === status;
      return matchesSearch && matchesStatus;
    })
    .map(studentView);
  response.json({ students: filtered, total: filtered.length });
});

app.get('/api/students/:id', requireAuth, async (request, response) => {
  await delay(120);
  const student = students.find((item) => item.id === request.params.id);
  if (!student) {
    response.status(404).json({ message: 'Student record was not found.' });
    return;
  }
  const parent = parents.find((item) => item.id === student.parentId)!;
  const studentInvoices = invoices.filter((invoice) => invoice.studentId === student.id).map(invoiceView);
  const studentPayments = payments
    .filter((payment) => payment.studentId === student.id)
    .map((payment) => ({
      ...payment,
      invoiceName: invoices.find((invoice) => invoice.id === payment.invoiceId)?.feeName,
    }));
  response.json({
    student: { ...studentView(student), parent: { ...parent, nationalIdMasked: maskNationalId(parent.nationalId) } },
    invoices: studentInvoices,
    payments: studentPayments,
  });
});

app.get('/api/import/template', requireAuth, async (_request, response) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');
  worksheet.addRow([
    'Student ID',
    'Student Name',
    'Parent National ID',
    'Parent Name',
    'Academic Year',
    'Grade or Class',
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename=\"Klickit_Student_Import_Template.xlsx\"');
  response.send(buffer);
});

app.post('/api/import/preview', requireAuth, upload.single('file'), async (request, response) => {
  await delay(350);
  if (!request.file) {
    response.status(400).json({ message: 'Select an Excel workbook to continue.' });
    return;
  }
  if (!request.file.originalname.toLowerCase().endsWith('.xlsx')) {
    response.status(400).json({ message: 'Only .xlsx workbooks are supported.' });
    return;
  }
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(request.file.buffer).buffer);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) {
      response.status(400).json({ message: 'The workbook does not contain a worksheet.' });
      return;
    }
    const headers = new Map<string, number>();
    firstSheet.getRow(1).eachCell((cell, columnNumber) => {
      headers.set(cell.text.trim(), columnNumber);
    });
    const requiredHeaders = [
      'Student ID',
      'Student Name',
      'Parent National ID',
      'Parent Name',
      'Academic Year',
      'Grade or Class',
    ];
    const missingHeaders = requiredHeaders.filter((header) => !headers.has(header));
    if (missingHeaders.length > 0) {
      response.status(400).json({ message: `Missing required columns: ${missingHeaders.join(', ')}.` });
      return;
    }
    const sourceRows: Record<string, string>[] = [];
    for (let rowNumber = 2; rowNumber <= firstSheet.rowCount; rowNumber += 1) {
      const row = firstSheet.getRow(rowNumber);
      const source = Object.fromEntries(
        requiredHeaders.map((header) => [header, row.getCell(headers.get(header)!).text.trim()]),
      );
      if (Object.values(source).some(Boolean)) sourceRows.push(source);
    }
    if (sourceRows.length === 0) {
      response.status(400).json({ message: 'The workbook does not contain any student rows.' });
      return;
    }
    const seenCodes = new Set<string>();
    const rows = sourceRows.map((source, index): ImportRow => {
      const studentId = String(source['Student ID'] ?? '').trim();
      const studentName = String(source['Student Name'] ?? '').trim();
      const parentNationalId = String(source['Parent National ID'] ?? '').trim();
      const parentName = String(source['Parent Name'] ?? '').trim();
      const academicYear = String(source['Academic Year'] ?? '').trim();
      const grade = String(source['Grade or Class'] ?? '').trim();
      const errors: string[] = [];
      if (!studentId) errors.push('Student ID is required.');
      if (!studentName) errors.push('Student Name is required.');
      if (!/^\d{10,14}$/.test(parentNationalId)) {
        errors.push('Parent National ID must contain 10 to 14 digits.');
      }
      if (!parentName) errors.push('Parent Name is required.');
      if (!academicYear) errors.push('Academic Year is required.');
      if (!grade) errors.push('Grade or Class is required.');
      if (studentId && seenCodes.has(studentId.toLowerCase())) errors.push('Duplicate Student ID in workbook.');
      seenCodes.add(studentId.toLowerCase());
      return {
        rowNumber: index + 2,
        studentId,
        studentName,
        parentNationalId,
        parentName,
        academicYear,
        grade,
        valid: errors.length === 0,
        existing: students.some((student) => student.studentCode.toLowerCase() === studentId.toLowerCase()),
        errors,
      };
    });
    const preview: ImportPreview = { id: uid('preview'), rows, createdAt: now() };
    previews.set(preview.id, preview);
    addAudit('Excel file previewed', `${request.file.originalname}: ${rows.length} rows`);
    response.json({
      previewId: preview.id,
      rows,
      summary: {
        total: rows.length,
        valid: rows.filter((row) => row.valid).length,
        invalid: rows.filter((row) => !row.valid).length,
        existing: rows.filter((row) => row.existing).length,
        new: rows.filter((row) => row.valid && !row.existing).length,
      },
    });
  } catch {
    response.status(400).json({ message: 'The workbook could not be read. Use the provided template.' });
  }
});

app.post('/api/import/commit', requireAuth, async (request, response) => {
  await delay(400);
  const { previewId } = request.body as { previewId?: string };
  const preview = previewId ? previews.get(previewId) : undefined;
  if (!preview) {
    response.status(404).json({ message: 'The import preview expired. Upload the workbook again.' });
    return;
  }
  let imported = 0;
  let existing = 0;
  for (const row of preview.rows.filter((item) => item.valid)) {
    const knownStudent = students.find(
      (student) => student.studentCode.toLowerCase() === row.studentId.toLowerCase(),
    );
    if (knownStudent) {
      existing += 1;
      continue;
    }
    let parent = parents.find((item) => item.nationalId === row.parentNationalId);
    if (!parent) {
      parent = { id: uid('par'), name: row.parentName, nationalId: row.parentNationalId };
      parents.push(parent);
    }
    students.push({
      id: uid('stu'),
      studentCode: row.studentId,
      name: row.studentName,
      parentId: parent.id,
      academicYear: row.academicYear,
      grade: row.grade,
      vibanStatus: 'not_assigned',
      createdAt: now(),
    });
    imported += 1;
  }
  previews.delete(preview.id);
  addAudit('Students imported', `${imported} imported, ${existing} already existed`);
  response.json({
    imported,
    existing,
    failed: preview.rows.filter((row) => !row.valid).length,
    message: `${imported} student records imported successfully.`,
  });
});

async function provisionStudent(student: Student) {
  student.vibanStatus = 'pending';
  await delay(300);
  const shouldFail = student.name.toLowerCase().includes('fail');
  if (shouldFail) {
    student.vibanStatus = 'failed';
    student.vibanFailureReason = 'Provider rejected the student record.';
    return { studentId: student.id, outcome: 'failed' as const, reason: student.vibanFailureReason };
  }
  const numericCode = student.studentCode.replace(/\D/g, '').padStart(8, '0').slice(-8);
  student.remitterId = numericCode;
  student.viban = `SA128000000000${numericCode.padStart(10, '0')}`;
  student.vibanStatus = 'active';
  delete student.vibanFailureReason;
  return { studentId: student.id, outcome: 'created' as const, viban: student.viban };
}

app.post('/api/vibans/provision', requireAuth, async (request, response) => {
  const { studentIds } = request.body as { studentIds?: string[] };
  const targets = students.filter(
    (student) =>
      (studentIds?.length ? studentIds.includes(student.id) : true) && student.vibanStatus !== 'active',
  );
  const reused = students.filter(
    (student) => (studentIds?.length ? studentIds.includes(student.id) : false) && student.vibanStatus === 'active',
  ).length;
  const results = [];
  for (const student of targets) {
    results.push(await provisionStudent(student));
  }
  addAudit(
    'Virtual IBAN provisioning completed',
    `${results.filter((item) => item.outcome === 'created').length} created, ${reused} reused, ${results.filter((item) => item.outcome === 'failed').length} failed`,
  );
  response.json({
    created: results.filter((item) => item.outcome === 'created').length,
    reused,
    failed: results.filter((item) => item.outcome === 'failed').length,
    results,
  });
});

app.get('/api/invoices', requireAuth, async (_request, response) => {
  await delay(120);
  const groups = new Map<string, Invoice[]>();
  for (const invoice of invoices) {
    const group = groups.get(invoice.batchReference) ?? [];
    group.push(invoice);
    groups.set(invoice.batchReference, group);
  }
  response.json({
    invoices: Array.from(groups.entries()).map(([batchReference, items]) => {
      const views = items.map(invoiceView);
      return {
        batchReference,
        feeName: items[0]!.feeName,
        category: items[0]!.category,
        description: items[0]!.description,
        requiredAmountPerStudent: items[0]!.requiredAmount,
        dueDate: items[0]!.dueDate,
        academicPeriod: items[0]!.academicPeriod,
        assignedStudents: items.length,
        expected: views.reduce((sum, invoice) => sum + invoice.requiredAmount, 0),
        collected: views.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
        remaining: views.reduce((sum, invoice) => sum + invoice.remainingAmount, 0),
        paid: views.filter((invoice) => invoice.status === 'paid').length,
        partiallyPaid: views.filter((invoice) => invoice.status === 'partially_paid').length,
        unpaid: views.filter((invoice) => invoice.status === 'unpaid').length,
      };
    }),
  });
});

app.post('/api/invoices', requireAuth, async (request, response) => {
  await delay(300);
  const {
    feeName,
    category,
    description,
    requiredAmount,
    dueDate,
    academicPeriod,
    partialAllowed,
    studentIds,
  } = request.body as {
    feeName?: string;
    category?: string;
    description?: string;
    requiredAmount?: number;
    dueDate?: string;
    academicPeriod?: string;
    partialAllowed?: boolean;
    studentIds?: string[];
  };
  if (
    !feeName ||
    !category ||
    !description ||
    !requiredAmount ||
    requiredAmount <= 0 ||
    !dueDate ||
    !academicPeriod ||
    !studentIds?.length
  ) {
    response.status(400).json({ message: 'Complete all required invoice fields and select students.' });
    return;
  }
  const selected = students.filter((student) => studentIds.includes(student.id));
  if (selected.length !== studentIds.length) {
    response.status(400).json({ message: 'One or more selected students are unavailable.' });
    return;
  }
  const batchReference = `BATCH-${category.toUpperCase().replace(/\W+/g, '-')}-${Date.now()}`;
  for (const student of selected) {
    const duplicate = invoices.some(
      (invoice) =>
        invoice.studentId === student.id &&
        invoice.feeName.toLowerCase() === feeName.toLowerCase() &&
        invoice.academicPeriod === academicPeriod,
    );
    if (duplicate) {
      response.status(409).json({
        message: `${student.name} already has this fee invoice for ${academicPeriod}.`,
      });
      return;
    }
  }
  for (const student of selected) {
    invoices.push({
      id: uid('inv'),
      batchReference,
      studentId: student.id,
      feeName,
      category,
      description,
      requiredAmount,
      dueDate,
      academicPeriod,
      partialAllowed: Boolean(partialAllowed),
      createdAt: now(),
    });
  }
  addAudit('Fee invoice assigned', `${feeName} assigned to ${selected.length} students`);
  response.status(201).json({
    batchReference,
    created: selected.length,
    message: `${selected.length} student invoices created successfully.`,
  });
});

app.get('/api/invoices/:batchReference', requireAuth, async (request, response) => {
  await delay(120);
  const status = String(request.query.status ?? 'all');
  const items = invoices.filter((invoice) => invoice.batchReference === request.params.batchReference);
  if (!items.length) {
    response.status(404).json({ message: 'Invoice group was not found.' });
    return;
  }
  const views = items.map(invoiceView).map((invoice) => {
    const student = students.find((item) => item.id === invoice.studentId)!;
    const parent = parents.find((item) => item.id === student.parentId)!;
    const latestPayment = payments
      .filter((payment) => payment.invoiceId === invoice.id && payment.status === 'confirmed')
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))[0];
    return {
      ...invoice,
      studentName: student.name,
      studentCode: student.studentCode,
      parentName: parent.name,
      viban: student.viban,
      reconciliationStatus: latestPayment?.reconciliationStatus ?? 'not_started',
      latestPaymentDate: latestPayment?.transactionDate,
    };
  });
  const filtered = status === 'all' ? views : views.filter((item) => item.status === status);
  response.json({
    invoice: {
      batchReference: request.params.batchReference,
      feeName: items[0]!.feeName,
      category: items[0]!.category,
      description: items[0]!.description,
      academicPeriod: items[0]!.academicPeriod,
      requiredAmountPerStudent: items[0]!.requiredAmount,
      dueDate: items[0]!.dueDate,
      assignedStudents: items.length,
      expected: views.reduce((sum, item) => sum + item.requiredAmount, 0),
      collected: views.reduce((sum, item) => sum + item.paidAmount, 0),
      remaining: views.reduce((sum, item) => sum + item.remainingAmount, 0),
      paid: views.filter((item) => item.status === 'paid').length,
      partiallyPaid: views.filter((item) => item.status === 'partially_paid').length,
      unpaid: views.filter((item) => item.status === 'unpaid').length,
    },
    students: filtered,
  });
});

app.get('/api/parents/search', requireAuth, async (request, response) => {
  await delay(180);
  const nationalId = String(request.query.nationalId ?? '').trim();
  if (!/^\d{10,14}$/.test(nationalId)) {
    response.status(400).json({ message: 'Enter a valid National ID containing 10 to 14 digits.' });
    return;
  }
  const parent = parents.find((item) => item.nationalId === nationalId);
  addAudit('Parent record searched', `National ID ending ${nationalId.slice(-3)}`);
  if (!parent) {
    response.status(404).json({ message: 'No parent record was found for this National ID.' });
    return;
  }
  const linkedStudents = students.filter((student) => student.parentId === parent.id).map((student) => {
    const details = studentView(student);
    const studentInvoices = invoices.filter((invoice) => invoice.studentId === student.id).map(invoiceView);
    const studentPayments = payments
      .filter((payment) => payment.studentId === student.id)
      .map((payment) => ({
        ...payment,
        invoiceName: invoices.find((invoice) => invoice.id === payment.invoiceId)?.feeName,
      }));
    return { ...details, invoices: studentInvoices, payments: studentPayments };
  });
  response.json({
    parent: { id: parent.id, name: parent.name, nationalIdMasked: maskNationalId(parent.nationalId) },
    students: linkedStudents,
    familyOutstanding: linkedStudents.reduce((sum, student) => sum + student.outstanding, 0),
  });
});

app.get('/api/audit', requireAuth, (_request, response) => {
  response.json({ entries: auditLog });
});

app.use('/api', (_request, response) => {
  response.status(404).json({ message: 'The requested API resource was not found.' });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);
  response.status(500).json({ message: 'An unexpected server error occurred.' });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Klickit API listening on http://localhost:${port}`);
});
