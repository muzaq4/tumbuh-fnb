/* TUMBUH F&B prototype v0.1.0 — local-first, no external libraries. */
"use strict";

const DB_NAME = "tumbuh-fnb-local";
const DB_VERSION = 1;
const STORE_NAME = "appState";
const STATE_KEY = "current";
const FALLBACK_KEY = "tumbuh-fnb-state-v1";
const PAYMENT_METHODS = ["Tunai", "QRIS", "Transfer"];
const UNIT_OPTIONS = ["g", "ml", "pcs"];
let state = null;
let activePage = "dashboard";
let cart = {};
let dbAvailable = true;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const money = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n || 0));
const number = (n, digits = 2) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(Number(n || 0));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
const todayISO = () => new Date().toISOString();
const monthKey = (iso) => { const d = new Date(iso || Date.now()); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const formatDate = (iso) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

function seedState() {
  const now = todayISO();
  const tea = { id: "demo-tea", name: "Teh", unit: "g", stockQty: 200, avgUnitCost: 40, minStock: 0 };
  const sugar = { id: "demo-sugar", name: "Gula", unit: "g", stockQty: 500, avgUnitCost: 18, minStock: 0 };
  const cup = { id: "demo-cup", name: "Gelas + tutup", unit: "pcs", stockQty: 30, avgUnitCost: 300, minStock: 0 };
  return {
    schemaVersion: 1,
    demo: true,
    settings: { businessName: "Usaha Contoh", openingCash: 0, createdAt: now },
    ingredients: [tea, sugar, cup],
    products: [{
      id: "demo-es-teh", name: "Es Teh", price: 5000, active: true,
      recipe: [
        { ingredientId: tea.id, qty: 3 },
        { ingredientId: sugar.id, qty: 15 },
        { ingredientId: cup.id, qty: 1 }
      ],
      createdAt: now
    }],
    sales: [],
    expenses: [],
    stockMovements: [
      { id: uid(), ingredientId: tea.id, type: "opening", qtyDelta: 200, unitCost: 40, totalCost: 8000, paymentMethod: "Tunai", date: now, note: "Stok contoh" },
      { id: uid(), ingredientId: sugar.id, type: "opening", qtyDelta: 500, unitCost: 18, totalCost: 9000, paymentMethod: "Tunai", date: now, note: "Stok contoh" },
      { id: uid(), ingredientId: cup.id, type: "opening", qtyDelta: 30, unitCost: 300, totalCost: 9000, paymentMethod: "Tunai", date: now, note: "Stok contoh" }
    ]
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB tidak tersedia"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Gagal membuka database"));
  });
}

async function loadState() {
  try {
    const db = await openDB();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    dbAvailable = true;
    if (value) return value;
    const initial = seedState();
    await saveState(initial);
    return initial;
  } catch (err) {
    dbAvailable = false;
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      if (raw) return JSON.parse(raw);
      const initial = seedState();
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(initial));
      return initial;
    } catch (fallbackError) {
      throw new Error("Penyimpanan lokal tidak dapat diakses di browser ini.");
    }
  }
}

async function saveState(nextState) {
  nextState.updatedAt = todayISO();
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(nextState, STATE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan data"));
      tx.onabort = () => reject(tx.error || new Error("Penyimpanan dibatalkan"));
    });
    db.close();
    dbAvailable = true;
  } catch (err) {
    dbAvailable = false;
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(nextState));
    } catch (fallbackError) {
      throw new Error("Gagal menyimpan. Ruang penyimpanan browser mungkin penuh.");
    }
  }
  state = nextState;
  updateConnectionStatus();
}

function cloneState() { return JSON.parse(JSON.stringify(state)); }
function ingredientById(id, source = state) { return source.ingredients.find(x => x.id === id); }
function productById(id, source = state) { return source.products.find(x => x.id === id); }

function productCost(product, source = state) {
  let total = 0;
  let complete = Array.isArray(product.recipe) && product.recipe.length > 0;
  for (const line of (product.recipe || [])) {
    const ingredient = ingredientById(line.ingredientId, source);
    if (!ingredient || !Number.isFinite(Number(ingredient.avgUnitCost)) || Number(ingredient.avgUnitCost) <= 0) {
      complete = false;
      continue;
    }
    total += Number(line.qty) * Number(ingredient.avgUnitCost);
  }
  return { cost: total, complete };
}

function reportForMonth(source = state, month = monthKey(todayISO())) {
  const sales = source.sales.filter(s => monthKey(s.date) === month);
  const expenses = source.expenses.filter(e => monthKey(e.date) === month);
  const revenue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const cogs = sales.reduce((sum, s) => sum + Number(s.cogs || 0), 0);
  const operatingExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const incompleteSales = sales.filter(s => s.costComplete === false).length;
  return { revenue, cogs, grossProfit: revenue - cogs, operatingExpenses, netProfit: revenue - cogs - operatingExpenses, salesCount: sales.length, incompleteSales };
}

