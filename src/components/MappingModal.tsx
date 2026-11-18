import React, { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import type { FoodBevType, MappingRules, Outlet } from '../types/pos';
import { ITEM_TYPES } from '../types/pos';
import {
  ASSIGNABLE_OUTLETS,
  OUTLET_INFO,
  isExcludedOutlet,
  createDefaultMappingRules,
  inferFoodBev,
  matchOutletName,
} from '../utils/defaultMappings';
import { formatInt } from '../utils/formatters';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  configNames: { name: string; outlet: Outlet; lines: number }[];
  rules: MappingRules;
  onSave: (next: MappingRules) => void;
}

export const MappingModal: React.FC<MappingModalProps> = ({
  isOpen,
  onClose,
  categories,
  configNames,
  rules,
  onSave,
}) => {
  const [draft, setDraft] = useState<MappingRules>(rules);

  if (!isOpen) return null;

  const setCatFoodBev = (cat: string, val: FoodBevType) => {
    setDraft((prev) => ({
      ...prev,
      categoryFoodBev: { ...prev.categoryFoodBev, [cat]: val },
    }));
  };

  const setCatOutlet = (cat: string, val: Outlet) => {
    setDraft((prev) => {
      const next = { ...prev.categoryOutlet };
      if (val === 'Unassigned') delete next[cat];
      else next[cat] = val;
      return { ...prev, categoryOutlet: next };
    });
  };

  const setConfigOutlet = (configName: string, val: Outlet | '') => {
    const key = configName.trim().toLowerCase();
    setDraft((prev) => {
      const next = { ...prev.configOutlet };
      if (val === '') delete next[key];
      else next[key] = val;
      return { ...prev, configOutlet: next };
    });
  };

  const outletOptions = ASSIGNABLE_OUTLETS.map((o) => (
    <option key={o} value={o}>
      {OUTLET_INFO[o].name}
      {isExcludedOutlet(o) ? ' — excluded from report' : ''}
    </option>
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Category &amp; Outlet Mapping Rules
            </h3>
            <p className="text-xs text-slate-500">
              Match each Odoo Point of Sale to its outlet, and customise Food vs. Beverage classification.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {configNames.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                POS Outlets found in your export
              </h4>
              <p className="text-[11px] text-slate-500">
                Each Odoo Point of Sale is matched to its own outlet. Change any that are wrong.
              </p>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-700">Odoo Point of Sale</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Lines</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Report as outlet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {configNames.map((c) => {
                    const key = c.name.trim().toLowerCase();
                    const override = draft.configOutlet[key];
                    const auto = matchOutletName(c.name);
                    return (
                      <tr key={c.name}>
                        <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {formatInt(c.lines)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`Outlet for ${c.name}`}
                            value={override ?? ''}
                            onChange={(e) => setConfigOutlet(c.name, e.target.value as Outlet | '')}
                            className={`rounded-lg border px-2 py-1 text-xs ${
                              !override && auto === 'Unassigned'
                                ? 'border-amber-300 bg-amber-50'
                                : 'border-slate-200'
                            }`}
                          >
                            <option value="">
                              Auto: {auto === 'Unassigned' ? 'not recognised' : OUTLET_INFO[auto].name}
                            </option>
                            {outletOptions}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Load a file first to configure category mappings.
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold text-slate-700">POS Category</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Sales type</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    Outlet Fallback (if not in CSV Config)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => {
                  const fb = draft.categoryFoodBev[cat] ?? inferFoodBev(cat, '', draft);
                  const outlet = draft.categoryOutlet[cat] ?? 'Unassigned';
                  return (
                    <tr key={cat}>
                      <td className="px-3 py-2 font-medium text-slate-800">{cat}</td>
                      <td className="px-3 py-2">
                        <select
                          value={fb}
                          onChange={(e) =>
                            setCatFoodBev(cat, e.target.value as FoodBevType)
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={outlet}
                          onChange={(e) => setCatOutlet(cat, e.target.value as Outlet)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="Unassigned">Auto / Unassigned</option>
                          {outletOptions}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => setDraft(createDefaultMappingRules())}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
            >
              Save &amp; Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
