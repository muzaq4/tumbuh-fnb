# Panduan memasang TUMBUH F&B dari HP Android (tanpa coding)

Panduan ini untuk menerbitkan prototype di alamat HTTPS gratis agar bisa diuji sebagai PWA. Tidak perlu laptop dan tidak perlu mengubah kode. GitHub meminta akun; GitHub Pages dapat dipakai pada repository publik tanpa biaya hosting.

## A. Siapkan file
1. Unduh ZIP paket TUMBUH F&B ke HP.
2. Buka aplikasi File / Files di Android.
3. Ekstrak ZIP. Masuk ke folder `TUMBUH-FB`.
4. Pastikan file `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, dan `icon.svg` terlihat.

## B. Buat tempat hosting gratis
1. Buka `https://github.com` di Chrome dan masuk atau buat akun.
2. Tekan tombol `+` → `New repository`.
3. Isi nama repository: `tumbuh-fnb`.
4. Pilih `Public`, lalu buat repository.
5. Di halaman repository, pilih `Add file` → `Upload files`.
6. Pilih semua isi folder `TUMBUH-FB` (file dan dokumen di dalamnya, bukan folder pembungkusnya).
7. Tunggu unggahan selesai, lalu tekan `Commit changes`.
8. Buka `Settings` → `Pages`.
9. Pada bagian Build and deployment, pilih `Deploy from a branch`.
10. Pilih branch `main`, folder `/(root)`, lalu `Save`.
11. Tunggu proses selesai. GitHub akan menampilkan alamat yang berakhiran `github.io/tumbuh-fnb/`.

Tampilan GitHub di HP dapat berbeda. Jika menu sulit ditemukan, aktifkan `Situs desktop` di menu Chrome.

## C. Pasang di Android
1. Buka alamat GitHub Pages tadi di Chrome Android.
2. Tunggu aplikasi tampil dan data contoh muncul.
3. Buka menu Chrome (⋮) → `Tambahkan ke layar utama` atau `Install app` jika tersedia.
4. Jalankan TUMBUH F&B dari ikon layar utama.
5. Muat sekali saat internet aktif sebelum menguji mode pesawat.

## D. Catatan keamanan data
- Data tersimpan di browser/perangkat yang digunakan, bukan otomatis di akun GitHub.
- Jangan hapus data situs/browser sebelum mengekspor backup.
- Lakukan ekspor backup JSON secara berkala dan simpan di tempat aman.
- Jangan masukkan data keuangan sensitif usaha sungguhan sebelum pengujian selesai.
- GitHub Pages hanya meng-host file aplikasi. Tidak ada sinkronisasi cloud pada versi ini.