function cashAvailable(source = state) {
  const cashSales = source.sales.filter(s => s.paymentMethod === "Tunai").reduce((sum, s) => sum + Number(s.total || 0), 0);
  const cashExpenses = source.expenses.filter(e => e.paymentMethod === "Tunai").reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const cashStockPurchases = source.stockMovements.filter(m => m.type === "purchase" && m.paymentMethod === "Tunai").reduce((sum, m) => sum + Number(m.totalCost || 0), 0);
  return Number(source.settings.openingCash || 0) + cashSales - cashExpenses - cashStockPurchases;
}

function toast(message, type = "ok") {
  const region = $("#toast-region");
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.textContent = message;
  region.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

function updateConnectionStatus() {
  const el = $("#connection-status");
  if (!el) return;
  const online = navigator.onLine;
  el.className = `connection-pill ${online ? "online" : "offline"}`;
  el.innerHTML = `<i></i>${online ? "Online" : "Offline"}${dbAvailable ? "" : " · mode cadangan"}`;
}

function pageHeading(eyebrow, title, subtitle, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
function card(title, content, extraClass = "") {
  return `<section class="card card-pad ${extraClass}"><div class="card-head"><h2>${title}</h2></div>${content}</section>`;
}
function emptyState(title, body) {
  return `<div class="empty"><strong>${title}</strong>${body}</div>`;
}
function paymentSelect(name = "paymentMethod") {
  return `<select name="${name}">${PAYMENT_METHODS.map(m => `<option>${m}</option>`).join("")}</select>`;
}
function desktopTabs() {
  const pages = [["dashboard","Ringkasan"],["cashier","Kasir"],["products","Produk & HPP"],["stock","Stok bahan"],["expenses","Pengeluaran"],["reports","Laporan"]];
  return `<div class="desktop-tabs">${pages.map(([id,label]) => `<button type="button" data-page="${id}" class="${activePage===id?"active":""}">${label}</button>`).join("")}</div>`;
}

function renderDashboard() {
  const r = reportForMonth();
  const cash = cashAvailable();
  const recent = [...state.sales].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  const incompleteProducts = state.products.filter(p => !productCost(p).complete).length;
  const lowStock = state.ingredients.filter(i => Number(i.stockQty) <= 0);
  const demoNotice = state.demo ? `<div class="notice">Ini data contoh untuk mencoba alur aplikasi. Hapus data contoh sebelum memasukkan transaksi usaha sungguhan. <button class="btn small-btn secondary" data-action="clear-demo" type="button" style="margin-left:6px">Hapus data contoh</button></div>` : "";
  const hppNotice = incompleteProducts ? `<div class="notice danger">${incompleteProducts} produk belum memiliki HPP lengkap. Lengkapi resep dan biaya bahan agar laporan laba tidak menyesatkan.</div>` : "";
  const stockNotice = lowStock.length ? `<div class="notice warn">${lowStock.length} bahan memiliki stok nol atau minus. Periksa pembelian atau pemakaian stok.</div>` : "";
  return `
    ${pageHeading("Pusat kendali usaha", esc(state.settings.businessName || "Usaha saya"), "Ringkasan angka usaha bulan ini. Angka laba dihitung dari transaksi yang tersimpan.")}
    ${demoNotice}${hppNotice}${stockNotice}
    <div class="metric-grid">
      <div class="card metric primary"><div class="metric-label">Omzet bulan ini</div><div class="metric-value">${money(r.revenue)}</div><div class="metric-foot">${r.salesCount} transaksi tercatat</div></div>
      <div class="card metric"><div class="metric-label">Laba bersih tercatat</div><div class="metric-value">${money(r.netProfit)}</div><div class="metric-foot">Setelah HPP & biaya operasional</div></div>
      <div class="card metric"><div class="metric-label">Kas tunai tersedia</div><div class="metric-value">${money(cash)}</div><div class="metric-foot">Tidak termasuk saldo QRIS/transfer</div></div>
      <div class="card metric"><div class="metric-label">Pengeluaran operasional</div><div class="metric-value">${money(r.operatingExpenses)}</div><div class="metric-foot">Bulan ini</div></div>
    </div>
    <div class="grid-two">
      ${card("Perjalanan omzet ke laba", `
        <div class="list">
          <div class="list-item"><span class="muted small">Omzet</span><strong>${money(r.revenue)}</strong></div>
          <div class="list-item"><span class="muted small">HPP barang terjual</span><strong>− ${money(r.cogs)}</strong></div>
          <div class="list-item"><span class="muted small">Laba kotor</span><strong>${money(r.grossProfit)}</strong></div>
          <div class="list-item"><span class="muted small">Biaya operasional</span><strong>− ${money(r.operatingExpenses)}</strong></div>
          <div class="list-item"><span class="strong small">Laba bersih</span><strong class="${r.netProfit<0?'negative':''}">${money(r.netProfit)}</strong></div>
        </div>
        ${r.incompleteSales ? `<p class="field-help" style="margin-top:10px">Catatan: ${r.incompleteSales} transaksi memiliki HPP yang belum lengkap; laba dapat terlihat lebih tinggi dari kenyataan.</p>` : ""}
      `)}
      ${card("Aktivitas cepat", `
        <div class="stack">
          <button class="btn full" data-page="cashier">＋ Mulai transaksi</button>
          <button class="btn secondary full" data-page="expenses">＋ Catat pengeluaran</button>
          <button class="btn secondary full" data-page="stock">＋ Catat pembelian bahan</button>
          <button class="btn ghost full" data-page="products">Kelola produk & HPP</button>
        </div>
      `)}
    </div>
    <div style="height:13px"></div>
    ${card("Transaksi terbaru", recent.length ? `<div class="list">${recent.map(s => `<div class="list-item"><div><div class="item-title">${esc(s.items.map(i=>`${i.qty}× ${i.name}`).join(", "))}</div><div class="item-meta">${formatDate(s.date)} · ${esc(s.paymentMethod)}</div></div><div class="amount">${money(s.total)}</div></div>`).join("")}</div>` : emptyState("Belum ada transaksi","Transaksi yang dibuat melalui kasir akan muncul di sini."))}
  `;
}

function renderCashier() {
  const products = state.products.filter(p => p.active !== false);
  const cartLines = Object.entries(cart).map(([id, qty]) => ({ product: productById(id), qty })).filter(x => x.product && x.qty > 0);
  const total = cartLines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const costWarnings = cartLines.filter(line => !productCost(line.product).complete).length;
  return `
    ${pageHeading("Transaksi", "Kasir", "Pilih produk, atur jumlah, lalu simpan transaksi. Bisa digunakan tanpa internet.")}
    <div class="grid-two">
      <section class="card card-pad">
        <div class="card-head"><h2>Pilih produk</h2><span class="badge">${products.length} produk</span></div>
        ${products.length ? `<div class="product-grid">${products.map(p => {
          const c = productCost(p);
          return `<button type="button" class="product-tile" data-action="cart-add" data-id="${p.id}">
            <span class="product-name">${esc(p.name)}</span><span class="product-price">${money(p.price)}</span>
            <span class="product-cost">${c.complete ? `HPP ${money(c.cost)}` : "HPP belum lengkap"}</span>
          </button>`;
        }).join("")}</div>` : emptyState("Belum ada produk","Tambahkan produk dan harga jual terlebih dahulu di menu Produk.")}
      </section>
      <section class="card card-pad">
        <div class="card-head"><h2>Keranjang</h2><button class="btn small-btn secondary" data-action="cart-clear" type="button">Kosongkan</button></div>
        ${cartLines.length ? `
          ${cartLines.map(({product,qty}) => `<div class="cart-line">
            <div><div class="item-title">${esc(product.name)}</div><div class="item-meta">${money(product.price)} × ${qty}</div></div>
            <div class="qty-control"><button type="button" data-action="cart-minus" data-id="${product.id}">−</button><strong>${qty}</strong><button type="button" data-action="cart-add" data-id="${product.id}">＋</button></div>
          </div>`).join("")}
          <div class="divider"></div>
          <div class="row"><span class="muted small">Total tagihan</span><strong style="font-size:20px">${money(total)}</strong></div>
          ${costWarnings ? `<div class="notice danger" style="margin-top:11px">${costWarnings} produk di keranjang belum memiliki HPP lengkap. Transaksi tetap bisa dicatat, tetapi laba tidak akan akurat.</div>` : ""}
          <form id="sale-form" class="stack" style="margin-top:13px">
            <div class="field"><label>Metode pembayaran</label>${paymentSelect()}</div>
            <button class="btn full" type="submit">Simpan transaksi · ${money(total)}</button>
          </form>
        ` : emptyState("Keranjang masih kosong","Ketuk salah satu produk untuk memasukkannya ke keranjang.")}
      </section>
    </div>
  `;
}

function recipeRowsHtml(recipe = []) {
  const options = state.ingredients.map(i => `<option value="${i.id}">${esc(i.name)} (${esc(i.unit)})</option>`).join("");
  if (!recipe.length) return `<div class="recipe-row"><select name="recipeIngredient">${options}</select><input name="recipeQty" type="number" min="0.0001" step="any" placeholder="Takaran"><button type="button" data-action="remove-recipe-row">×</button></div>`;
  return recipe.map(line => `<div class="recipe-row"><select name="recipeIngredient">${state.ingredients.map(i => `<option value="${i.id}" ${i.id===line.ingredientId?"selected":""}>${esc(i.name)} (${esc(i.unit)})</option>`).join("")}</select><input name="recipeQty" type="number" min="0.0001" step="any" value="${line.qty}"><button type="button" data-action="remove-recipe-row">×</button></div>`).join("");
}

function renderProducts() {
  const products = state.products;
  return `
    ${pageHeading("Menu & biaya produk", "Produk dan HPP", "Masukkan resep per satu porsi. Takaran resep harus memakai satuan dasar bahan yang sama (g, ml, atau pcs).")}
    <div class="grid-two">
      <section class="card card-pad">
        <div class="card-head"><h2>Tambah produk</h2><span class="badge">HPP otomatis</span></div>
        ${state.ingredients.length ? `
          <form id="product-form" class="stack">
            <div class="field"><label>Nama produk</label><input name="name" required maxlength="60" placeholder="Contoh: Es Teh"></div>
            <div class="field"><label>Harga jual per porsi (Rp)</label><input name="price" type="number" min="1" step="1" required placeholder="5000"></div>
            <div>
              <div class="row"><label class="field-help strong">Resep per 1 porsi</label><button type="button" class="btn small-btn secondary" data-action="add-recipe-row">＋ Bahan</button></div>
              <div id="recipe-rows">${recipeRowsHtml()}</div>
              <p class="field-help">Contoh: 3 g teh, 15 g gula, 1 pcs gelas. Biaya bahan dihitung dari rata-rata biaya stok.</p>
            </div>
            <button class="btn full" type="submit">Simpan produk</button>
          </form>
        ` : `<div class="notice">Tambahkan bahan baku dan catat pembelian/stoknya terlebih dahulu agar HPP dapat dihitung.</div><button class="btn full" data-page="stock">Buka stok bahan</button>`}
      </section>
      <section class="card card-pad">
        <div class="card-head"><h2>Daftar produk</h2><span class="badge">${products.length} produk</span></div>
        ${products.length ? `<div class="list">${products.map(p => {
          const c = productCost(p);
          const margin = c.complete && p.price > 0 ? ((p.price-c.cost)/p.price)*100 : null;
          return `<div class="list-item"><div style="min-width:0"><div class="item-title">${esc(p.name)}</div><div class="item-meta">Harga ${money(p.price)} · ${c.complete ? `HPP ${money(c.cost)} · Margin ${number(margin,1)}%` : "HPP belum lengkap"}</div></div><span class="badge ${!c.complete?'warn':(c.cost>=p.price?'danger':'')}">${!c.complete?"Perlu resep":(c.cost>=p.price?"Rugi/impas":"Terhitung")}</span></div>`;
        }).join("")}</div>` : emptyState("Belum ada produk","Produk yang dibuat akan muncul di sini.")}
      </section>
    </div>
  `;
}

function renderStock() {
  const ingredients = state.ingredients;
  return `
    ${pageHeading("Persediaan bahan", "Stok bahan baku", "Catat pembelian bahan di sini. Pembelian bahan menambah stok dan mengurangi kas sesuai metode pembayaran; belum langsung menjadi biaya operasional.")}
    <div class="grid-two">
      <section class="card card-pad">
        <div class="card-head"><h2>Tambah bahan</h2></div>
        <form id="ingredient-form" class="stack">
          <div class="field"><label>Nama bahan</label><input name="name" required maxlength="60" placeholder="Contoh: Ayam fillet"></div>
          <div class="field"><label>Satuan dasar</label><select name="unit">${UNIT_OPTIONS.map(u=>`<option value="${u}">${u}</option>`).join("")}</select><span class="field-help">Gunakan g untuk gram, ml untuk mililiter, pcs untuk satuan. Jika membeli 1 kg, masukkan 1.000 g.</span></div>
          <button class="btn full" type="submit">Tambah bahan</button>
        </form>
        <div class="divider"></div>
        <div class="card-head"><h2>Catat pembelian / stok masuk</h2></div>
        ${ingredients.length ? `
          <form id="stock-form" class="stack">
            <div class="field"><label>Bahan</label><select name="ingredientId" required>${ingredients.map(i=>`<option value="${i.id}">${esc(i.name)} (${esc(i.unit)})</option>`).join("")}</select></div>
            <div class="form-grid two">
              <div class="field"><label>Jumlah masuk</label><input name="qty" type="number" min="0.0001" step="any" required placeholder="1000"></div>
              <div class="field"><label>Total biaya pembelian (Rp)</label><input name="totalCost" type="number" min="0" step="1" required placeholder="50000"></div>
            </div>
            <div class="field"><label>Dibayar dengan</label>${paymentSelect()}</div>
            <button class="btn full" type="submit">Simpan stok masuk</button>
          </form>
        ` : `<p class="field-help">Buat bahan terlebih dahulu untuk mencatat stok masuk.</p>`}
      </section>
      <section class="card card-pad">
        <div class="card-head"><h2>Persediaan saat ini</h2><span class="badge">${ingredients.length} bahan</span></div>
        ${ingredients.length ? `<div class="list">${ingredients.map(i=>`<div class="list-item"><div><div class="item-title">${esc(i.name)}</div><div class="item-meta">Biaya rata-rata ${money(i.avgUnitCost)} / ${esc(i.unit)}</div></div><div class="amount">${number(i.stockQty,3)} ${esc(i.unit)}${Number(i.stockQty)<0?'<div class="badge danger">Stok minus</div>':''}</div></div>`).join("")}</div>` : emptyState("Belum ada bahan","Tambahkan bahan baku untuk mulai menghitung HPP.")}
      </section>
    </div>
  `;
}

function renderExpenses() {
  const expenses = [...state.expenses].sort((a,b)=>b.date.localeCompare(a.date));
  const total = expenses.filter(e=>monthKey(e.date)===monthKey(todayISO())).reduce((s,e)=>s+e.amount,0);
  return `
    ${pageHeading("Arus biaya usaha", "Pengeluaran", "Catat biaya operasional seperti gas, listrik, sewa, transportasi, dan kebutuhan non-stok. Pembelian bahan baku dicatat di menu Stok.")}
    <div class="grid-two">
      <section class="card card-pad">
        <div class="card-head"><h2>Catat pengeluaran</h2></div>
        <form id="expense-form" class="stack">
          <div class="field"><label>Keperluan</label><input name="description" required maxlength="80" placeholder="Contoh: Gas LPG"></div>
          <div class="field"><label>Jumlah (Rp)</label><input name="amount" type="number" min="1" step="1" required placeholder="22000"></div>
          <div class="field"><label>Dibayar dengan</label>${paymentSelect()}</div>
          <button class="btn full" type="submit">Simpan pengeluaran</button>
        </form>
        <div class="divider"></div>
        <div class="row"><span class="muted small">Total biaya operasional bulan ini</span><strong>${money(total)}</strong></div>
      </section>
      <section class="card card-pad">
        <div class="card-head"><h2>Riwayat pengeluaran</h2><span class="badge">${expenses.length} catatan</span></div>
        ${expenses.length ? `<div class="list">${expenses.slice(0,30).map(e=>`<div class="list-item"><div><div class="item-title">${esc(e.description)}</div><div class="item-meta">${formatDate(e.date)} · ${esc(e.paymentMethod)}</div></div><div class="amount">${money(e.amount)}</div></div>`).join("")}</div>` : emptyState("Belum ada pengeluaran","Catatan biaya operasional akan muncul di sini.")}
      </section>
    </div>
  `;
}

function renderReports() {
  const r = reportForMonth();
  const nonCashSales = state.sales.filter(s=>s.paymentMethod!=="Tunai" && monthKey(s.date)===monthKey(todayISO())).reduce((sum,s)=>sum+s.total,0);
  const recentSales = [...state.sales].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  return `
    ${pageHeading("Kinerja usaha", "Laporan keuangan", "Ringkasan bulan berjalan. Laba dihitung berdasarkan HPP yang disimpan saat transaksi dibuat.")}
    ${r.incompleteSales ? `<div class="notice danger">${r.incompleteSales} transaksi memiliki HPP belum lengkap. Lengkapi resep produk untuk memperbaiki akurasi transaksi berikutnya. HPP transaksi lama tidak diubah otomatis.</div>` : ""}
    <div class="metric-grid">
      <div class="card metric primary"><div class="metric-label">Omzet</div><div class="metric-value">${money(r.revenue)}</div><div class="metric-foot">Penjualan bulan ini</div></div>
      <div class="card metric"><div class="metric-label">HPP terjual</div><div class="metric-value">${money(r.cogs)}</div><div class="metric-foot">Biaya bahan dari penjualan</div></div>
      <div class="card metric"><div class="metric-label">Laba kotor</div><div class="metric-value">${money(r.grossProfit)}</div><div class="metric-foot">Omzet dikurangi HPP</div></div>
      <div class="card metric"><div class="metric-label">Laba bersih</div><div class="metric-value">${money(r.netProfit)}</div><div class="metric-foot">Setelah biaya operasional</div></div>
    </div>
    <div class="grid-two">
      ${card("Rincian laba rugi", `<div class="list">
        <div class="list-item"><span class="muted small">Omzet penjualan</span><strong>${money(r.revenue)}</strong></div>
        <div class="list-item"><span class="muted small">HPP barang terjual</span><strong>− ${money(r.cogs)}</strong></div>
        <div class="list-item"><span class="muted small">Laba kotor</span><strong>${money(r.grossProfit)}</strong></div>
        <div class="list-item"><span class="muted small">Biaya operasional</span><strong>− ${money(r.operatingExpenses)}</strong></div>
        <div class="list-item"><span class="strong small">Laba bersih</span><strong>${money(r.netProfit)}</strong></div>
      </div>`)}
      ${card("Posisi kas tunai", `<div class="metric-value" style="font-size:25px">${money(cashAvailable())}</div><p class="field-help">Kas awal + penjualan tunai − pengeluaran tunai − pembelian stok tunai. Penerimaan QRIS/transfer tidak termasuk saldo ini.</p><div class="divider"></div><div class="row"><span class="muted small">Penjualan non-tunai bulan ini</span><strong>${money(nonCashSales)}</strong></div><p class="field-help">Saldo rekening/QRIS belum direkonsiliasi dengan biaya non-tunai. Ini bukan laporan arus kas bank.</p>`)}
    </div>
    <div style="height:13px"></div>
    ${card("Transaksi terbaru", recentSales.length ? `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Produk</th><th>Pembayaran</th><th class="num">Omzet</th><th class="num">HPP</th></tr></thead><tbody>${recentSales.map(s=>`<tr><td>${formatDate(s.date)}</td><td>${esc(s.items.map(i=>`${i.qty}× ${i.name}`).join(", "))}</td><td>${esc(s.paymentMethod)}</td><td class="num">${money(s.total)}</td><td class="num">${money(s.cogs)}</td></tr>`).join("")}</tbody></table></div>` : emptyState("Belum ada transaksi","Laporan akan terisi setelah transaksi kasir disimpan."))}
  `;
}

function renderSettings() {
  return `
    ${pageHeading("Preferensi & data", "Pengaturan", "Atur nama usaha, saldo kas awal, dan kelola salinan data lokal.")}
    <div class="grid-two">
      <section class="card card-pad">
        <div class="card-head"><h2>Profil usaha</h2></div>
        <form id="settings-form" class="stack">
          <div class="field"><label>Nama usaha</label><input name="businessName" maxlength="60" value="${esc(state.settings.businessName || "")}" required></div>
          <div class="field"><label>Kas tunai awal (Rp)</label><input name="openingCash" type="number" step="1" min="0" value="${Number(state.settings.openingCash || 0)}" required><span class="field-help">Isi saldo kas tunai saat mulai memakai aplikasi. Jangan masukkan saldo QRIS atau rekening di sini.</span></div>
          <button class="btn full" type="submit">Simpan pengaturan</button>
        </form>
      </section>
      <section class="card card-pad">
        <div class="card-head"><h2>Cadangan data</h2><span class="badge">Lokal</span></div>
        <p class="subtitle">Ekspor salinan data secara berkala. File backup berisi data usaha; simpan di tempat pribadi dan jangan bagikan sembarangan.</p>
        <div class="stack" style="margin-top:13px">
          <button class="btn full" data-action="export-backup">Unduh backup JSON</button>
          <label class="btn secondary full" for="backup-file">Pulihkan dari backup JSON</label>
          <input id="backup-file" class="hidden" type="file" accept="application/json,.json">
        </div>
        <div class="divider"></div>
        <div class="settings-row"><span class="small muted">Penyimpanan</span><strong class="small">${dbAvailable ? "IndexedDB" : "Mode cadangan browser"}</strong></div>
        <div class="settings-row"><span class="small muted">Sinkronisasi cloud</span><span class="badge warn">Belum tersedia</span></div>
        <p class="field-help" style="margin-top:10px">Versi ini menyimpan data di perangkat/browser ini. Menghapus data browser atau mengganti perangkat dapat menghilangkan data jika belum dicadangkan.</p>
      </section>
    </div>
    <div style="height:13px"></div>
    ${card("Batasan prototype", `<ul class="small muted" style="padding-left:18px;line-height:1.7;margin:0"><li>Belum ada akun pengguna atau sinkronisasi antarperangkat.</li><li>Belum ada retur, diskon, pajak, hutang, payroll, atau rekonsiliasi QRIS/bank.</li><li>Stok bahan bisa menjadi minus jika penjualan melebihi stok; aplikasi tidak memblokir transaksi.</li><li>HPP transaksi lama disimpan sebagai snapshot dan tidak berubah ketika harga bahan diperbarui.</li></ul>`)}
  `;
}

function render() {
  const app = $("#app");
  const views = {
    dashboard: renderDashboard,
    cashier: renderCashier,
    products: renderProducts,
    stock: renderStock,
    expenses: renderExpenses,
    reports: renderReports,
    settings: renderSettings
  };
  app.innerHTML = `${desktopTabs()}${(views[activePage] || renderDashboard)()}`;
  $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === activePage));
  updateConnectionStatus();
}

