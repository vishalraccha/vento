import { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, Business } from '@/types/database';
import { format } from 'date-fns';
import { Phone, Mail } from 'lucide-react';
import {
  DEFAULT_INVOICE_TERMS,
  DEFAULT_INVOICE_WARRANTY,
  DEFAULT_SIGNATORY_NAME,
  DEFAULT_SIGNATORY_ROLE,
  DEFAULT_SIGNATURE_TEXT,
  generatePaymentQRCode,
  formatCurrency,
} from '@/lib/pdf/invoiceTemplateConstants';

interface InvoiceDocumentViewProps {
  invoice: Invoice & { items?: InvoiceItem[] };
  business: Business | null;
  className?: string;
}

export function InvoiceDocumentView({
  invoice,
  business,
  className = '',
}: InvoiceDocumentViewProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const currency = business?.currency || 'INR';
  const businessName = (business?.business_name || 'MOHAN ELECTRONICS').toUpperCase();
  const address = business?.business_address
    ? `${business.business_address}${business.city ? `, ${business.city}` : ''}${business.pincode ? `, ${business.pincode}` : ''}`
    : '1024 ASHOCK CHOWK, SOLAPUR, 413006';
  const gstin = business?.gstin || '112VJH3242JHJ23';
  const phone = business?.phone_number || '9370426583';
  const email = business?.email || 'mohanelec@gmail.com';

  const clientName = invoice.client_name || 'KETUT SUSILO';
  const clientAddress = invoice.client_address || '123 Anywhere St., Any City, ST 12345';
  const clientGstin = invoice.client_gstin || '112VJH3242JHJ23';

  const invoiceNumber = invoice.invoice_number || '12345';
  const invoiceDateFormatted = invoice.invoice_date
    ? format(new Date(invoice.invoice_date), 'dd MMMM yyyy')
    : format(new Date(), 'dd MMMM yyyy');

  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
    { name: 'Consultation', description: '', quantity: 1, unit_price: 300, total: 300 },
    { name: 'Project Draft', description: '', quantity: 1, unit_price: 2400, total: 2400 },
    { name: 'Implementation', description: '', quantity: 1, unit_price: 2500, total: 2500 },
    { name: 'Additional Supplies', description: '', quantity: 1, unit_price: 750, total: 750 },
    { name: 'Monthly meeting', description: '', quantity: 1, unit_price: 2000, total: 2000 },
  ];

  const subtotal = Number(invoice.subtotal) || items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_price)), 0);
  const taxAmount = Number(invoice.tax_amount) || 0;
  const discountAmount = Number(invoice.discount_amount) || 0;
  const grandTotal = Number(invoice.total_amount) || (subtotal + taxAmount - discountAmount);

  // Compute effective single tax percentage
  let taxPercent = 0;
  if (subtotal > 0 && taxAmount > 0) {
    taxPercent = Math.round((taxAmount / subtotal) * 100);
  } else if (invoice.items?.[0]?.tax_rate) {
    taxPercent = Number(invoice.items[0].tax_rate);
  } else if (business?.default_tax_rate && taxAmount > 0) {
    taxPercent = Number(business.default_tax_rate);
  }

  // Generate UPI QR Code
  useEffect(() => {
    const upiPayString = `upi://pay?pa=${phone}@upi&pn=${encodeURIComponent(businessName)}&am=${grandTotal}&cu=INR`;
    generatePaymentQRCode(upiPayString).then(url => setQrCodeUrl(url));
  }, [phone, businessName, grandTotal]);

  const termsText = invoice.terms || business?.default_terms || DEFAULT_INVOICE_TERMS;
  const warrantyText = invoice.notes || business?.default_notes || DEFAULT_INVOICE_WARRANTY;

  return (
    <div
      className={`bg-white text-gray-900 shadow-xl rounded-sm p-6 sm:p-10 max-w-[800px] mx-auto border border-gray-200 print:shadow-none print:border-none print:p-0 ${className}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── 1. TOP HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        {/* Left: Logo & INVOICE label */}
        <div className="flex flex-col items-start">
          {business?.logo_url ? (
            <img
              src={business.logo_url}
              alt="Logo"
              className="h-20 w-auto object-contain mb-4"
            />
          ) : (
            /* Stylized ME Logo swoosh matching the reference image */
            <div className="mb-4">
              <svg width="100" height="70" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Curved swoosh ellipse */}
                <path
                  d="M130 35 C130 10, 60 5, 20 40 C-5 65, 30 95, 75 92 C105 90, 135 65, 125 45"
                  stroke="#111827"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Stylized ME Letters */}
                <text
                  x="28"
                  y="65"
                  fill="#111827"
                  fontSize="48"
                  fontWeight="900"
                  fontFamily="'Inter', sans-serif"
                  letterSpacing="-2"
                >
                  ME
                </text>
              </svg>
            </div>
          )}

          {/* Charcoal accent bar + INVOICE title */}
          <div className="flex items-center gap-3 mt-1">
            <div className="w-14 h-6 bg-[#4a4a4a]" />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] uppercase">
              INVOICE
            </h1>
          </div>
        </div>

        {/* Right: Business Info */}
        <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#374151] tracking-tight leading-tight uppercase max-w-[280px]">
            {businessName.includes(' ') ? (
              <>
                <span>{businessName.split(' ')[0]}</span>
                <br />
                <span>{businessName.split(' ').slice(1).join(' ')}</span>
              </>
            ) : (
              businessName
            )}
          </h2>

          <p className="text-xs sm:text-[13px] text-gray-700 font-medium mt-1">
            Add. : {address}
          </p>
          <p className="text-xs sm:text-[13px] text-gray-700 font-medium">
            GST No : {gstin}
          </p>

          {/* Contact with icons */}
          <div className="flex items-center gap-4 text-xs sm:text-[13px] text-gray-800 font-medium mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center p-0.5">
                <Phone className="w-2.5 h-2.5 fill-current" />
              </span>
              {phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center p-0.5">
                <Mail className="w-2.5 h-2.5 fill-current" />
              </span>
              {email}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. BILL TO & METADATA ROW ──────────────────────────────────────── */}
      <div className="mt-8 pt-2 flex flex-col sm:flex-row justify-between items-start gap-6">
        {/* Bill To */}
        <div className="max-w-[320px]">
          <p className="text-sm font-semibold text-gray-800">To</p>
          <h3 className="text-base sm:text-lg font-bold text-[#111827] uppercase mt-0.5">
            {clientName}
          </h3>
          <p className="text-xs sm:text-sm text-gray-700 mt-0.5 leading-relaxed">
            {clientAddress}
          </p>
          {clientGstin && (
            <p className="text-xs sm:text-sm text-gray-700 font-medium mt-0.5">
              GST No : {clientGstin}
            </p>
          )}
        </div>

        {/* Invoice Meta */}
        <div className="w-full sm:w-auto">
          <table className="text-sm border-separate border-spacing-y-1">
            <tbody>
              <tr>
                <td className="text-gray-800 font-medium pr-8">Invoice no :</td>
                <td className="text-right font-extrabold text-black text-base">{invoiceNumber}</td>
              </tr>
              <tr>
                <td className="text-gray-800 font-medium pr-8">Date :</td>
                <td className="text-right font-medium text-gray-900">{invoiceDateFormatted}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. ITEMS TABLE ─────────────────────────────────────────────────── */}
      <div className="mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-t border-b-2 border-black text-xs sm:text-sm">
              <th className="py-2.5 text-left font-extrabold text-black w-12">NO</th>
              <th className="py-2.5 text-left font-extrabold text-black">DESCRIPTION</th>
              <th className="py-2.5 text-center font-extrabold text-black w-16">QTY</th>
              <th className="py-2.5 text-right font-extrabold text-black w-24 sm:w-28">PRICE</th>
              <th className="py-2.5 text-right font-extrabold text-black w-24 sm:w-28">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const qty = Number(item.quantity) || 1;
              const price = Number(item.unit_price) || 0;
              const total = (Number((item as any).total) || (qty * price));
              const isLast = index === items.length - 1;

              return (
                <tr
                  key={index}
                  className={`text-xs sm:text-sm ${
                    !isLast ? 'border-b border-dotted border-gray-400' : ''
                  }`}
                >
                  <td className="py-3 text-left text-gray-800 font-normal">{index + 1}</td>
                  <td className="py-3 text-left">
                    <p className="font-normal text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="text-[11px] text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </td>
                  <td className="py-3 text-center text-gray-800 font-normal">{qty}</td>
                  <td className="py-3 text-right text-gray-800 font-normal">
                    {formatCurrency(price, currency)}
                  </td>
                  <td className="py-3 text-right text-gray-900 font-normal">
                    {formatCurrency(total, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Solid bottom rule */}
        <div className="border-b border-black w-full" />
      </div>

      {/* ── 4. SCAN TO PAY & TOTALS ────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-start gap-6">
        {/* Left: Scan to Pay */}
        <div className="flex flex-col items-start">
          <p className="text-xs sm:text-sm font-extrabold text-black tracking-wide uppercase mb-2">
            SCAN TO PAY
          </p>
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="Scan to pay"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain border border-gray-200 p-1 rounded-sm shadow-sm"
            />
          ) : (
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400 border border-gray-200">
              QR Code
            </div>
          )}
        </div>

        {/* Right: Totals block */}
        <div className="w-full sm:w-[320px] flex flex-col">
          <div className="space-y-1.5 text-xs sm:text-sm pr-1">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-gray-900">Sub Total</span>
              <span className="font-bold text-gray-900">{formatCurrency(subtotal, currency)}</span>
            </div>

            {taxPercent > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-gray-900">Tax {taxPercent}%</span>
                <span className="font-bold text-gray-900">{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-gray-900">Discount</span>
                <span className="font-bold text-gray-900">-{formatCurrency(discountAmount, currency)}</span>
              </div>
            )}
          </div>

          {/* GRAND TOTAL solid dark block */}
          <div className="mt-4 bg-[#4a4a4a] text-white flex justify-between items-center px-4 py-2.5 rounded-[2px] shadow-sm">
            <span className="text-xs sm:text-sm font-extrabold tracking-wider uppercase">
              GRAND TOTAL
            </span>
            <span className="text-sm sm:text-base font-extrabold">
              {formatCurrency(grandTotal, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 5. TERMS, WARRANTY & SIGNATURE ─────────────────────────────────── */}
      <div className="mt-8 pt-2 flex flex-col sm:flex-row justify-between items-start gap-8">
        {/* Left: Terms and Warranty */}
        <div className="flex-1 space-y-4 max-w-[450px]">
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-black">
              Term and Conditions :
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-700 mt-1 leading-relaxed">
              {termsText}
            </p>
          </div>

          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-black">
              Warranty and Disclaimers :
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-700 mt-1 leading-relaxed">
              {warrantyText}
            </p>
          </div>
        </div>

        {/* Right: Signature */}
        <div className="w-full sm:w-[220px] flex flex-col items-center sm:items-end justify-center text-center sm:text-right mt-2 sm:mt-0">
          {/* Cursive Signature */}
          <div
            className="text-2xl sm:text-3xl text-gray-700 italic select-none mb-1"
            style={{ fontFamily: "'Alex Brush', 'Dancing Script', cursive" }}
          >
            {DEFAULT_SIGNATURE_TEXT}
          </div>

          {/* Name & Title */}
          <p className="text-sm font-extrabold text-black">
            {DEFAULT_SIGNATORY_NAME}
          </p>
          <p className="text-xs sm:text-sm font-bold text-[#3b82f6]">
            {DEFAULT_SIGNATORY_ROLE}
          </p>
        </div>
      </div>

      {/* ── 6. FOOTER ──────────────────────────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-gray-400 flex flex-col sm:flex-row justify-between items-center gap-4">
        {/* Left: Product / Electronic icons */}
        <div className="flex items-center gap-3.5 text-black">
          {/* CCTV Camera Icon */}
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-2.09c2.83-.48 5-2.94 5-5.91s-2.17-5.43-5-5.91V2.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v2.09c-2.83.48-5 2.94-5 5.91s2.17 5.43 5 5.91v2.09l-3.5 3.5 1.41 1.41L12 16.91l2.09 2.09 1.41-1.41L12 14.09v2.41z"/>
            <path d="M4 10h11l3-4H7L4 10zm-2 2h4v7H2v-7zm16-1l4-2v6l-4-2v-2z"/>
          </svg>
          {/* Satellite Dish Icon */}
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <circle cx="6" cy="18" r="2" />
            <path d="M4 6V4a14 14 0 0 1 14 14h-2A12 12 0 0 0 4 6zm0 4v-2a10 10 0 0 1 10 10h-2A8 8 0 0 0 4 10zm7.07-4.93l1.41-1.41 5.66 5.66-1.41 1.41-5.66-5.66z" />
          </svg>
          {/* Audio Speaker Icon */}
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <rect x="5" y="2" width="14" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="7" r="2" />
            <circle cx="12" cy="15" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="15" r="1.5" />
          </svg>
          {/* TV / Monitor Icon */}
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
          </svg>
          {/* Wi-Fi Router Icon */}
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <rect x="3" y="14" width="18" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="7" cy="17" r="1" />
            <circle cx="11" cy="17" r="1" />
            <circle cx="15" cy="17" r="1" />
            <path d="M5 14V6M19 14V6M12 14V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Right: Thank You script */}
        <div
          className="text-xl sm:text-2xl font-bold text-[#3b82f6] tracking-wide select-none"
          style={{ fontFamily: "'Dancing Script', 'Alex Brush', cursive" }}
        >
          Thank You for your Purchase !
        </div>
      </div>
    </div>
  );
}
