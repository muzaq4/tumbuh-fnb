# TUMBUH F&B — model data dan aturan hitung v0.1

## 1. Model data lokal

Versi prototype menyimpan satu snapshot aplikasi di IndexedDB (`tumbuh-fnb-local`, object store `appState`). Bentuk data:

- `settings`: nama usaha, kas tunai awal, waktu pembuatan.
- `ingredients[]`: bahan baku, satuan dasar (`g`, `ml`, `pcs`), jumlah stok, biaya rata-rata per satuan dasar.
- `products[]`: nama, harga jual, resep per porsi (`ingredientId`, `qty`).
- `sales[]`: waktu, metode pembayaran, daftar item dan snapshot harga jual/HPP saat transaksi.
- `expenses[]`: biaya operasional, metode pembayaran, waktu.
- `stockMovements[]`: stok awal, pembelian, dan pemakaian bahan akibat penjualan.

Penyimpanan satu snapshot dipilih untuk prototype agar perubahan satu transaksi dapat ditulis sebagai satu operasi lokal. Untuk produksi, model ini perlu dimigrasikan ke object store terpisah dengan indeks dan transaksi atomik multi-store.

## 2. Satuan dan HPP

Semua resep menggunakan satuan dasar bahan yang sama dengan satuan stok:
- Berat: gram (`g`), bukan kilogram.
- Cairan: mililiter (`ml`).
- Barang satuan: buah/unit (`pcs`).

Biaya rata-rata per satuan setelah pembelian stok:

`biaya rata-rata baru = (nilai stok lama + nilai pembelian baru) / (jumlah stok lama + jumlah masuk)`

Jika stok lama nol atau minus, nilai stok lama tidak ditambahkan dalam pembobotan pembelian baru.

HPP satu porsi:

`HPP = Σ (takaran bahan per porsi × biaya rata-rata per satuan bahan)`

Biaya kemasan dapat dimasukkan sebagai bahan dengan satuan `pcs`.

## 3. Snapshot penjualan

Saat transaksi disimpan, aplikasi menyimpan nama produk, jumlah, harga jual, HPP per unit, omzet baris, dan HPP baris. Dengan demikian, perubahan harga bahan atau resep di masa depan tidak mengubah HPP historis transaksi.

`omzet transaksi = Σ (jumlah × harga jual saat transaksi)`

`HPP terjual = Σ (jumlah × HPP per unit saat transaksi)`

`laba kotor = omzet - HPP terjual`

`laba bersih tercatat = omzet - HPP terjual - biaya operasional`

Penjualan produk dengan resep/biaya yang belum lengkap tetap dapat dicatat, tetapi ditandai `costComplete=false`. Laporan memberi peringatan karena laba dapat tampak lebih tinggi daripada kenyataan.

## 4. Persediaan

Saat penjualan disimpan, jumlah bahan dikurangi berdasarkan resep × jumlah terjual. Stok minus tidak memblokir transaksi, tetapi perlu ditinjau. Pembelian bahan menambah stok dan memperbarui biaya rata-rata.

Pembelian bahan baku bukan biaya operasional pada saat pembelian. Biaya tersebut masuk ke HPP saat bahan dikonsumsi untuk produk yang terjual. Ini mencegah pembelian stok dihitung dua kali sebagai beban.

## 5. Kas tunai

`kas tunai tercatat = kas tunai awal + penjualan tunai - pengeluaran operasional tunai - pembelian stok tunai`

Penerimaan QRIS/transfer tidak dimasukkan ke kas tunai. Versi ini belum menghitung saldo rekening/merchant QRIS atau rekonsiliasi biaya administrasinya. Karena itu label yang dipakai adalah **kas tunai tersedia**, bukan total seluruh aset likuid.

## 6. Batasan dan pekerjaan sebelum produksi

- Belum ada retur, pembatalan, diskon, pajak, hutang/piutang, pengambilan pribadi, modal tambahan, atau rekonsiliasi QRIS/bank.
- Belum ada penyesuaian stok rusak/terbuang dan satuan konversi otomatis.
- Belum ada login, enkripsi backup, sinkronisasi cloud, atau multi-perangkat.
- Belum ada audit trail dan migrasi skema otomatis.
- Service worker hanya menyimpan app shell. Data usaha tersimpan di IndexedDB browser, terpisah dari cache.
- Backup JSON harus diuji dan disimpan di tempat aman. Menghapus data browser dapat menghilangkan data lokal.
- Sebelum penggunaan komersial: uji pemulihan backup, uji transaksi saat offline, uji storage quota, validasi impor, aksesibilitas, keamanan, dan pengujian perangkat Android nyata.