function setPage(page) {
  activePage = page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function commit(nextState, message) {
  try {
    await saveState(nextState);
    render();
    if (message) toast(message);
    return true;
  } catch (err) {
    toast(err.message || "Gagal menyimpan data.", "error");
    return false;
  }
}

async function handleSale(form) {
  const lines = Object.entries(cart).map(([id, qty]) => ({ product: productById(id), qty: Number(qty) })).filter(x => x.product && x.qty > 0);
  if (!lines.length) return toast("Keranjang masih kosong.", "error");
  const next = cloneState();
  const paymentMethod = new FormData(form).get("paymentMethod");
  const saleItems = [];
  let total = 0, cogs = 0, allComplete = true;
  for (const line of lines) {
    const product = productById(line.product.id, next);
    const cost = productCost(product, next);
    const lineRevenue = Number(product.price) * line.qty;
    const lineCogs = cost.cost * line.qty;
    total += lineRevenue;
    cogs += lineCogs;
    if (!cost.complete) allComplete = false;
    saleItems.push({
      productId: product.id, name: product.name, qty: line.qty, unitPrice: Number(product.price),
      unitCogs: cost.cost, revenue: lineRevenue, cogs: lineCogs, costComplete: cost.complete
    });
    for (const recipeLine of (product.recipe || [])) {
      const ingredient = ingredientById(recipeLine.ingredientId, next);
      if (!ingredient) continue;
      const used = Number(recipeLine.qty) * line.qty;
      ingredient.stockQty = Number(ingredient.stockQty) - used;
      next.stockMovements.push({
        id: uid(), ingredientId: ingredient.id, type: "sale", qtyDelta: -used,
        unitCost: Number(ingredient.avgUnitCost || 0), totalCost: used * Number(ingredient.avgUnitCost || 0),
        paymentMethod: paymentMethod, date: todayISO(), note: `Pemakaian untuk ${product.name}`
      });
    }
  }
  next.sales.push({
    id: uid(), date: todayISO(), paymentMethod, items: saleItems, total, cogs,
    grossProfit: total - cogs, costComplete: allComplete
  });
  next.demo = false;
  const saved = await commit(next, null);
  if (saved) {
    cart = {};
    render();
    toast(`Transaksi tersimpan · ${money(total)}`);
  }
}

async function handleProduct(form) {
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  const price = Number(fd.get("price"));
  const recipeRows = $$("#recipe-rows .recipe-row");
  const recipe = recipeRows.map(row => ({
    ingredientId: $("select[name='recipeIngredient']", row)?.value,
    qty: Number($("input[name='recipeQty']", row)?.value)
  })).filter(x => x.ingredientId && x.qty > 0);
  if (!name || !Number.isFinite(price) || price <= 0) return toast("Nama dan harga jual harus diisi dengan benar.", "error");
  if (!recipe.length) return toast("Tambahkan minimal satu bahan resep.", "error");
  const next = cloneState();
  next.products.push({ id: uid(), name, price, active: true, recipe, createdAt: todayISO() });
  next.demo = false;
  await commit(next, "Produk berhasil ditambahkan.");
}

async function handleIngredient(form) {
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  const unit = String(fd.get("unit") || "g");
  if (!name) return toast("Nama bahan wajib diisi.", "error");
  if (state.ingredients.some(i => i.name.toLowerCase() === name.toLowerCase())) return toast("Nama bahan sudah ada.", "error");
  const next = cloneState();
  next.ingredients.push({ id: uid(), name, unit, stockQty: 0, avgUnitCost: 0, minStock: 0 });
  next.demo = false;
  await commit(next, "Bahan berhasil ditambahkan.");
}

async function handleStock(form) {
  const fd = new FormData(form);
  const ingredientId = String(fd.get("ingredientId") || "");
  const qty = Number(fd.get("qty"));
  const totalCost = Number(fd.get("totalCost"));
  const paymentMethod = String(fd.get("paymentMethod") || "Tunai");
  if (!(qty > 0) || !(totalCost >= 0)) return toast("Jumlah stok harus lebih dari nol dan biaya tidak boleh negatif.", "error");
  const next = cloneState();
  const ingredient = ingredientById(ingredientId, next);
  if (!ingredient) return toast("Bahan tidak ditemukan.", "error");
  const oldQty = Number(ingredient.stockQty);
  const oldUnitCost = Number(ingredient.avgUnitCost || 0);
  const newUnitCost = totalCost / qty;
  const newQty = oldQty + qty;
  // Negative stock represents unrecorded prior usage; do not let it distort the purchase average.
  ingredient.avgUnitCost = oldQty > 0 && newQty > 0
    ? ((oldQty * oldUnitCost) + totalCost) / newQty
    : newUnitCost;
  ingredient.stockQty = newQty;
  next.stockMovements.push({
    id: uid(), ingredientId, type: "purchase", qtyDelta: qty, unitCost: newUnitCost,
    totalCost, paymentMethod, date: todayISO(), note: "Pembelian bahan"
  });
  next.demo = false;
  await commit(next, "Stok masuk berhasil dicatat.");
}

async function handleExpense(form) {
  const fd = new FormData(form);
  const description = String(fd.get("description") || "").trim();
  const amount = Number(fd.get("amount"));
  const paymentMethod = String(fd.get("paymentMethod") || "Tunai");
  if (!description || !(amount > 0)) return toast("Keperluan dan jumlah pengeluaran wajib diisi.", "error");
  const next = cloneState();
  next.expenses.push({ id: uid(), description, amount, paymentMethod, date: todayISO(), category: "operasional" });
  next.demo = false;
  await commit(next, "Pengeluaran berhasil dicatat.");
}

async function handleSettings(form) {
  const fd = new FormData(form);
  const businessName = String(fd.get("businessName") || "").trim();
  const openingCash = Number(fd.get("openingCash"));
  if (!businessName || !(openingCash >= 0)) return toast("Periksa nama usaha dan kas awal.", "error");
  const next = cloneState();
  next.settings.businessName = businessName;
  next.settings.openingCash = openingCash;
  await commit(next, "Pengaturan berhasil disimpan.");
}

function addRecipeRow() {
  const container = $("#recipe-rows");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "recipe-row";
  row.innerHTML = `<select name="recipeIngredient">${state.ingredients.map(i=>`<option value="${i.id}">${esc(i.name)} (${esc(i.unit)})</option>`).join("")}</select><input name="recipeQty" type="number" min="0.0001" step="any" placeholder="Takaran"><button type="button" data-action="remove-recipe-row">×</button>`;
  container.appendChild(row);
}

function exportBackup() {
  const payload = { app: "TUMBUH F&B", backupVersion: 1, exportedAt: todayISO(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `tumbuh-fnb-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast("File backup disiapkan. Simpan di tempat aman.");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed.data;
    if (parsed.app !== "TUMBUH F&B" || !data || data.schemaVersion !== 1 ||
        !Array.isArray(data.ingredients) || !Array.isArray(data.products) ||
        !Array.isArray(data.sales) || !Array.isArray(data.expenses) || !Array.isArray(data.stockMovements) ||
        !data.settings) throw new Error("Struktur file tidak dikenali sebagai backup TUMBUH F&B v1.");
    if (!confirm("Pulihkan backup akan mengganti data yang ada di perangkat ini. Lanjutkan?")) return;
    await saveState(data);
    state = data;
    cart = {};
    render();
    toast("Backup berhasil dipulihkan.");
  } catch (err) {
    toast(err.message || "File backup tidak valid.", "error");
  }
}

async function clearDemo() {
  if (!state.demo) return;
  if (!confirm("Hapus seluruh data contoh? Tindakan ini tidak bisa dibatalkan kecuali Anda sudah mengunduh backup.")) return;
  const next = cloneState();
  next.demo = false;
  next.ingredients = [];
  next.products = [];
  next.sales = [];
  next.expenses = [];
  next.stockMovements = [];
  next.settings.openingCash = 0;
  await commit(next, "Data contoh dihapus. Mulai masukkan data usaha sendiri.");
}

document.addEventListener("click", async (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) { setPage(pageButton.dataset.page); return; }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id;
  if (action === "go-settings") setPage("settings");
  if (action === "cart-add") { cart[id] = (cart[id] || 0) + 1; render(); }
  if (action === "cart-minus") { cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; render(); }
  if (action === "cart-clear") { cart = {}; render(); }
  if (action === "add-recipe-row") addRecipeRow();
  if (action === "remove-recipe-row") {
    const rows = $$("#recipe-rows .recipe-row");
    if (rows.length > 1) actionButton.closest(".recipe-row").remove();
    else { $("input", actionButton.closest(".recipe-row")).value = ""; }
  }
  if (action === "export-backup") exportBackup();
  if (action === "clear-demo") await clearDemo();
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.id) return;
  event.preventDefault();
  if (form.id === "sale-form") await handleSale(form);
  if (form.id === "product-form") await handleProduct(form);
  if (form.id === "ingredient-form") await handleIngredient(form);
  if (form.id === "stock-form") await handleStock(form);
  if (form.id === "expense-form") await handleExpense(form);
  if (form.id === "settings-form") await handleSettings(form);
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "backup-file") await importBackup(event.target.files?.[0]);
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

async function boot() {
  try {
    state = await loadState();
    render();
    updateConnectionStatus();
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("./sw.js").catch(() => toast("Cache offline belum aktif. Coba muat ulang saat online.", "error"));
    }
  } catch (err) {
    $("#app").innerHTML = `<div class="notice danger">${esc(err.message)}</div>`;
  }
}
boot();
