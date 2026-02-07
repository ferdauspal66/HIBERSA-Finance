# Cara Membuat Icon untuk PWA

Karena tidak bisa generate icon otomatis, gunakan salah satu cara ini:

## Opsi 1: Gunakan Online Tool (PALING MUDAH)

1. Buka: https://favicon.io/favicon-generator/
2. Settings:
   - Text: H
   - Background: #2563eb (biru)
   - Font Family: Arial
   - Font Size: 100
3. Download dan extract
4. Rename file yang dibutuhkan:
   - android-chrome-192x192.png → icon-192.png
   - android-chrome-512x512.png → icon-512.png
5. Upload kedua file ke folder yang sama dengan index.html

## Opsi 2: Buat Sendiri dengan Canva

1. Buka Canva.com
2. Buat design 512x512 px
3. Background biru (#2563eb)
4. Tambah text "H" warna putih, bold
5. Download sebagai PNG
6. Resize ke 192x192 untuk icon kecil (gunakan https://www.resizepixel.com/)

## Opsi 3: Gunakan Logo Existing

Jika punya logo perusahaan:
1. Resize logo ke 192x192 dan 512x512
2. Rename jadi icon-192.png dan icon-512.png
3. Upload ke folder project

## File yang Dibutuhkan:

- icon-192.png (192x192 pixels)
- icon-512.png (512x512 pixels)

Letakkan di folder yang sama dengan index.html

## Jika Tidak Ada Icon

Aplikasi tetap bisa diinstall sebagai PWA, tapi akan menggunakan icon default browser.
Untuk sementara, bisa skip dulu dan tambahkan icon nanti.