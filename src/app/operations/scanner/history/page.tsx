"use client";



import {



  ArrowLeft,



  ChevronLeft,



  ChevronRight,



  History,



  Loader2,



  Search,



} from "lucide-react";



import { useEffect, useState } from "react";



type ScannerHistoryItem = {



  id: number;



  documentNumber: string;



  documentType: string | null;



  source: string;



  status: string;



  validationMessage: string | null;



  transactionId: number | null;



  scannedByUserId: number | null;



  scannedAt: string;



  processedAt: string | null;



  transaction: {



    id: number;



    transactionNumber: string;



    quantity: number;



    transactionType: {



      id: number;



      code: string;



      name: string;



    };



    spk: {



      id: number;



      spkNumber: string;



    };



  } | null;



  scannedBy: {



    id: number;



    name: string;



    email: string;



  } | null;



};



type HistoryResponse = {



  success: boolean;



  error?: string;



  data?: ScannerHistoryItem[];



  pagination?: {



    page: number;



    limit: number;



    total: number;



    totalPages: number;



  };



};



const STATUS_OPTIONS = [



  {



    value: "",



    label: "Semua Status",



  },



  {



    value: "PENDING",



    label: "Pending",



  },



  {



    value: "VALID",



    label: "Valid",



  },



  {



    value: "INVALID",



    label: "Invalid",



  },



  {



    value: "PROCESSED",



    label: "Processed",



  },



  {



    value: "DUPLICATE",



    label: "Duplicate",



  },



  {



    value: "REVIEW_REQUIRED",



    label: "Review Required",



  },



];



const SOURCE_OPTIONS = [



  {



    value: "",



    label: "Semua Source",



  },



  {



    value: "MANUAL",



    label: "Manual",



  },



  {



    value: "QR",



    label: "QR",



  },



  {



    value: "BARCODE",



    label: "Barcode",



  },



  {



    value: "OCR",



    label: "OCR",



  },



];



export default function ScannerHistoryPage() {



  const [items, setItems] = useState<



    ScannerHistoryItem[]



  >([]);



  const [search, setSearch] =



    useState("");



  const [status, setStatus] =



    useState("");



  const [source, setSource] =



    useState("");



  const [page, setPage] =



    useState(1);



  const [pagination, setPagination] =



    useState({



      page: 1,



      limit: 20,



      total: 0,



      totalPages: 1,



    });



  const [loading, setLoading] =



    useState(true);



  const [error, setError] =



    useState("");



  async function loadHistory(



    requestedPage = page,



  ) {



    setLoading(true);



    setError("");



    try {



      const params =



        new URLSearchParams();



      params.set(



        "page",



        String(requestedPage),



      );



      params.set(



        "limit",



        "20",



      );



      if (search.trim()) {



        params.set(



          "search",



          search.trim(),



        );



      }



      if (status) {



        params.set(



          "status",



          status,



        );



      }



      if (source) {



        params.set(



          "source",



          source,



        );



      }



      const response =



        await fetch(



          `/api/scanner/history?${params.toString()}`,



          {



            credentials: "include",



            cache: "no-store",



          },



        );



      const data =



        (await response.json()) as HistoryResponse;



      if (



        !response.ok ||



        !data.success



      ) {



        throw new Error(



          data.error ||



            "Gagal memuat scanner history.",



        );



      }



      setItems(data.data || []);



      setPagination(



        data.pagination || {



          page: requestedPage,



          limit: 20,



          total: 0,



          totalPages: 1,



        },



      );



      setPage(requestedPage);



    } catch (error) {



      console.error(error);



      setError(



        error instanceof Error



          ? error.message



          : "Gagal memuat scanner history.",



      );



    } finally {



      setLoading(false);



    }



  }



  useEffect(() => {



    loadHistory(1);



  }, [status, source]);



  function handleSearch() {



    loadHistory(1);



  }



  function handlePreviousPage() {



    if (page <= 1) {



      return;



    }



    loadHistory(page - 1);



  }



  function handleNextPage() {



    if (



      page >=



      pagination.totalPages



    ) {



      return;



    }



    loadHistory(page + 1);



  }



  return (



    <div className="min-h-full bg-background p-4 text-foreground md:p-6">



      <div className="mx-auto max-w-7xl">



        <div className="mb-6">



          <button



            type="button"



            onClick={() =>



              window.history.back()



            }



            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-rose-700 dark:hover:text-rose-300"



          >



            <ArrowLeft className="h-4 w-4" />



            Kembali



          </button>



          <div className="flex items-start gap-3">



            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm">



              <History className="h-5 w-5" />



            </div>



            <div>



              <h1 className="text-xl font-bold text-foreground md:text-2xl">



                Scanner History



              </h1>



              <p className="mt-1 text-sm text-muted-foreground">



                Riwayat dokumen yang dipindai dan



                transaksi yang dihasilkan.



              </p>



            </div>



          </div>



        </div>



        <section className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">



          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">



            <div className="relative">



              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />



              <input



                value={search}



                onChange={(event) =>



                  setSearch(



                    event.target.value,



                  )



                }



                onKeyDown={(event) => {



                  if (



                    event.key === "Enter"



                  ) {



                    handleSearch();



                  }



                }}



                placeholder="Cari nomor nota atau transaksi..."



                className="h-10 w-full rounded-xl border border-border bg-muted pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"



              />



            </div>



            <select



              value={status}



              onChange={(event) =>



                setStatus(



                  event.target.value,



                )



              }



              className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"



            >



              {STATUS_OPTIONS.map(



                (option) => (



                  <option



                    key={option.value}



                    value={option.value}



                  >



                    {option.label}



                  </option>



                ),



              )}



            </select>



            <select



              value={source}



              onChange={(event) =>



                setSource(



                  event.target.value,



                )



              }



              className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"



            >



              {SOURCE_OPTIONS.map(



                (option) => (



                  <option



                    key={option.value}



                    value={option.value}



                  >



                    {option.label}



                  </option>



                ),



              )}



            </select>



            <button



              type="button"



              onClick={handleSearch}



              disabled={loading}



              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-5 text-sm font-semibold text-white transition hover:from-rose-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60"



            >



              {loading ? (



                <Loader2 className="h-4 w-4 animate-spin" />



              ) : (



                <Search className="h-4 w-4" />



              )}



              Cari



            </button>



          </div>



        </section>



        {error && (



          <div className="mb-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">



            {error}



          </div>



        )}



        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">



          <div className="overflow-x-auto">



            <table className="w-full min-w-[950px] text-sm">



              <thead>



                <tr className="border-b border-border bg-muted">



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Dokumen



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Status



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Source



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    SPK



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Transaction



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Qty



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Scanned By



                  </th>



                  <th className="px-4 py-3 text-left font-semibold text-foreground">



                    Waktu



                  </th>



                </tr>



              </thead>



              <tbody>



                {loading ? (



                  <tr>



                    <td



                      colSpan={8}



                      className="px-4 py-12 text-center"



                    >



                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">



                        <Loader2 className="h-4 w-4 animate-spin" />



                        Memuat data...



                      </div>



                    </td>



                  </tr>



                ) : items.length === 0 ? (



                  <tr>



                    <td



                      colSpan={8}



                      className="px-4 py-12 text-center text-sm text-muted-foreground"



                    >



                      Tidak ada data scanner.



                    </td>



                  </tr>



                ) : (



                  items.map((item) => (



                    <HistoryRow



                      key={item.id}



                      item={item}



                    />



                  ))



                )}



              </tbody>



            </table>



          </div>



          <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">



            <p className="text-sm text-muted-foreground">



              Total{" "}



              <strong className="text-foreground">



                {pagination.total}



              </strong>{" "}



              dokumen



            </p>



            <div className="flex items-center gap-2">



              <button



                type="button"



                onClick={



                  handlePreviousPage



                }



                disabled={



                  loading ||



                  page <= 1



                }



                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"



              >



                <ChevronLeft className="h-4 w-4" />



                Sebelumnya



              </button>



              <span className="px-2 text-sm text-muted-foreground">



                {page} /{" "}



                {pagination.totalPages}



              </span>



              <button



                type="button"



                onClick={



                  handleNextPage



                }



                disabled={



                  loading ||



                  page >=



                    pagination.totalPages



                }



                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"



              >



                Berikutnya



                <ChevronRight className="h-4 w-4" />



              </button>



            </div>



          </div>



        </section>



      </div>



    </div>



  );



}



