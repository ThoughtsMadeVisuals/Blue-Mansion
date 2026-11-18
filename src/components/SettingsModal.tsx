import React, { useMemo, useState } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { defaultOutletForPos } from '../lib/classify';
import { DEFAULT_HOLIDAYS } from '../lib/holidays';
import { longDate, rmCompact, shortCategory } from '../lib/format';
import type { FoodBev, Holiday, Settings } from '../types';
import { Segmented, SmallButton } from './ui';

export const SettingsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (s: Settings) => void;
  posList: string[];
  categories: { category: string; auto: FoodBev; sales: number }[];
}> = ({ open, onClose, settings, onSave, posList, categories }) => {
  const [tab, setTab] = useState<'outlets' | 'fb' | 'holidays'>('outlets');
  const [draft, setDraft] = useState<Settings>(settings);
  const [catQ, setCatQ] = useState('');
  const [newH, setNewH] = useState<Holiday>({ date: '', name: '', kind: 'holiday' });

  React.useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const cats = useMemo(() => {
    const q = catQ.toLowerCase();
    return categories.filter((c) => !q || c.category.toLowerCase().includes(q));
  }, [categories, catQ]);

  if (!open) return null;

  const holidays = draft.holidays.slice().sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Settings"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-slate-100 px-5 py-2">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'outlets', label: 'Outlets' },
              { value: 'fb', label: 'Food / Beverage' },
              { value: 'holidays', label: 'Holidays' },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-xs">
          {tab === 'outlets' && (
            <div className="space-y-2">
              <p className="text-slate-500">
                Each Odoo Point of Sale belongs to an outlet. Points of sale with the same outlet name are added together.
                Type a different name to regroup them.
              </p>
              {posList.map((p) => (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-72 truncate font-medium text-slate-700" title={p}>{p}</span>
                  <span className="text-slate-400">→</span>
                  <input
                    value={draft.posOutlet[p] ?? defaultOutletForPos(p)}
                    onChange={(e) => setDraft({ ...draft, posOutlet: { ...draft.posOutlet, [p]: e.target.value } })}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5"
                  />
                </div>
              ))}
              <SmallButton onClick={() => setDraft({ ...draft, posOutlet: {} })}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset to default grouping
              </SmallButton>
            </div>
          )}

          {tab === 'fb' && (
            <div className="space-y-2">
              <p className="text-slate-500">
                The type is decided automatically from Odoo's Product Category, then the POS category, then the item
                name. Override it for any category here.
              </p>
              <input
                value={catQ}
                onChange={(e) => setCatQ(e.target.value)}
                placeholder="Find category…"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5"
              />
              <div className="divide-y divide-slate-100">
                {cats.map((c) => {
                  const ov = draft.categoryFoodBev[c.category];
                  return (
                    <div key={c.category} className="flex items-center gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-700" title={c.category}>{shortCategory(c.category, 60)}</div>
                        <div className="text-[11px] text-slate-400">{rmCompact(c.sales)} · auto: {c.auto}</div>
                      </div>
                      <select
                        value={ov ?? ''}
                        onChange={(e) => {
                          const next = { ...draft.categoryFoodBev };
                          if (e.target.value) next[c.category] = e.target.value as FoodBev;
                          else delete next[c.category];
                          setDraft({ ...draft, categoryFoodBev: next });
                        }}
                        className={`rounded-lg border px-2 py-1 ${ov ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}
                      >
                        <option value="">Auto ({c.auto})</option>
                        <option value="Food">Food</option>
                        <option value="Beverage">Beverage</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'holidays' && (
            <div className="space-y-3">
              <p className="text-slate-500">
                Holidays and festive days are marked on the daily charts and compared with normal days. Islamic holiday
                dates depend on moon sighting, so please check them.
              </p>
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
                <input type="date" value={newH.date} onChange={(e) => setNewH({ ...newH, date: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5" aria-label="Holiday date" />
                <input value={newH.name} onChange={(e) => setNewH({ ...newH, name: e.target.value })} placeholder="Name (e.g. Mid-Autumn Festival)" className="min-w-48 flex-1 rounded-lg border border-slate-200 px-2 py-1.5" />
                <select value={newH.kind} onChange={(e) => setNewH({ ...newH, kind: e.target.value as Holiday['kind'] })} className="rounded-lg border border-slate-200 px-2 py-1.5" aria-label="Type">
                  <option value="holiday">Public holiday</option>
                  <option value="festive">Festive / special day</option>
                </select>
                <SmallButton
                  disabled={!newH.date || !newH.name.trim()}
                  onClick={() => {
                    setDraft({ ...draft, holidays: [...draft.holidays.filter((h) => h.date !== newH.date), { ...newH, name: newH.name.trim() }] });
                    setNewH({ date: '', name: '', kind: 'holiday' });
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </SmallButton>
              </div>
              <div className="divide-y divide-slate-100">
                {holidays.map((h) => (
                  <div key={h.date} className="flex items-center gap-3 py-1.5">
                    <span className="w-40 text-slate-500">{longDate(h.date)}</span>
                    <span className="flex-1 font-medium text-slate-700">{h.name}</span>
                    <span className="text-[11px] text-slate-400">{h.kind === 'festive' ? 'Festive' : 'Public holiday'}</span>
                    <button type="button" aria-label={`Remove ${h.name}`} onClick={() => setDraft({ ...draft, holidays: draft.holidays.filter((x) => x.date !== h.date) })} className="cursor-pointer text-slate-400 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <SmallButton onClick={() => setDraft({ ...draft, holidays: DEFAULT_HOLIDAYS })}>
                <RotateCcw className="h-3.5 w-3.5" /> Restore default holidays
              </SmallButton>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
