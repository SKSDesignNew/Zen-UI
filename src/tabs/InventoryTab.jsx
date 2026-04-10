import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileCode, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SCALE_DOMS, SCALE_DOM_COLORS, genScaleRules } from '@/lib/scale-data';
import { CRIT_COLORS } from '@/lib/rules';
import { cn } from '@/lib/utils';

const PER_PAGE = 50;

export function InventoryTab() {
  const allRef = useRef(null);
  if (!allRef.current) allRef.current = genScaleRules();

  const [domFilter, setDomFilter] = useState('All');
  const [critFilter, setCritFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState(1);

  const filtered = useMemo(() => {
    let r = allRef.current;
    if (domFilter !== 'All') r = r.filter((x) => x.dom === domFilter);
    if (critFilter !== 'All') r = r.filter((x) => x.crit === critFilter);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((x) =>
        x.id.toLowerCase().includes(s) ||
        x.name.toLowerCase().includes(s) ||
        x.file.toLowerCase().includes(s)
      );
    }
    if (sortCol === 'id') r = [...r].sort((a, b) => sortDir * a.id.localeCompare(b.id));
    else if (sortCol === 'name') r = [...r].sort((a, b) => sortDir * a.name.localeCompare(b.name));
    else if (sortCol === 'dom') r = [...r].sort((a, b) => sortDir * a.dom.localeCompare(b.dom));
    else if (sortCol === 'crit') {
      const co = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      r = [...r].sort((a, b) => sortDir * (co[a.crit] - co[b.crit]));
    }
    return r;
  }, [domFilter, critFilter, search, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageData = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const domCounts = useMemo(
    () => SCALE_DOMS.reduce((a, d) => ({ ...a, [d]: allRef.current.filter((r) => r.dom === d).length }), {}),
    []
  );
  const critCounts = useMemo(
    () => ({
      HIGH: allRef.current.filter((r) => r.crit === 'HIGH').length,
      MEDIUM: allRef.current.filter((r) => r.crit === 'MEDIUM').length,
      LOW: allRef.current.filter((r) => r.crit === 'LOW').length,
    }),
    []
  );

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(-sortDir);
    else { setSortCol(col); setSortDir(1); }
    setPage(0);
  };

  useEffect(() => setPage(0), [domFilter, critFilter, search]);

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <h3 className="font-serif text-2xl font-bold tracking-tight">Governed Rules Repository</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            100,000 atomic rules extracted across 10 domains from 9M+ lines of TAL
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { n: '100K', l: 'Total Rules', c: 'text-accent' },
            { n: critCounts.HIGH.toLocaleString(), l: 'High Critical', c: 'text-destructive' },
            { n: '10', l: 'Domains', c: 'text-info' },
            { n: '50', l: 'TAL Files', c: 'text-success' },
          ].map((s) => (
            <Card key={s.l}>
              <CardContent className="min-w-[80px] px-4 py-3 text-center">
                <div className={cn('font-serif text-lg font-bold', s.c)}>{s.n}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Domain distribution */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Rule Distribution by Domain
          </div>
          <div className="mb-3 flex h-7 overflow-hidden rounded-md">
            {SCALE_DOMS.map((d) => {
              const pct = (domCounts[d] / 100000) * 100;
              return (
                <div
                  key={d}
                  className="relative cursor-pointer transition-opacity hover:opacity-80"
                  style={{ width: `${pct}%`, background: SCALE_DOM_COLORS[d] }}
                  onClick={() => setDomFilter(domFilter === d ? 'All' : d)}
                  title={`${d}: ${domCounts[d].toLocaleString()}`}
                >
                  {pct > 6 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                      {Math.round(pct)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {SCALE_DOMS.map((d) => (
              <button
                key={d}
                onClick={() => setDomFilter(domFilter === d ? 'All' : d)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors',
                  domFilter === d ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
                style={domFilter === d ? { background: SCALE_DOM_COLORS[d] } : {}}
              >
                <span className="h-1.5 w-1.5 rounded-sm" style={{ background: SCALE_DOM_COLORS[d] }} />
                {d} <span className="font-bold">{domCounts[d].toLocaleString()}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rules by ID, name, or file…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select value={domFilter} onChange={(e) => setDomFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 text-xs"
        >
          <option value="All">All Domains</option>
          {SCALE_DOMS.map((d) => (
            <option key={d} value={d}>{d} ({domCounts[d].toLocaleString()})</option>
          ))}
        </select>
        <select value={critFilter} onChange={(e) => setCritFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 text-xs"
        >
          <option value="All">All Criticality</option>
          <option value="HIGH">HIGH ({critCounts.HIGH.toLocaleString()})</option>
          <option value="MEDIUM">MEDIUM ({critCounts.MEDIUM.toLocaleString()})</option>
          <option value="LOW">LOW ({critCounts.LOW.toLocaleString()})</option>
        </select>
        <div className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {filtered.length.toLocaleString()} rules
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {[
                { k: 'id', l: 'Rule ID', w: '10%' },
                { k: 'name', l: 'Rule Name', w: '26%' },
                { k: 'dom', l: 'Domain', w: '14%' },
                { k: 'crit', l: 'Criticality', w: '10%' },
                { k: 'file', l: 'Source File', w: '18%' },
                { k: 'lines', l: 'Lines', w: '12%' },
                { k: 'type', l: 'Type', w: '10%' },
              ].map((h) => {
                const sortable = ['id', 'name', 'dom', 'crit'].includes(h.k);
                return (
                  <th
                    key={h.k}
                    onClick={() => sortable && toggleSort(h.k)}
                    className={cn(
                      'border-b-2 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground',
                      sortable && 'cursor-pointer select-none hover:text-foreground'
                    )}
                    style={{ width: h.w }}
                  >
                    {h.l}
                    {sortable && <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.3) }}
                className="border-b transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-2 font-mono text-[11px] font-bold text-accent">{r.id}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: SCALE_DOM_COLORS[r.dom] + '22', color: SCALE_DOM_COLORS[r.dom] }}
                  >
                    {r.dom}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold" style={{ color: CRIT_COLORS[r.crit] }}>
                    ● {r.crit}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.file}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.lines}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.type === 'code' ? (
                    <FileCode className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {(page * PER_PAGE + 1).toLocaleString()}–
          {Math.min((page + 1) * PER_PAGE, filtered.length).toLocaleString()} of{' '}
          {filtered.length.toLocaleString()}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(0)} disabled={page === 0}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const p = page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
            if (p < 0 || p >= totalPages) return null;
            return (
              <Button
                key={p}
                variant={p === page ? 'accent' : 'outline'}
                size="sm"
                onClick={() => setPage(p)}
                className="min-w-[34px]"
              >
                {p + 1}
              </Button>
            );
          })}
          <Button variant="outline" size="icon"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
