export function formatAppointmentId(num: number, year?: number): string {
  const y = year || new Date().getFullYear();
  return `SCZO-${y}-${String(num).padStart(4, "0")}`;
}

export function formatInvoiceId(invoiceNumber: string): string {
  return invoiceNumber;
}

export function maskId(cuid: string): string {
  return cuid.slice(-6).toUpperCase();
}