function HistoryRow({



  item,



}: {



  item: ScannerHistoryItem;



}) {



  return (



    <tr className="border-b border-border/70 last:border-b-0 transition hover:bg-muted/50">



      <td className="px-4 py-4">



        <div className="font-medium text-foreground">



          {item.documentNumber}



        </div>



        {item.documentType && (



          <div className="mt-1 text-xs text-muted-foreground">



            {item.documentType}



          </div>



        )}



      </td>



      <td className="px-4 py-4">



        <StatusBadge



          status={item.status}



        />



      </td>



      <td className="px-4 py-4">



        <span className="text-foreground">



          {item.source}



        </span>



      </td>



      <td className="px-4 py-4">



        <span className="font-medium text-foreground">



          {item.transaction



            ?.spk?.spkNumber || "-"}



        </span>



      </td>



      <td className="px-4 py-4">



        {item.transaction ? (



          <>



            <div className="font-medium text-foreground">



              {



                item.transaction



                  .transactionNumber



              }



            </div>



            <div className="mt-1 text-xs text-muted-foreground">



              {



                item.transaction



                  .transactionType.name



              }



            </div>



          </>



        ) : (



          <span className="text-muted-foreground">



            Belum ada transaksi



          </span>



        )}



      </td>



      <td className="px-4 py-4">



        <span className="font-semibold text-foreground">



          {item.transaction



            ?.quantity ?? "-"}



        </span>



      </td>



      <td className="px-4 py-4">



        {item.scannedBy ? (



          <>



            <div className="font-medium text-foreground">



              {item.scannedBy.name}



            </div>



            <div className="mt-1 text-xs text-muted-foreground">



              {item.scannedBy.email}



            </div>



          </>



        ) : (



          "-"



        )}



      </td>



      <td className="px-4 py-4">



        <div className="text-foreground">



          {formatDate(item.scannedAt)}



        </div>



        {item.processedAt && (



          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">



            Processed{" "}



            {formatDate(item.processedAt)}



          </div>



        )}



      </td>



    </tr>



  );



}



function StatusBadge({



  status,



}: {



  status: string;



}) {



  const styles: Record<



    string,



    string



  > = {



    PENDING:



      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",



    VALID:



      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20",



    INVALID:



      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",



    PROCESSED:



      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",



    DUPLICATE:



      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",



    REVIEW_REQUIRED:



      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",



  };



  return (



    <span



      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${



        styles[status] ||



        "border-border bg-muted text-muted-foreground"



      }`}



    >



      {status}



    </span>



  );



}



function formatDate(



  value: string,



) {



  return new Intl.DateTimeFormat(



    "id-ID",



    {



      dateStyle: "medium",



      timeStyle: "short",



    },



  ).format(new Date(value));



}