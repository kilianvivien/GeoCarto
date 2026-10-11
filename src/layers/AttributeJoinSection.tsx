import { useMemo, useRef, useState } from 'react';
import { TableProperties } from 'lucide-react';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { CsvParseError, parseCsv, type CsvTable } from '@/import/csv';
import { countMatches, joinAttributes, suggestJoinKeys } from '@/layers/attributeJoin';
import { listAllAttributes } from '@/style/classify';
import { useDocumentStore } from '@/state/documentStore';
import { hintDiscreteHistoryLabel } from '@/state/historyStore';
import { useNotices } from '@/ui/notices';
import { useLocale } from '@/i18n/useLocale';

const JOIN_SIZE_LIMIT_MB = 20;

const selectClass =
  'min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]';
const buttonClass =
  'flex items-center justify-center gap-1.5 rounded-[7px] border border-[var(--divider)] px-2.5 py-1.5 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-2.5';

interface PendingJoin {
  fileName: string;
  table: CsvTable;
  layerField: string;
  tableColumn: string;
  columns: string[];
}

/**
 * "Join data" — attach the columns of a CSV to a layer's features through a
 * shared key (a country code, an INSEE number…), so a plain boundary file can
 * be styled by data that lives in a spreadsheet.
 */
export function AttributeJoinSection({ layer }: { layer: GeoJsonLayer }) {
  const t = useLocale((s) => s.t);
  const commitLayerFeatures = useDocumentStore((s) => s.commitLayerFeatures);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingJoin | null>(null);

  const layerFields = useMemo(() => listAllAttributes(layer.data.features), [layer.data.features]);
  const matches = useMemo(
    () =>
      pending ? countMatches(layer.data.features, pending.table, pending.layerField, pending.tableColumn) : 0,
    [layer.data.features, pending],
  );

  const openFile = async (file: File) => {
    const push = useNotices.getState().push;
    if (file.size > JOIN_SIZE_LIMIT_MB * 1024 * 1024) {
      push(t('join.tooLarge', { file: file.name, limit: JOIN_SIZE_LIMIT_MB }), 'error');
      return;
    }
    try {
      const table = parseCsv(await file.text());
      const keys = suggestJoinKeys(layer.data.features, layerFields, table);
      const tableColumn = keys?.tableColumn ?? table.columns[0];
      setPending({
        fileName: file.name,
        table,
        layerField: keys?.layerField ?? layerFields[0] ?? '',
        tableColumn,
        columns: table.columns.filter((column) => column !== tableColumn),
      });
    } catch (error) {
      if (!(error instanceof CsvParseError)) throw error;
      push(t('join.unreadable', { file: file.name }), 'error');
    }
  };

  const apply = () => {
    if (!pending) return;
    const result = joinAttributes(layer.data, pending.table, pending);
    hintDiscreteHistoryLabel('Join data');
    commitLayerFeatures(layer.id, result.data);
    useNotices
      .getState()
      .push(t('join.done', { columns: pending.columns.length, matched: result.matched, total: layer.featureCount }));
    setPending(null);
  };

  const toggleColumn = (column: string) =>
    setPending(
      (current) =>
        current && {
          ...current,
          columns: current.columns.includes(column)
            ? current.columns.filter((c) => c !== column)
            : [...current.columns, column],
        },
    );

  const disabled = layer.locked || layerFields.length === 0;

  return (
    <div className={`flex flex-col gap-2 ${layer.locked ? 'opacity-65' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
        {t('join.title')}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
        className="hidden"
        aria-label={t('join.chooseFile')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same (edited) file again still fires `change`.
          event.target.value = '';
          if (file) void openFile(file);
        }}
      />
      {!pending ? (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={`${buttonClass} self-start bg-[var(--glass-thin)] text-[var(--text-2)] hover:text-[var(--text)]`}
          >
            <TableProperties size={13} />
            {t('join.chooseFile')}
          </button>
          <div className="text-[11px] leading-snug text-[var(--text-3)]">
            {layerFields.length === 0 ? t('join.noFields') : t('join.hint')}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-[9px] border border-[var(--divider)] bg-[var(--glass-thin)] p-2">
          <div className="mono truncate text-[11.5px] text-[var(--text)]" title={pending.fileName}>
            {pending.fileName}
          </div>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('join.layerField')}
            <select
              value={pending.layerField}
              onChange={(event) => setPending({ ...pending, layerField: event.target.value })}
              className={selectClass}
            >
              {layerFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('join.tableColumn')}
            <select
              value={pending.tableColumn}
              onChange={(event) =>
                setPending({
                  ...pending,
                  tableColumn: event.target.value,
                  columns: pending.table.columns.filter((column) => column !== event.target.value),
                })
              }
              className={selectClass}
            >
              {pending.table.columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          <div
            role="status"
            className={`text-[11.5px] ${matches === 0 ? 'text-[#ff453a]' : 'text-[var(--text-2)]'}`}
          >
            {t('join.matchCount', { matched: matches, total: layer.featureCount })}
          </div>
          <fieldset className="flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-[7px] border border-[var(--divider)] p-1.5">
            <legend className="px-1 text-[10.5px] text-[var(--text-3)]">{t('join.columns')}</legend>
            {pending.table.columns
              .filter((column) => column !== pending.tableColumn)
              .map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 py-0.5 text-[11.5px] text-[var(--text-2)] pointer-coarse:py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={pending.columns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="truncate">{column}</span>
                </label>
              ))}
          </fieldset>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className={`${buttonClass} flex-1 bg-transparent text-[var(--text-2)] hover:text-[var(--text)]`}
            >
              {t('join.cancel')}
            </button>
            <button
              type="button"
              disabled={matches === 0 || pending.columns.length === 0}
              onClick={apply}
              className={`${buttonClass} flex-1 border-transparent bg-[var(--accent)] font-medium text-white`}
            >
              {t('join.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
