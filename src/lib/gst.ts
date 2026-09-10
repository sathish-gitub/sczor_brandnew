export interface GSTBreakdown {
  totalAmount: number; // what customer pays, e.g. 599
  baseAmount: number; // amount before GST
  gstAmount: number; // GST portion
  gstRate: number; // 18
  cgst: number; // half of gstAmount
  sgst: number; // half of gstAmount
}

export function calculateGSTBreakdown(totalAmount: number, gstRate: number = 18): GSTBreakdown {
  const baseAmount = Math.round((totalAmount / (1 + gstRate / 100)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = gstAmount - cgst;

  return {
    totalAmount,
    baseAmount,
    gstAmount,
    gstRate,
    cgst,
    sgst,
  };
}
