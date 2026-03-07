// ── Shared helpers for Merchant pages ────────────────────────
import type { ApiMerchant } from '../../lib/merchants-api';

export function getMerchantStatus(m: ApiMerchant): string {
  if (m.verificationStatus === 'PENDING') return 'pending';
  if (m.verificationStatus === 'REJECTED') return 'rejected';
  if (!m.isActive) return 'suspended';
  return 'active';
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function peso(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!n || n === 0) return '₱0';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const DOC_LABELS: Record<string, string> = {
  business_permit: 'Business Permit',
  business_permit_url: 'Business Permit',
  valid_id: 'Valid ID',
  valid_id_url: 'Valid ID',
  dti_certificate: 'DTI Certificate',
  dti_certificate_url: 'DTI Certificate',
  sec_registration: 'SEC Registration',
  sec_registration_url: 'SEC Registration',
  bir_certificate: 'BIR Certificate',
  bir_certificate_url: 'BIR Certificate',
  mayors_permit: "Mayor's Permit",
  mayors_permit_url: "Mayor's Permit",
  proof_of_address: 'Proof of Address',
  proof_of_address_url: 'Proof of Address',
  contract_document: 'Contract Document',
  contract_document_url: 'Contract Document',
};
