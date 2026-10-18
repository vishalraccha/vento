import { useState, useEffect } from 'react';
import { Quotation, QuotationItem, Business } from '@/types/database';
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

interface QuotationDocumentViewProps {
  quotation: Quotation & { items?: QuotationItem[] };
  business: Business | null;
  className?: string;
  initialQrCodeUrl?: string;
}

export function QuotationDocumentView({
  quotation,
  business,
  className = '',
  initialQrCodeUrl = '',
}: QuotationDocumentViewProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>(initialQrCodeUrl);

  const currency = business?.currency || 'INR';
  const businessName = (business?.business_name || 'MOHAN ELECTRONICS').toUpperCase();
  const address = business?.business_address
    ? `${business.business_address}${business.city ? `, ${business.city}` : ''}${business.pincode ? `, ${business.pincode}` : ''}`
    : '1024 ASHOCK CHOWK, SOLAPUR, 413006';
  const gstin = business?.gstin || '112VJH3242JHJ23';
  const phone = business?.phone_number || '9370426583';
  const email = business?.email || 'mohanelec@gmail.com';

  const clientName = quotation.client_name || 'KETUT SUSILO';
  const clientAddress = quotation.client_address || '123 Anywhere St., Any City, ST 12345';
  const clientGstin = quotation.client_gstin || '112VJH3242JHJ23';

  const quotationNumber = quotation.quotation_number || '12345';
  const quotationDateFormatted = quotation.quotation_date
    ? format(new Date(quotation.quotation_date), 'dd MMMM yyyy')
    : format(new Date(), 'dd MMMM yyyy');

  const validUntilFormatted = quotation.valid_until
    ? format(new Date(quotation.valid_until), 'dd MMMM yyyy')
    : null;

  const items = quotation.items && quotation.items.length > 0 ? quotation.items : [
    { name: 'Consultation', description: '', quantity: 1, unit_price: 300, total: 300 },
    { name: 'Project Draft', description: '', quantity: 1, unit_price: 2400, total: 2400 },
    { name: 'Implementation', description: '', quantity: 1, unit_price: 2500, total: 2500 },
    { name: 'Additional Supplies', description: '', quantity: 1, unit_price: 750, total: 750 },
    { name: 'Monthly meeting', description: '', quantity: 1, unit_price: 2000, total: 2000 },
  ];

  const subtotal = Number(quotation.subtotal) || items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_price)), 0);
  const taxAmount = Number(quotation.tax_amount) || 0;
  const discountAmount = Number(quotation.discount_amount) || 0;
  const grandTotal = Number(quotation.total_amount) || (subtotal + taxAmount - discountAmount);

  // Compute effective single tax percentage
  let taxPercent = 0;
  if (subtotal > 0 && taxAmount > 0) {
    taxPercent = Math.round((taxAmount / subtotal) * 100);
  } else if (quotation.items?.[0]?.tax_rate) {
    taxPercent = Number(quotation.items[0].tax_rate);
  } else if (business?.default_tax_rate && taxAmount > 0) {
    taxPercent = Number(business.default_tax_rate);
  }

  // Generate UPI QR Code
  useEffect(() => {
    if (initialQrCodeUrl) {
      setQrCodeUrl(initialQrCodeUrl);
      return;
    }
    const upiPayString = `upi://pay?pa=${phone}@upi&pn=${encodeURIComponent(businessName)}&am=${grandTotal}&cu=INR`;
    generatePaymentQRCode(upiPayString).then(url => setQrCodeUrl(url));
  }, [initialQrCodeUrl, phone, businessName, grandTotal]);

  const termsText = quotation.terms || business?.default_terms || DEFAULT_INVOICE_TERMS;
  const warrantyText = quotation.notes || business?.default_notes || DEFAULT_INVOICE_WARRANTY;

  return (
    <div
      className={`bg-white text-gray-900 shadow-xl rounded-sm p-6 sm:p-10 max-w-[800px] mx-auto border border-gray-200 print:shadow-none print:border-none print:p-0 ${className}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── 1. TOP HEADER ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        {/* Left: Logo & QUOTATION label */}
        <div className="flex flex-col items-start">
          {business?.logo_url ? (
            <div className="mb-3 max-h-20 max-w-[220px] flex items-center justify-start overflow-hidden">
              <img
                src={business.logo_url}
                alt={businessName}
                className="max-h-20 max-w-[200px] w-auto h-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="mb-3">
              <svg width="105" height="72" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M130 35 C130 10, 60 5, 20 40 C-5 65, 30 95, 75 92 C105 90, 135 65, 125 45"
                  stroke="#111827"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
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

          {/* 
            Charcoal accent bar + QUOTATION title:
            In reference image, title starts at the EXACT same left margin line as 'To', 'NO', and 'SCAN TO PAY'.
            The charcoal rectangle bleeds into the left padding gutter.
          */}
          <div className="flex items-center gap-2.5 mt-3">
            <div className="w-10 sm:w-14 h-7 sm:h-8 bg-[#4a4a4a] -ml-6 sm:-ml-10 shrink-0" />
            <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-[#111827] uppercase leading-none">
              QUOTATION
            </h1>
          </div>
        </div>

        {/* Right: Business Info */}
        <div className="text-right flex flex-col items-end shrink-0 ml-auto max-w-[380px]">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#374151] tracking-tight leading-tight uppercase text-right">
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

          <p className="text-xs sm:text-[13px] text-gray-700 font-medium mt-1 text-right">
            Add. : {address}
          </p>
          <p className="text-xs sm:text-[13px] text-gray-700 font-medium text-right">
            GST No : {gstin}
          </p>

          <div className="flex items-center justify-end gap-3 text-xs sm:text-[13px] text-gray-800 font-medium mt-1.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center p-0.5 shrink-0">
                <Phone className="w-2.5 h-2.5 fill-current" />
              </span>
              <span>{phone}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center p-0.5 shrink-0">
                <Mail className="w-2.5 h-2.5 fill-current" />
              </span>
              <span>{email}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. BILL TO & METADATA ROW ──────────────────────────────────────── */}
      <div className="mt-8 flex justify-between items-start gap-6">
        {/* Bill To */}
        <div className="max-w-[340px]">
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

        {/* Quotation Meta */}
        <div className="shrink-0 text-right">
          <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 items-center justify-end">
            <span className="text-sm font-medium text-gray-700 text-left">Quotation no :</span>
            <span className="text-base font-extrabold text-black text-right">{quotationNumber}</span>
            <span className="text-sm font-medium text-gray-700 text-left">Date :</span>
            <span className="text-sm font-semibold text-gray-900 text-right">{quotationDateFormatted}</span>
            {validUntilFormatted && (
              <>
                <span className="text-sm font-medium text-gray-700 text-left">Valid Until :</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{validUntilFormatted}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. ITEMS TABLE ─────────────────────────────────────────────────── */}
      <div className="mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-t border-b border-black text-xs sm:text-sm">
              <th className="py-2.5 text-left font-extrabold text-black w-12">NO</th>
              <th className="py-2.5 text-left font-extrabold text-black">DESCRIPTION</th>
              <th className="py-2.5 text-center font-extrabold text-black w-16">QTY</th>
              <th className="py-2.5 text-right font-extrabold text-black w-28">PRICE</th>
              <th className="py-2.5 text-right font-extrabold text-black w-28">TOTAL</th>
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
                    !isLast ? 'border-b border-dotted border-gray-300' : ''
                  }`}
                >
                  <td className="py-3 text-left font-medium text-gray-900">{index + 1}</td>
                  <td className="py-3 text-left font-medium text-gray-900">
                    <span className="font-semibold text-black">{item.name}</span>
                    {item.description && (
                      <span className="block text-xs text-gray-600 mt-0.5">{item.description}</span>
                    )}
                  </td>
                  <td className="py-3 text-center font-medium text-gray-900">{qty}</td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatCurrency(price, currency)}
                  </td>
                  <td className="py-3 text-right font-semibold text-black">
                    {formatCurrency(total, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Solid bottom border rule under table */}
        <div className="border-b border-black w-full" />
      </div>

      {/* ── 4. SCAN TO PAY & TOTALS ────────────────────────────────────────── */}
      <div className="mt-6 flex justify-between items-start gap-8">
        {/* Left: SCAN TO PAY */}
        <div className="flex flex-col items-start">
          <h4 className="text-sm font-extrabold text-black tracking-wide uppercase mb-2">
            SCAN TO PAY
          </h4>
          <div className="border border-gray-200 p-1 bg-white inline-block">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="Payment QR"
                className="w-28 h-28 object-contain"
              />
            ) : (
              <div className="w-28 h-28 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                Loading QR...
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary & GRAND TOTAL */}
        <div className="w-[280px] sm:w-[320px] flex flex-col shrink-0">
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center text-sm px-1">
              <span className="font-bold text-gray-900">Sub Total</span>
              <span className="font-bold text-gray-900">{formatCurrency(subtotal, currency)}</span>
            </div>

            {taxPercent > 0 && (
              <div className="flex justify-between items-center text-sm px-1">
                <span className="font-bold text-gray-900">Tax {taxPercent}%</span>
                <span className="font-bold text-gray-900">{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm px-1">
                <span className="font-bold text-gray-900">Discount</span>
                <span className="font-bold text-gray-900">-{formatCurrency(discountAmount, currency)}</span>
              </div>
            )}
          </div>

          {/* Solid dark charcoal GRAND TOTAL block */}
          <div className="bg-[#4a4a4a] text-white px-3 py-2.5 flex justify-between items-center">
            <span className="font-extrabold text-sm tracking-wider uppercase">GRAND TOTAL</span>
            <span className="font-extrabold text-base tracking-wide">{formatCurrency(grandTotal, currency)}</span>
          </div>
        </div>
      </div>

      {/* ── 5. TERMS, WARRANTY & SIGNATURE ─────────────────────────────────── */}
      <div className="mt-8 flex justify-between items-start gap-8">
        {/* Left: Terms & Warranty */}
        <div className="flex-1 space-y-4 max-w-[460px]">
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
        <div className="w-[220px] shrink-0 flex flex-col items-center justify-center text-center">
          <div
            className="text-2xl sm:text-3xl text-gray-700 italic select-none mb-1 whitespace-nowrap"
            style={{ fontFamily: "'Alex Brush', 'Dancing Script', cursive" }}
          >
            {DEFAULT_SIGNATURE_TEXT}
          </div>
          <p className="text-sm font-extrabold text-black whitespace-nowrap">
            {DEFAULT_SIGNATORY_NAME}
          </p>
          <p className="text-xs sm:text-sm font-bold text-[#2563eb] whitespace-nowrap">
            {DEFAULT_SIGNATORY_ROLE}
          </p>
        </div>
      </div>

      {/* ── 6. FOOTER ──────────────────────────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-gray-400 flex justify-between items-center gap-4">
        {/* Left: Product / Electronic icons */}
        <div className="flex items-center gap-4 text-black">
          {/* CCTV Camera Icon */}
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z" />
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
          className="text-xl sm:text-2xl text-[#2563eb] italic font-semibold select-none whitespace-nowrap"
          style={{ fontFamily: "'Alex Brush', 'Dancing Script', cursive" }}
        >
          Thank You for your Business !
        </div>
      </div>
    </div>
  );
}
