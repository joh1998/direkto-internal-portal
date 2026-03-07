import { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { poiApi } from '../../../lib/poi-api';

/* ── Types ──────────────────────────────────────── */

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; id?: string; message: string }[];
}

interface POIImportExportProps {
  onImportComplete: () => void;
}

/* ── Helper ──────────────────────────────────────── */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Component ──────────────────────────────────── */

export function POIImportExport({ onImportComplete }: POIImportExportProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ filename: string; content: string; rowCount: number } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Export ───────────────────────────────────── */

  async function handleExport(format: 'csv' | 'json' = 'csv') {
    setExporting(true);
    try {
      const blob = await poiApi.exportPois({ format });
      const timestamp = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `pois_export_${timestamp}.${format}`);
      toast.success(`POIs exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const blob = await poiApi.downloadImportTemplate();
      triggerDownload(blob, 'poi_import_template.csv');
      toast.success('Template downloaded');
    } catch {
      toast.error('Template download failed');
    }
  }

  /* ── Import flow ──────────────────────────────── */

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large (max 5 MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      setCsvPreview({
        filename: file.name,
        content,
        rowCount: Math.max(0, lines.length - 1), // exclude header
      });
      setImportResult(null);
      setShowImportDialog(true);
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleImport() {
    if (!csvPreview) return;
    setImporting(true);
    try {
      const result = await poiApi.importPois(csvPreview.content);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) {
        onImportComplete(); // refresh POI list
      }
      toast.success(`Import: ${result.created} created, ${result.updated} updated`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function closeDialog() {
    setShowImportDialog(false);
    setCsvPreview(null);
    setImportResult(null);
  }

  /* ── Render ───────────────────────────────────── */

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={onFileChange}
        className="hidden"
      />

      {/* Action buttons row inside admin ops */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2" style={{ fontWeight: 600 }}>
          Import / Export
        </p>

        {/* Export */}
        <div className="flex gap-1.5">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex-1 flex items-center gap-2 px-3 py-2 text-[12px] bg-[var(--card)] border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors disabled:opacity-50"
            style={{ fontWeight: 500 }}
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-[12px] bg-[var(--card)] border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors disabled:opacity-50"
            style={{ fontWeight: 500 }}
          >
            <Download size={12} />
            <span>JSON</span>
          </button>
        </div>

        {/* Import */}
        <button
          onClick={handleFileSelect}
          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] bg-[var(--card)] border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Upload size={12} />
          <span className="flex-1 text-left">Import CSV</span>
        </button>

        {/* Template */}
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] bg-[var(--card)] border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors text-[var(--muted-foreground)]"
          style={{ fontWeight: 500 }}
        >
          <FileSpreadsheet size={12} />
          <span className="flex-1 text-left">Download Template</span>
        </button>
      </div>

      {/* ── Import Dialog (modal overlay) ─────────── */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Import POIs</h3>
              </div>
              <button
                onClick={closeDialog}
                className="p-1 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* File info */}
              {csvPreview && !importResult && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <FileSpreadsheet size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>
                      {csvPreview.filename}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      {csvPreview.rowCount} data row{csvPreview.rowCount !== 1 ? 's' : ''} detected
                    </p>
                  </div>
                </div>
              )}

              {/* Import in progress */}
              {importing && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                  <span className="text-[13px] text-[var(--muted-foreground)]">Importing POIs...</span>
                </div>
              )}

              {/* Import results */}
              {importResult && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Total', value: importResult.total, color: 'text-[var(--foreground)]' },
                      { label: 'Created', value: importResult.created, color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Updated', value: importResult.updated, color: 'text-blue-600 dark:text-blue-400' },
                      { label: 'Skipped', value: importResult.skipped, color: 'text-amber-600 dark:text-amber-400' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-2 bg-[var(--accent)] rounded-lg">
                        <p className={`text-[16px] ${stat.color}`} style={{ fontWeight: 700 }}>{stat.value}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase" style={{ fontWeight: 500 }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Success message */}
                  {importResult.errors.length === 0 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-[12px] text-emerald-700 dark:text-emerald-400" style={{ fontWeight: 500 }}>
                        All rows imported successfully
                      </p>
                    </div>
                  )}

                  {/* Errors list */}
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-red-500" />
                        <p className="text-[12px] text-red-600 dark:text-red-400" style={{ fontWeight: 600 }}>
                          {importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="max-h-[150px] overflow-y-auto space-y-1">
                        {importResult.errors.slice(0, 50).map((err, i) => (
                          <div key={i} className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 rounded text-[11px] text-red-700 dark:text-red-400">
                            {err.id ? <span style={{ fontWeight: 600 }}>ID: {err.id} — </span> : null}
                            {err.message}
                          </div>
                        ))}
                        {importResult.errors.length > 50 && (
                          <p className="text-[11px] text-[var(--muted-foreground)] px-3">
                            ...and {importResult.errors.length - 50} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--accent)]/30">
              {!importResult ? (
                <>
                  <button
                    onClick={closeDialog}
                    className="px-4 py-2 text-[12px] rounded-lg bg-[var(--accent)] text-[var(--foreground)] hover:bg-[var(--accent)]/80 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || !csvPreview}
                    className="flex items-center gap-2 px-4 py-2 text-[12px] rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Import {csvPreview?.rowCount ?? 0} POIs
                  </button>
                </>
              ) : (
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 text-[12px] rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
