/**
 * Column template shared by the table header and every row, so the columns line
 * up although each row is its own grid: status, change, effort, risk, receipt,
 * and from 1024 px a chevron. Status and chevron are fixed-size `auto` tracks.
 */
export const ROW_GRID =
  "grid grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:grid-cols-[auto_minmax(0,2fr)_minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] items-center gap-x-4 px-4";
