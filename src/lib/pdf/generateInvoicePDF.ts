import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Invoice, InvoiceItem, Business } from '@/types/database';

interface GenerateInvoicePDFParams {
  invoice: Invoice & { items?: InvoiceItem[] };
  business: Business | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return `${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}/-`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Draws a faint full-page watermark using the logo or business initials.
 * Must be called BEFORE any other content so it sits behind everything.
 */
function drawWatermark(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  logoBase64: string | null,
  initials: string
) {
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  const size = 120;

  doc.saveGraphicsState();
  (doc as any).setGState(new (doc as any).GState({ opacity: 0.07 }));

  if (logoBase64) {
    try {
      doc.addImage(
        logoBase64,
        'PNG',
        centerX - size / 2,
        centerY - size / 2,
        size,
        size
      );
    } catch { /* skip on error */ }
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(80);
    doc.setTextColor(180, 180, 180);
    doc.text(initials, centerX, centerY, { align: 'center' });
  }

  doc.restoreGraphicsState();

  // Always reset text color after watermark
  doc.setTextColor(0, 0, 0);
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateInvoicePDF({
  invoice,
  business,
}: GenerateInvoicePDFParams): Promise<jsPDF> {
  const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();   // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight();  // 297 mm
  const margin     = 14;

  const businessName = (business?.business_name || 'Your Business').toUpperCase();
  const initials     = businessName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  // Load logo once — reused for both watermark and header badge
  const logoBase64 = business?.logo_url
    ? await loadImageAsBase64(business.logo_url)
    : null;

  // ── 1. WATERMARK — drawn first so all content renders on top ─────────────
  drawWatermark(doc, pageWidth, pageHeight, logoBase64, initials);

  // ── 2. HEADER: Logo badge (left) + Business name (centred) ───────────────
  let yPos    = 14;
  const logoW = 22;
  const logoH = 22;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'AUTO', margin, yPos, logoW, logoH);
    } catch { /* skip logo on error */ }
  }

  // Business name — always centred on the full page width
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(0, 0, 0);
  doc.text(businessName, pageWidth / 2, yPos + 12, { align: 'center' });

  yPos += logoH + 4;

  // ── 3. CONTACT LINE — centred, pipe-separated ────────────────────────────
  const contactParts: string[] = [];
  if (business?.business_address) {
    const cityState = [business.city, business.state, business.pincode]
      .filter(Boolean)
      .join(', ');
    contactParts.push(
      business.business_address + (cityState ? `, ${cityState}` : '')
    );
  }
  if (business?.phone_number) contactParts.push(`Mob.: ${business.phone_number}`);
  if (business?.email)        contactParts.push(`Email: ${business.email}`);

  if (contactParts.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    doc.text(contactParts.join('   |   '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 5.5;
  }

  if (business?.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`GST NO.: ${business.gstin}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5.5;
  }

  // Reset text colour before drawing lines / body content
  doc.setTextColor(0, 0, 0);

  // Horizontal rule
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ── 4. DOCUMENT TITLE ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('INVOICE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 9;

  // ── 5. INVOICE META — date (left) | invoice number (right) ───────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Date: ${format(new Date(invoice.invoice_date), 'dd-MM-yyyy')}`,
    margin,
    yPos
  );
  doc.text(
    `Invoice No.: ${invoice.invoice_number}`,
    pageWidth - margin,
    yPos,
    { align: 'right' }
  );
  yPos += 5.5;

  if (invoice.due_date) {
    doc.text(
      `Due Date: ${format(new Date(invoice.due_date), 'dd-MM-yyyy')}`,
      pageWidth - margin,
      yPos,
      { align: 'right' }
    );
    yPos += 5.5;
  }

  yPos += 4;

  // ── 6. CLIENT / "TO" BLOCK ────────────────────────────────────────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('To,', margin, yPos);
  yPos += 6;

  // Client name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.client_name || '-', margin, yPos);
  yPos += 6;

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  if (invoice.client_address) {
    const addressLines = doc.splitTextToSize(invoice.client_address, 120) as string[];
    doc.text(addressLines, margin, yPos);
    yPos += addressLines.length * 5;
  }

  // Phone
  if (invoice.client_phone) {
    doc.text(`Phone: ${invoice.client_phone}`, margin, yPos);
    yPos += 5;
  }

  // GST
  if (invoice.client_gstin) {
    doc.text(`GST No.: ${invoice.client_gstin}`, margin, yPos);
    yPos += 5;
  }

  yPos += 6;

  // ── 7. ITEMS TABLE ────────────────────────────────────────────────────────
  const items = invoice.items || [];

const tableBody = items.map((item, index) => {
  const quantity  = Number(item.quantity)   || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const total     = Number(item.total)      || Number(item.subtotal) || (quantity * unitPrice);

  // item.name is correct per your NewInvoice.tsx
  const displayText = item.name?.trim()
    ? item.name + (item.description ? `\n${item.description}` : '')
    : '—';

  return [
    String(index + 1),
    displayText,
    String(quantity),
    formatAmount(unitPrice),
    formatAmount(total),
  ];
});

  autoTable(doc, {
  startY: yPos,
  head: [['No.', 'Item Description', 'Qty', 'Rate', 'Amount']],
  body: tableBody,
  theme: 'plain',  // ← changed from 'grid' to 'plain'

  styles: {
    font: 'helvetica',
    fontSize: 10,
    cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    lineColor: [200, 200, 200],
    lineWidth: 0.3,
    textColor: [0, 0, 0],
    overflow: 'linebreak',
    fillColor: false,  // ← transparent background
  },

  headStyles: {
    fillColor: [30, 30, 30],  // header stays dark
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    halign: 'center',
    fontSize: 10,
  },

  alternateRowStyles: {
    fillColor: false,  // ← no alternating fill, fully transparent
  },

  bodyStyles: {
    fillColor: false,  // ← transparent body rows
    lineColor: [200, 200, 200],
    lineWidth: 0.3,
  },

  columnStyles: {
    0: { cellWidth: 12,     halign: 'center' },
    1: { cellWidth: 'auto' },
    2: { cellWidth: 18,     halign: 'center' },
    3: { cellWidth: 32,     halign: 'right' },
    4: { cellWidth: 35,     halign: 'right' },
  },
});

  const finalY = (doc as any).lastAutoTable.finalY as number;

  // ── 8. TOTALS BLOCK — right-aligned below table ───────────────────────────
  const subtotal   = Number(invoice.subtotal);
  const totalTax   = Number(invoice.tax_amount);
  const totalAmt   = Number(invoice.total_amount);
  const discount   = Number(invoice.discount_amount) || 0;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const hasTax     = totalTax > 0;

  const labelX  = pageWidth - margin - 70;
  let totalsY   = finalY + 7;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // Sub-total row (only shown when tax is present, for clarity)
  if (hasTax) {
    const halfTax  = totalTax / 2;
    const halfRate = subtotal > 0 ? (halfTax / subtotal) * 100 : 0;

    doc.setFont('helvetica', 'normal');

    doc.text('Sub-Total:', labelX, totalsY);
    doc.text(formatAmount(subtotal), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;

    doc.text(`SGST @ ${halfRate.toFixed(1)}%:`, labelX, totalsY);
    doc.text(formatAmount(halfTax), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;

    doc.text(`CGST @ ${halfRate.toFixed(1)}%:`, labelX, totalsY);
    doc.text(formatAmount(halfTax), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;
  }

  // Discount
  if (discount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Discount:', labelX, totalsY);
    doc.text(`-${formatAmount(discount)}`, pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;
  }

  // Thin rule above grand total
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(labelX, totalsY, pageWidth - margin, totalsY);
  totalsY += 4;

  // Grand Total — bold label + amount
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', labelX, totalsY);
  doc.text(formatAmount(totalAmt), pageWidth - margin, totalsY, { align: 'right' });
  totalsY += 8;

  // Advance & remaining balance
  if (amountPaid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Advance Paid:', labelX, totalsY);
    doc.text(`-${formatAmount(amountPaid)}`, pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;

    const balance = totalAmt - amountPaid;
    if (balance > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Balance Due:', labelX, totalsY);
      doc.text(formatAmount(balance), pageWidth - margin, totalsY, { align: 'right' });
      totalsY += 5.5;
    }
  }

  // ── 9. TERMS & CONDITIONS ─────────────────────────────────────────────────
  let termsY = totalsY + 8;

  if (invoice.notes || invoice.terms) {
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Terms & Conditions:', margin, termsY);
    termsY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    if (invoice.notes) {
      const lines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2) as string[];
      doc.text(lines, margin, termsY);
      termsY += lines.length * 4.8 + 2;
    }

    if (invoice.terms) {
      const lines = doc.splitTextToSize(invoice.terms, pageWidth - margin * 2) as string[];
      doc.text(lines, margin, termsY);
      termsY += lines.length * 4.8;
    }
  }

  // ── 10. FOOTER ───────────────────────────────────────────────────────────
  // Clamp footer so it never overlaps content AND never floats too high
  const footerY = Math.max(termsY + 12, pageHeight - 28);

  // Separator line above footer
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Thanking you,', margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(businessName, margin, footerY + 6);

  // Right side: authorised signatory label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Authorised Signatory', pageWidth - margin, footerY + 6, { align: 'right' });

  return doc;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function downloadInvoicePDF(params: GenerateInvoicePDFParams): Promise<void> {
  const doc = await generateInvoicePDF(params);
  doc.save(`${params.invoice.invoice_number}.pdf`);
}

export async function getInvoicePDFBlob(params: GenerateInvoicePDFParams): Promise<Blob> {
  const doc = await generateInvoicePDF(params);
  return doc.output('blob');
}

export async function getInvoicePDFDataUri(params: GenerateInvoicePDFParams): Promise<string> {
  const doc = await generateInvoicePDF(params);
  return doc.output('datauristring');
}