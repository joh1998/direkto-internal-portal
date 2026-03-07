// ── Documents Tab ────────────────────────────────────────────
import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, ExternalLink, Lock, Upload, Loader2, Trash2, Link2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { updateMerchant, type ApiMerchant } from '../../../lib/merchants-api';
import { DOC_LABELS } from '../helpers';

interface Props {
  merchant: ApiMerchant;
  canEdit: boolean;
  onUpdate: (merchant: ApiMerchant) => void;
}

const DOC_ORDER = [
  'business_permit',
  'mayors_permit',
  'dti_certificate',
  'sec_registration',
  'bir_certificate',
  'valid_id',
  'proof_of_address',
  'contract_document',
];

const REQUIRED_DOC_KEYS = [
  'business_permit',
  'mayors_permit',
  'dti_certificate',
  'sec_registration',
  'bir_certificate',
  'valid_id',
  'proof_of_address',
  'contract_document',
];

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>
      <Lock size={8} /> {label}
    </span>
  );
}

export function DocumentsTab({ merchant: m, canEdit, onUpdate }: Props) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  const baseDocuments = m.documents && typeof m.documents === 'object'
    ? (m.documents as Record<string, unknown>)
    : {};

  const docsFromPayload = m.documents && typeof m.documents === 'object'
    ? Object.entries(m.documents as Record<string, unknown>)
        .filter(([, url]) => typeof url === 'string' && url.trim().length > 0)
        .map(([key, url]) => [key, url as string] as const)
    : [];

  const docs = [
    ...docsFromPayload,
    ...(m.contractDocumentUrl ? ([['contract_document', m.contractDocumentUrl]] as const) : []),
  ].sort(([a], [b]) => {
    const ai = DOC_ORDER.indexOf(a);
    const bi = DOC_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const docMap = new Map(docs);

  async function uploadForKey(key: string, file: File) {
    try {
      setUploadingKey(key);
      const uploaded = await api.uploadFile(file, 'merchants');
      const nextDocuments = { ...baseDocuments, [key]: uploaded.url };
      const updated = await updateMerchant(m.id, { documents: nextDocuments as Record<string, string> });
      onUpdate(updated);
      toast.success(`${DOC_LABELS[key] || key.replace(/_/g, ' ')} uploaded`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  }

  async function removeDocument(key: string) {
    if (!(key in baseDocuments)) {
      toast.error('This document is not stored in merchant documents');
      return;
    }

    setSaving(true);
    try {
      const nextDocuments = { ...baseDocuments };
      delete nextDocuments[key];
      const updated = await updateMerchant(m.id, { documents: nextDocuments as Record<string, string> });
      onUpdate(updated);
      toast.success(`${DOC_LABELS[key] || key.replace(/_/g, ' ')} removed`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove document');
    } finally {
      setSaving(false);
    }
  }

  async function saveManualUrl() {
    const key = customKey.trim().toLowerCase().replace(/\s+/g, '_');
    const url = customUrl.trim();

    if (!key) {
      toast.error('Document key is required');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      toast.error('Use only lowercase letters, numbers, and underscores for key');
      return;
    }
    if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
      toast.error('Enter a valid URL (http/https)');
      return;
    }

    setSaving(true);
    try {
      const nextDocuments = { ...baseDocuments, [key]: url };
      const updated = await updateMerchant(m.id, { documents: nextDocuments as Record<string, string> });
      onUpdate(updated);
      setCustomKey('');
      setCustomUrl('');
      toast.success('Document URL saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save document URL');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
          <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            Upload Documents
          </p>
          <div className="space-y-2">
            {REQUIRED_DOC_KEYS.map((key) => {
              const url = docMap.get(key);
              const label = DOC_LABELS[key] || key.replace(/_/g, ' ');
              const isUploading = uploadingKey === key;
              return (
                <div key={key} className="flex items-center justify-between gap-3 p-2 rounded-md bg-[var(--accent)]/30 border border-[var(--border)]">
                  <div className="min-w-0">
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{label}</p>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--primary)] hover:underline truncate block">
                        {url}
                      </a>
                    ) : (
                      <p className="text-[10px] text-[var(--muted-foreground)]">Not uploaded</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {url && (
                      <button
                        onClick={() => removeDocument(key)}
                        disabled={saving}
                        className="px-2 py-1 text-[10px] rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        style={{ fontWeight: 500 }}
                      >
                        <Trash2 size={10} className="inline mr-1" />
                        Remove
                      </button>
                    )}
                    <label className="px-2 py-1 text-[10px] rounded border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] cursor-pointer disabled:opacity-50" style={{ fontWeight: 500 }}>
                      {isUploading ? (
                        <>
                          <Loader2 size={10} className="inline mr-1 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={10} className="inline mr-1" />
                          {url ? 'Replace' : 'Upload'}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadForKey(key, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[var(--border)] space-y-2">
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
              Manual URL entry
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2">
              <input
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="document_key"
                className="px-2.5 py-2 text-[12px] bg-[var(--input-background)] border border-[var(--border)] rounded-md outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://..."
                className="px-2.5 py-2 text-[12px] bg-[var(--input-background)] border border-[var(--border)] rounded-md outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
              <button
                onClick={saveManualUrl}
                disabled={saving}
                className="px-3 py-2 text-[12px] rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                <Link2 size={12} className="inline mr-1" />
                Save URL
              </button>
            </div>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={32} className="mx-auto text-[var(--muted-foreground)]/50 mb-3" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No documents uploaded</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            The merchant has not submitted any verification documents yet.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
              {docs.length} document{docs.length !== 1 ? 's' : ''} on file
            </p>
            {!canEdit && <RoleBadge label="View only" />}
          </div>
          {docs.map(([key, url]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-[var(--accent)]/50 rounded-lg border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                    {DOC_LABELS[key] || key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono truncate max-w-[200px]">{url}</p>
                </div>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
                View <ExternalLink size={10} />
              </a>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
