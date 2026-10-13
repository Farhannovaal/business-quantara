import { Search } from "lucide-react";
import type { BillStatus, Tailor } from "@/lib/tailor-billing/types";

type Props = {
  search: string; statusFilter: BillStatus | "ALL"; tailorFilter: number | "ALL"; tailors: Tailor[];
  onSearchChange: (value: string) => void; onStatusChange: (value: BillStatus | "ALL") => void;
  onTailorChange: (value: number | "ALL") => void; onSearch: () => void;
};
export default function BillingFilters({ search, statusFilter, tailorFilter, tailors, onSearchChange, onStatusChange, onTailorChange, onSearch }: Props) {
  return <div className="mb-5 rounded-xl border border-white/10 bg-[#151313] p-4 shadow-lg shadow-black/20"><div className="grid gap-3 lg:grid-cols-[1fr_200px_240px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder="Cari nomor tagihan atau penjahit..." className="h-10 w-full rounded-lg border border-white/10 bg-[#151313] pl-10 pr-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-900/30" /></div>
  <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value as BillStatus | "ALL")} className="h-10 rounded-lg border border-white/10 bg-[#151313] px-3 text-sm text-neutral-200 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-900/30"><option value="ALL">Semua Status</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></select>
  <select value={tailorFilter} onChange={(event) => onTailorChange(event.target.value === "ALL" ? "ALL" : Number(event.target.value))} className="h-10 rounded-lg border border-white/10 bg-[#151313] px-3 text-sm text-neutral-200 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-900/30"><option value="ALL">Semua Penjahit</option>{tailors.map((tailor) => <option key={tailor.id} value={tailor.id}>{tailor.name}</option>)}</select>
  <button type="button" onClick={onSearch} className="h-10 rounded-lg bg-neutral-800 px-4 text-sm font-medium text-white transition hover:bg-neutral-700">Cari</button></div></div>;
}
