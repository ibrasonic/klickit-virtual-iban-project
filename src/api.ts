export interface User {
  name: string;
  role: string;
  schoolName: string;
}

export interface Student {
  id: string;
  studentCode: string;
  name: string;
  parentId: string;
  parentName: string;
  parentNationalIdMasked: string;
  academicYear: string;
  grade: string;
  viban?: string;
  remitterId?: string;
  vibanStatus: 'not_assigned' | 'pending' | 'active' | 'failed' | 'inactive';
  vibanFailureReason?: string;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
}

export interface Invoice {
  id: string;
  batchReference: string;
  studentId: string;
  feeName: string;
  category: string;
  description: string;
  requiredAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  academicPeriod: string;
  partialAllowed: boolean;
  status: 'unpaid' | 'partially_paid' | 'paid';
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  studentId: string;
  providerTransactionId: string;
  amount: number;
  currency: 'SAR';
  status: 'confirmed' | 'pending' | 'failed';
  reconciliationStatus: 'reconciled' | 'pending' | 'failed';
  transactionDate: string;
  invoiceName?: string;
  studentName?: string;
}

export interface InvoiceGroup {
  batchReference: string;
  feeName: string;
  category: string;
  description: string;
  requiredAmountPerStudent: number;
  dueDate: string;
  academicPeriod: string;
  assignedStudents: number;
  expected: number;
  collected: number;
  remaining: number;
  paid: number;
  partiallyPaid: number;
  unpaid: number;
}

export interface ImportRow {
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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers:
      options?.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ message: response.statusText }))) as {
      message?: string;
    };
    throw new ApiError(body.message ?? 'The request could not be completed.', response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function formatSar(amount: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

export function labelStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
