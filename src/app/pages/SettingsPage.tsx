import { useState } from 'react';
import { toast } from 'sonner';
import { Save, History, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { appSettings } from '../lib/mock-data';

const CHANGE_HISTORY = [
  { key: 'defaultCommissionRate', oldValue: '15', newValue: '12', by: 'Alex Rivera', time: '2 weeks ago' },
  { key: 'maxCancellationRate', oldValue: '10', newValue: '15', by: 'Jordan Lee', time: '1 month ago' },
  { key: 'supportEmail', oldValue: 'help@direkto.com', newValue: 'support@direkto.com', by: 'Alex Rivera', time: '2 months ago' },
];

export function SettingsPage() {
  const [settings, setSettings] = useState(appSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDangerous, setConfirmDangerous] = useState<{ key: string; label: string; value: boolean } | null>(null);

  function update(key: string, value: any) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  function handleDangerousToggle(key: string, label: string, current: boolean) {
    setConfirmDangerous({ key, label, value: !current });
  }

  function confirmDangerousChange() {
    if (!confirmDangerous) return;
    update(confirmDangerous.key, confirmDangerous.value);
    toast.success(`${confirmDangerous.label} ${confirmDangerous.value ? 'enabled' : 'disabled'}`);
    setConfirmDangerous(null);
  }

  function save() {
    toast.success('Settings saved successfully');
    setHasChanges(false);
  }

  return (
    <div className="p-6 max-w-[700px]">
      <PageHeader
        title="Settings"
        description="Platform configuration"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg border transition-colors ${
                showHistory
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
                  : 'bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]'
              }`}
              style={{ fontWeight: 500 }}
            >
              <History size={14} aria-hidden="true" />
              History
            </button>
            {hasChanges && (
              <button
                onClick={save}
                className="flex items-center gap-2 px-4 py-2 text-[13px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90"
                style={{ fontWeight: 500 }}
              >
                <Save size={14} aria-hidden="true" />
                Save Changes
              </button>
            )}
          </div>
        }
      />

      {/* Change History */}
      {showHistory && (
        <div className="mb-6 bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Change History</p>
          </div>
          {CHANGE_HISTORY.map((entry, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] mt-2 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-[13px] text-[var(--foreground)]">
                  <span className="font-mono text-[12px]">{entry.key}</span> changed from{' '}
                  <span className="text-red-500 line-through">{entry.oldValue}</span> to{' '}
                  <span className="text-emerald-600">{entry.newValue}</span>
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  {entry.by} &middot; {entry.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {/* General */}
        <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>General</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="platformName" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Platform Name</label>
              <input
                id="platformName"
                value={settings.platformName}
                onChange={e => update('platformName', e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              />
            </div>
            <div>
              <label htmlFor="supportEmail" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Support Email</label>
              <input
                id="supportEmail"
                value={settings.supportEmail}
                onChange={e => update('supportEmail', e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="timezone" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Timezone</label>
                <select
                  id="timezone"
                  value={settings.timezone}
                  onChange={e => update('timezone', e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
                >
                  <option value="Asia/Manila">Asia/Manila (UTC+8)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label htmlFor="currency" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Currency</label>
                <select
                  id="currency"
                  value={settings.currency}
                  onChange={e => update('currency', e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
                >
                  <option value="PHP">PHP (Philippine Peso)</option>
                  <option value="USD">USD (US Dollar)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Commission */}
        <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Commission</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="commissionRate" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Default Commission Rate (%)</label>
              <input
                id="commissionRate"
                type="number"
                value={settings.defaultCommissionRate}
                onChange={e => update('defaultCommissionRate', Number(e.target.value))}
                className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              />
            </div>
            <div>
              <label htmlFor="cancellationRate" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                Max Cancellation Rate Threshold (%)
              </label>
              <input
                id="cancellationRate"
                type="number"
                value={settings.maxCancellationRate}
                onChange={e => update('maxCancellationRate', Number(e.target.value))}
                className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              />
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                Alert threshold — triggers a notification when exceeded
              </p>
            </div>
          </div>
        </section>

        {/* Toggles (dangerous settings) */}
        <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Automation</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>Auto-approve merchants</p>
                <p className="text-[12px] text-[var(--muted-foreground)]">Automatically approve merchants that pass verification checks</p>
              </div>
              <button
                onClick={() => update('autoApprovalEnabled', !settings.autoApprovalEnabled)}
                className={`relative w-[44px] h-[24px] rounded-full transition-colors shrink-0 ${
                  settings.autoApprovalEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--switch-background)]'
                }`}
                role="switch"
                aria-checked={settings.autoApprovalEnabled}
                aria-label="Auto-approve merchants"
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white rounded-full shadow transition-transform ${
                    settings.autoApprovalEnabled ? 'translate-x-[20px]' : ''
                  }`}
                />
              </button>
            </div>

            {/* Dangerous: Maintenance Mode */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>Maintenance mode</p>
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Temporarily disable public access to the platform</p>
              </div>
              <button
                onClick={() => handleDangerousToggle('maintenanceMode', 'Maintenance mode', settings.maintenanceMode)}
                className={`relative w-[44px] h-[24px] rounded-full transition-colors shrink-0 ${
                  settings.maintenanceMode ? 'bg-amber-500' : 'bg-[var(--switch-background)]'
                }`}
                role="switch"
                aria-checked={settings.maintenanceMode}
                aria-label="Maintenance mode"
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white rounded-full shadow transition-transform ${
                    settings.maintenanceMode ? 'translate-x-[20px]' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={!!confirmDangerous}
        onClose={() => setConfirmDangerous(null)}
        onConfirm={confirmDangerousChange}
        title={`${confirmDangerous?.value ? 'Enable' : 'Disable'} ${confirmDangerous?.label || ''}`}
        message={
          confirmDangerous?.key === 'maintenanceMode'
            ? confirmDangerous.value
              ? 'Enabling maintenance mode will prevent all public users from accessing the platform. Only admins can access the system.'
              : 'Disabling maintenance mode will restore public access to the platform.'
            : `Are you sure you want to change this setting?`
        }
        confirmLabel={confirmDangerous?.value ? 'Enable' : 'Disable'}
        variant="danger"
      />
    </div>
  );
}