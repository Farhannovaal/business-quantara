"use client";

import { FormEvent, useEffect, useMemo, useState, } from "react";

import Link from "next/link";

import { Plus, ClipboardList, Search, RefreshCw, Pencil, Trash2, X, Loader2, ChevronRight, Ban, } from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

type Product = {

    id: number;

    code: string;

    name: string;

    isActive: boolean;

};

type Tailor = {

    id: number;

    name: string;

    isActive: boolean;

};

type SPKItem = {

    id: number;

    productId: number;

    quantity: number;

    product: Product;

};

type SPK = {

    id: number;

    spkNumber: string;

    tailorId: number;

    status: "ACTIVE" | "COMPLETED" | "CANCELLED";

    createdAt: string;

    updatedAt: string;

    items: SPKItem[];

    tailor: Tailor;

    _count?: {

        transactions: number;

    };

};

type FormItem = {

    productId: string;

    quantity: string;

};

type FormData = {

    spkNumber: string;

    tailorId: string;

    items: FormItem[];

};

const emptyForm: FormData = {

    spkNumber: "",

    tailorId: "",

    items: [{ productId: "", quantity: "1" }],

};

export default function SPKPage() {

    const [spks, setSpks] = useState<SPK[]>([]);

    const [products, setProducts] = useState<Product[]>([]);

    const [tailors, setTailors] = useState<Tailor[]>([]);

    const [search, setSearch] = useState("");

    const [status, setStatus] = useState("ALL");

    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);

    const [cancellingSpkId, setCancellingSpkId] = useState<number | null>(null);

    const [modalOpen, setModalOpen] = useState(false);

    const [editingSpk, setEditingSpk] = useState<SPK | null>(null);

    const [form, setForm] = useState<FormData>(emptyForm);

    const [error, setError] = useState("");

    async function loadData() {

        try {

            setLoading(true);

            setError("");

            const [spkRes, productRes, tailorRes] = await Promise.all([

                fetch("/api/spks"),

                fetch("/api/products"),

                fetch("/api/tailors"),

            ]);

            const spkJson = await spkRes.json();

            const productJson = await productRes.json();

            const tailorJson = await tailorRes.json();

            if (!spkRes.ok || !spkJson.success) {

                throw new Error(spkJson.error || "Gagal mengambil data SPK");

            }

            if (!productRes.ok || !productJson.success) {

                throw new Error(productJson.error || "Gagal mengambil data product");

            }

            if (!tailorRes.ok || !tailorJson.success) {

                throw new Error(tailorJson.error || "Gagal mengambil data penjahit");

            }

            setSpks(spkJson.data || []);

            setProducts(productJson.data || []);

            setTailors(tailorJson.data || []);

        }

        catch (err) {

            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data");

        }

        finally {

            setLoading(false);

        }

    }

    useEffect(() => {

        loadData();

    }, []);

    const filteredSpks = useMemo(() => {

        const keyword = search.trim().toLowerCase();

        return spks.filter((spk) => {

            const matchesSearch = !keyword ||

                spk.spkNumber.toLowerCase().includes(keyword) ||

                spk.items?.some((item) => item.product?.code?.toLowerCase().includes(keyword) ||

                    item.product?.name?.toLowerCase().includes(keyword)) ||

                spk.tailor?.name?.toLowerCase().includes(keyword);

            const matchesStatus = status === "ALL" || spk.status === status;

            return matchesSearch && matchesStatus;

        });

    }, [spks, search, status]);

    function openCreateModal() {

        setEditingSpk(null);

        setForm({

            spkNumber: "",

            tailorId: "",

            items: [{ productId: "", quantity: "1" }],

        });

        setError("");

        setModalOpen(true);

    }

    function openEditModal(spk: SPK) {

        setEditingSpk(spk);

        setForm({

            spkNumber: spk.spkNumber,

            tailorId: String(spk.tailorId),

            items: spk.items.length > 0

                ? spk.items.map((item) => ({

                    productId: String(item.productId),

                    quantity: String(item.quantity),

                }))

                : [{ productId: "", quantity: "1" }],

        });

        setError("");

        setModalOpen(true);

    }

    function closeModal() {

        if (saving)

            return;

        setModalOpen(false);

        setEditingSpk(null);

        setForm(emptyForm);

        setError("");

    }

    function addFormItem() {

        setForm((prev) => ({

            ...prev,

            items: [...prev.items, { productId: "", quantity: "1" }],

        }));

    }

    function removeFormItem(index: number) {

        setForm((prev) => {

            if (prev.items.length <= 1)

                return prev;

            return {

                ...prev,

                items: prev.items.filter((_, itemIndex) => itemIndex !== index),

            };

        });

    }

    function updateFormItem(index: number, field: keyof FormItem, value: string) {

        setForm((prev) => ({

            ...prev,

            items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),

        }));

    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {

        event.preventDefault();

        if (!form.spkNumber.trim()) {

            setError("Nomor SPK wajib diisi.");

            return;

        }

        if (!form.tailorId) {

            setError("Penjahit wajib dipilih.");

            return;

        }

        if (form.items.length === 0) {

            setError("Minimal satu product wajib ditambahkan.");

            return;

        }

        const normalizedItems = form.items.map((item) => ({

            productId: Number(item.productId),

            quantity: Number(item.quantity),

        }));

        if (normalizedItems.some((item) => !Number.isInteger(item.productId) || item.productId <= 0)) {

            setError("Semua product wajib dipilih.");

            return;

        }

        if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {

            setError("Quantity setiap product harus berupa bilangan bulat lebih dari 0.");

            return;

        }

        const productIds = normalizedItems.map((item) => item.productId);

        if (new Set(productIds).size !== productIds.length) {

            setError("Product tidak boleh duplikat dalam satu SPK.");

            return;

        }

        try {

            setSaving(true);

            setError("");

            const payload = {

                spkNumber: form.spkNumber.trim(),

                tailorId: Number(form.tailorId),

                items: normalizedItems,

            };

            const response = await fetch(editingSpk ? `/api/spks/${editingSpk.id}` : "/api/spks", {

                method: editingSpk ? "PATCH" : "POST",

                headers: {

                    "Content-Type": "application/json",

                },

                body: JSON.stringify(payload),

            });

            const result = await response.json();

            if (!response.ok || !result.success) {

                throw new Error(result.error || "Gagal menyimpan SPK");

            }

            closeModal();

            await loadData();

        }

        catch (err) {

            setError(err instanceof Error ? err.message : "Gagal menyimpan SPK");

        }

        finally {

            setSaving(false);

        }

    }

    async function handleDelete(spk: SPK) {

        const confirmed = window.confirm(`Hapus SPK "${spk.spkNumber}"?\n\nSPK hanya dapat dihapus jika belum memiliki transaksi.`);

        if (!confirmed)

            return;

        try {

            setError("");

            const response = await fetch(`/api/spks/${spk.id}`, {

                method: "DELETE",

            });

            const result = await response.json();

            if (!response.ok || !result.success) {

                throw new Error(result.error || "Gagal menghapus SPK");

            }

            await loadData();

        }

        catch (err) {

            setError(err instanceof Error ? err.message : "Gagal menghapus SPK");

        }

    }

    async function handleCancelSpk(spk: SPK) {

        if (spk.status !== "ACTIVE") return;



        const confirmed = window.confirm(

            `Batalkan SPK "${spk.spkNumber}"?\\\n\\\nStatus SPK akan menjadi CANCELLED. Riwayat transaksi tetap disimpan dan SPK tidak dihapus.`

        );

        if (!confirmed) return;



        try {

            setCancellingSpkId(spk.id);

            setError("");

            const response = await fetch(`/api/spks/${spk.id}`, {

                method: "PATCH",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({ status: "CANCELLED" }),

            });

            const result = await response.json();



            if (!response.ok || !result.success) {

                throw new Error(result.error || "Gagal membatalkan SPK");

            }



            await loadData();

        } catch (err) {

            setError(err instanceof Error ? err.message : "Gagal membatalkan SPK");

        } finally {

            setCancellingSpkId(null);

        }

    }



    function getStatusStyle(value: SPK["status"]) {

        switch (value) {

            case "ACTIVE":

                return "bg-emerald-950/40 text-emerald-300 border-emerald-500/30";

            case "COMPLETED":

                return "bg-blue-950/40 text-blue-300 border-blue-500/30";

            case "CANCELLED":

                return "bg-red-950/40 text-red-300 border-red-500/30";

            default:

                return "bg-zinc-900 text-zinc-300 border-zinc-700";

        }

    }

    return (<div className="relative min-h-screen min-w-0 w-full overflow-hidden bg-gradient-to-br from-[#090909] via-[#111111] to-[#19090b] px-4 py-4 sm:px-5 sm:py-5 lg:px-6">

    <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-red-600/15 blur-3xl"/>

    <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-red-900/15 blur-3xl"/>

    <div className="relative mx-auto w-full max-w-[1680px] space-y-5">

    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

    <div>

    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-[#101010] px-3 py-1.5 text-xs font-semibold text-red-400 shadow-sm">

    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>

Production Management

    </div>

    <div className="flex items-center gap-3 sm:gap-4">

    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12 bg-gradient-to-br from-red-700 to-red-600 text-white shadow-lg shadow-red-950/40">

    <ClipboardList size={22}/>

    </div>

    <div>

    <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">SPK</h1>

    <p className="mt-1 text-sm text-zinc-400">

Kelola Surat Perintah Kerja dan production tracking.

    </p>

    </div>

    </div>

    </div>

    <PermissionGate permission="spk.create">

    <button onClick={openCreateModal} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-4 py-2.5 sm:w-auto text-sm font-semibold text-white shadow-lg shadow-red-950/40 transition hover:-translate-y-0.5 hover:from-red-800 hover:to-red-700">

    <Plus size={17}/>

Create SPK

    </button>

    </PermissionGate>

    </div>

        {error && !modalOpen && (<div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300 shadow-sm">

        <div className="font-semibold">Terjadi kesalahan</div>

        <div className="mt-1">{error}</div>

        </div>)}

    <div className="rounded-2xl border border-white/10 bg-[#101010] p-4 shadow-sm">

    <div className="flex flex-col gap-3 lg:flex-row">

    <div className="relative flex-1">

    <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-red-400"/>

    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari SPK, product, atau penjahit..." className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-red-500 focus:bg-[#101010] focus:ring-4 focus:ring-red-500/15"/>

    </div>

    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 text-sm font-medium text-zinc-200 sm:w-auto outline-none transition focus:border-red-500 focus:bg-[#101010] focus:ring-4 focus:ring-red-500/15">

    <option value="ALL">All Status</option>

    <option value="ACTIVE">Active</option>

    <option value="COMPLETED">Completed</option>

    <option value="CANCELLED">Cancelled</option>

    </select>

    <button onClick={loadData} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-[#101010] px-4 py-3 sm:w-auto text-sm font-semibold text-red-300 shadow-sm transition hover:bg-red-950/40 disabled:opacity-50">

    <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>

Refresh

    </button>

    </div>

    </div>

    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010] shadow-sm">

    <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between">

    <div>

    <div className="flex items-center gap-2">

    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950/40 text-red-400">

    <ClipboardList size={17}/>

    </div>

    <h2 className="font-bold text-white">SPK List</h2>

    </div>

    <p className="mt-2 text-xs text-zinc-400">

    {filteredSpks.length} SPK ditemukan

    </p>

    </div>

    <div className="rounded-full bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-400">

    {filteredSpks.length} Orders

    </div>

    </div>

        {loading ? (<div className="flex min-h-60 items-center justify-center">

        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-400">

        <Loader2 size={18} className="animate-spin"/>

Loading SPK...

        </div>

        </div>) : filteredSpks.length === 0 ? (<div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-950/40 text-red-400">

        <Search size={22}/>

        </div>

        <p className="mt-4 font-bold text-white">Tidak ada SPK</p>

        <p className="mt-1 max-w-sm text-sm text-zinc-400">

Belum ada SPK yang sesuai dengan filter pencarian kamu.

        </p>

        <PermissionGate permission="spk.create">

        <button onClick={openCreateModal} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/60">

        <Plus size={16}/>

Create SPK

        </button>

        </PermissionGate>

        </div>) : (<div className="overflow-x-auto overscroll-x-contain">

        <table className="w-full min-w-[1000px]">

        <thead>

        <tr className="border-b border-red-500/15 bg-gradient-to-r from-red-950/40 to-red-950/30">

        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">SPK</th>

        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Products</th>

        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Penjahit</th>

        <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Transactions</th>

        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Status</th>

        <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Actions</th>

        </tr>

        </thead>

        <tbody className="divide-y divide-white/10">

            {filteredSpks.map((spk) => (<tr key={spk.id} className="group transition hover:bg-red-950/40/30">

            <td className="px-4 py-3.5">

            <Link href={`/operations/spk/${spk.id}`} className="font-bold text-red-400 transition hover:text-red-200">

            {spk.spkNumber}

            </Link>

            <div className="mt-1 text-[11px] text-zinc-500">Production order</div>

            </td>

            <td className="px-4 py-3.5">

            <div className="space-y-1.5">

                {spk.items?.map((item) => (<div key={item.id} className="rounded-xl bg-[#151515] px-3 py-2">

                <div className="text-sm font-semibold text-white">

                {item.product?.name || "-"}

                </div>

                <div className="mt-0.5 text-xs text-zinc-500">

                {item.product?.code || "-"} · {item.quantity.toLocaleString("id-ID")} pcs

                </div>

                </div>))}

            </div>

            </td>

            <td className="px-4 py-3.5 text-sm font-medium text-zinc-300">{spk.tailor?.name || "-"}</td>

            <td className="px-4 py-3.5 text-center">

            <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-red-950/40 px-2.5 py-1 text-xs font-bold text-red-300">

            {spk._count?.transactions ?? 0}

            </span>

            </td>

            <td className="px-4 py-3.5">

            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusStyle(spk.status)}`}>

            <span className="h-1.5 w-1.5 rounded-full bg-current"/>

            {spk.status}

            </span>

            </td>

            <td className="px-4 py-3.5">

            <div className="flex items-center justify-end gap-1">

            <Link href={`/operations/spk/${spk.id}`} title="View detail" className="rounded-xl p-2 text-zinc-500 transition hover:bg-red-950/40 hover:text-red-400">

            <ChevronRight size={17}/>

            </Link>

            <PermissionGate permission="spk.edit">

            <button onClick={() => openEditModal(spk)} title="Edit" className="rounded-xl p-2 text-zinc-500 transition hover:bg-red-950/40 hover:text-red-400">

            <Pencil size={16}/>

            </button>

            </PermissionGate>

            {spk.status === "ACTIVE" && (

                <PermissionGate permission="spk.edit">

                <button

                    onClick={() => handleCancelSpk(spk)}

                    title="Batalkan SPK"

                    aria-label={`Batalkan SPK ${spk.spkNumber}`}

                    disabled={cancellingSpkId === spk.id}

                    className="rounded-xl p-2 text-zinc-500 transition hover:bg-red-950/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"

                >

                    {cancellingSpkId === spk.id

                        ? <Loader2 size={16} className="animate-spin"/>

                        : <Ban size={16}/>}

                </button>

                </PermissionGate>

            )}

            <PermissionGate permission="spk.delete">

            <button onClick={() => handleDelete(spk)} title="Delete" className="rounded-xl p-2 text-zinc-500 transition hover:bg-red-950/30 hover:text-red-400">

            <Trash2 size={16}/>

            </button>

            </PermissionGate>

            </div>

            </td>

            </tr>))}

        </tbody>

        </table>

        </div>)}

    </div>

    </div>

        {modalOpen && (<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">

        <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl sm:max-h-[90vh] sm:rounded-3xl border border-white/10 bg-[#101010] shadow-2xl shadow-black/50">

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-red-500/15 bg-gradient-to-r from-red-950/40 to-red-950/30 px-4 py-4 sm:px-5">

        <div>

        <div className="flex items-center gap-2">

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950/60 text-red-400">

        <ClipboardList size={17}/>

        </div>

        <h2 className="font-bold text-white">

        {editingSpk ? "Edit SPK" : "Create SPK"}

        </h2>

        </div>

        <p className="mt-2 text-xs text-zinc-400">

Satu SPK dapat memiliki beberapa product.

        </p>

        </div>

        <button onClick={closeModal} disabled={saving} className="rounded-xl p-2 text-zinc-500 transition hover:bg-[#101010] hover:text-zinc-200 disabled:opacity-50">

        <X size={18}/>

        </button>

        </div>

        <form onSubmit={handleSubmit}>

        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">

            {error && (<div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-3.5 py-3 text-sm text-red-300">

            <div className="font-semibold">Periksa input</div>

            <div className="mt-1">{error}</div>

            </div>)}

        <div>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">SPK Number</label>

        <input type="text" value={form.spkNumber} onChange={(e) => setForm((prev) => ({ ...prev, spkNumber: e.target.value }))} placeholder="Contoh: SPK-001" disabled={saving} className="w-full rounded-2xl border border-white/10 bg-[#151515] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-red-500 focus:bg-[#101010] focus:ring-4 focus:ring-red-500/15 disabled:opacity-60"/>

        </div>

        <div>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">Penjahit</label>

        <select value={form.tailorId} onChange={(e) => setForm((prev) => ({ ...prev, tailorId: e.target.value }))} disabled={saving} className="w-full rounded-2xl border border-white/10 bg-[#101010] px-3.5 py-3 text-sm text-white outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/15 disabled:opacity-60">

        <option value="">Select penjahit...</option>

            {tailors.filter((tailor) => tailor.isActive).map((tailor) => (<option key={tailor.id} value={tailor.id}>{tailor.name}</option>))}

        </select>

        </div>

        <div>

        <div className="mb-2 flex items-center justify-between">

        <label className="block text-xs font-bold uppercase tracking-wide text-zinc-400">Products</label>

        <button type="button" onClick={addFormItem} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-red-950/40 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/60 disabled:opacity-60">

        <Plus size={14}/>

Add Product

        </button>

        </div>

        <div className="space-y-3">

            {form.items.map((item, index) => (<div key={index} className="rounded-2xl border border-white/10 bg-[#151515] p-3">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">

            <div className="min-w-0 flex-1">

            <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">Product {index + 1}</label>

            <select value={item.productId} onChange={(e) => updateFormItem(index, "productId", e.target.value)} disabled={saving} className="w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2.5 text-sm text-white outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/15 disabled:opacity-60">

            <option value="">Select product...</option>

                {products.filter((product) => product.isActive).map((product) => (<option key={product.id} value={product.id} disabled={form.items.some((other, otherIndex) => otherIndex !== index && other.productId === String(product.id))}>

                {product.code} — {product.name}

                </option>))}

            </select>

            </div>

            <div className="w-full sm:w-28">

            <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">Quantity</label>

            <input type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateFormItem(index, "quantity", e.target.value)} disabled={saving} className="w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2.5 text-sm text-white outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/15 disabled:opacity-60"/>

            </div>

            <button type="button" onClick={() => removeFormItem(index)} disabled={saving || form.items.length <= 1} title="Remove product" className="self-end rounded-xl p-2 text-zinc-500 sm:mt-6 sm:self-auto transition hover:bg-red-950/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40">

            <Trash2 size={16}/>

            </button>

            </div>

            </div>))}

        </div>

        <p className="mt-2 text-[11px] text-zinc-500">

Product yang sama tidak dapat ditambahkan dua kali dalam satu SPK.

        </p>

        </div>

        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-red-500/15 bg-[#151515] px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-5">

        <button type="button" onClick={closeModal} disabled={saving} className="w-full rounded-xl border border-white/10 bg-[#101010] px-4 py-2.5 text-sm font-semibold text-zinc-300 sm:w-auto transition hover:bg-[#151515] disabled:opacity-50">

Cancel

        </button>

        <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-4 py-2.5 sm:w-auto text-sm font-semibold text-white shadow-lg shadow-red-950/40 transition hover:from-red-800 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-60">

        {saving && <Loader2 size={16} className="animate-spin"/>}

        {saving ? "Saving..." : editingSpk ? "Save Changes" : "Create SPK"}

        </button>

        </div>

        </form>

        </div>

        </div>)}

    </div>);

}
