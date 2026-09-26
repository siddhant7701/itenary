// Responsive data table: sticky-header table on desktop, card list on phones.
import { cx } from '../../components/ui';

/**
 * columns: [{ key, header, render?(row), className?, headClassName?, align?: 'right'|'center',
 *             mobile?: false | 'title' , stop?: boolean (cell clicks don't trigger the row) }]
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  rowKey = 'id',
  onRowClick,
  empty,
  renderCard,
  rowClassName,
  skeletonRows = 8,
  sticky = true,
  className,
  dense = false,
}) {
  const cellValue = (c, row) => (c.render ? c.render(row) : row[c.key] ?? <span className="text-muted">—</span>);
  const align = (c) => (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left');
  const initial = loading && !rows;
  const list = rows || [];
  const isEmpty = !initial && list.length === 0;

  const keyOf = (row, i) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]) ?? i;
  const onKey = (e, row) => {
    if (!onRowClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  };

  if (isEmpty && empty) return <div className={className}>{empty}</div>;

  const titleCol = columns.find((c) => c.mobile === 'title') || columns[0];
  const metaCols = columns.filter((c) => c !== titleCol && c.mobile !== false);

  return (
    <div className={cx('relative', className)}>
      {/* Desktop / tablet */}
      <div className="card hidden overflow-hidden md:block">
        <div className={cx('scrollbar-thin overflow-auto', sticky && 'max-h-[calc(100dvh-15rem)] min-h-[12rem]')}>
          <table className="w-full border-separate border-spacing-0 text-left text-[13.5px]">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cx(
                      'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-[#fbf8f4]/95 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted backdrop-blur',
                      align(c),
                      c.headClassName,
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cx('transition-opacity', loading && rows && 'opacity-60')}>
              {initial &&
                Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c, j) => (
                      <td key={c.key} className="border-b border-line/60 px-4 py-3.5">
                        <div className={cx('skeleton h-4', j === 0 ? 'w-40' : 'w-16', c.align === 'right' && 'ml-auto')} />
                      </td>
                    ))}
                  </tr>
                ))}
              {list.map((row, i) => (
                <tr
                  key={keyOf(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={(e) => onKey(e, row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cx('group transition-colors', onRowClick && 'cursor-pointer hover:bg-plum-50/50 focus-visible:bg-plum-50/60 focus-visible:outline-none', rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      onClick={c.stop ? (e) => e.stopPropagation() : undefined}
                      className={cx('border-b border-line/60 px-4 align-middle', dense ? 'py-2' : 'py-3', align(c), c.className)}
                    >
                      {cellValue(c, row)}
                    </td>
                  ))}
                </tr>
              ))}
              {isEmpty && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-muted">
                    Nothing to show here yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phones */}
      <div className={cx('space-y-2.5 md:hidden', loading && rows && 'opacity-60')}>
        {initial && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        {isEmpty && <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-10 text-center text-sm text-muted">Nothing to show here yet.</p>}
        {list.map((row, i) =>
          renderCard ? (
            <div key={keyOf(row, i)}>{renderCard(row)}</div>
          ) : (
            <div
              key={keyOf(row, i)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={(e) => onKey(e, row)}
              className={cx('card p-4', onRowClick && 'cursor-pointer active:scale-[0.99] transition', rowClassName?.(row))}
            >
              <div className="min-w-0 text-[14px]">{cellValue(titleCol, row)}</div>
              {metaCols.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line/70 pt-3">
                  {metaCols.map((c) => (
                    <div key={c.key} className={cx('min-w-0', c.wide && 'col-span-2')} onClick={c.stop ? (e) => e.stopPropagation() : undefined}>
                      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{c.header}</dt>
                      <dd className="mt-0.5 min-w-0 text-[13px] text-ink">{cellValue(c, row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
