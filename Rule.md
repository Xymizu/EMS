# Implementation Guardrails

Aturan dalam dokumen ini berlaku untuk seluruh implementasi project dan wajib dipatuhi oleh developer maupun AI yang mengerjakan issue.

## Dilarang Mengubah Scope

- Jangan mengubah requirement atau business rule tanpa instruksi.
- Jangan membuat business rule baru berdasarkan asumsi sendiri.
- Jangan mengimplementasikan fitur di luar scope issue.
- Jangan melakukan refactor besar di luar scope issue.
- Jangan mengubah file yang tidak berkaitan dengan issue tanpa alasan yang jelas.
- Jangan mengubah schema database jika requirement fitur tidak membutuhkannya.

Jika requirement ambigu dan keputusan tersebut dapat memengaruhi behaviour produk secara signifikan, tandai sebagai `TBD` atau `Open Question`. Jangan menentukan behaviour produk sendiri.

## Dilarang Mengubah Arsitektur

- Jangan mengganti tech stack yang telah ditentukan.
- Jangan mengganti struktur atau responsibility layer.
- Jangan menambahkan dependency tanpa kebutuhan yang jelas.
- Jangan membuat abstraction, wrapper, helper, utility, atau layer baru yang belum dibutuhkan.
- Jangan membuat file kosong hanya untuk memenuhi struktur folder.

Gunakan existing implementation jika functionality yang dibutuhkan sudah tersedia. Periksa codebase sebelum membuat file, function, schema, helper, atau abstraction baru.

## Batasan Antar-Layer

Route tidak boleh:

- berisi business logic;
- melakukan query database.

Controller tidak boleh:

- melakukan query database secara langsung;
- menjadi tempat business logic utama.

Service tidak boleh:

- bergantung pada Express `req` atau `res`;
- melakukan query Prisma/database secara langsung.

Repository tidak boleh:

- menangani HTTP request/response;
- menentukan business rule.

Validator tidak boleh:

- melakukan query database;
- menentukan business rule yang membutuhkan state database.

Alur utama yang harus dipertahankan:

`Route → Middleware → Controller → Service/Policy → Repository → Database`

Tidak semua layer harus berubah dalam setiap issue. Jangan membuat layer/file tambahan jika fitur tidak membutuhkannya.

## Security Guardrails

- Jangan melewati authentication atau authorization yang diwajibkan.
- Jangan mempercayai role atau permission yang dikirim client.
- Jangan mempercayai ownership, harga, total, status, atau data business-critical lain dari client tanpa validasi backend.
- Jangan hardcode password, JWT secret, API key, token, database credential, atau secret lainnya.
- Jangan menyimpan password dalam plaintext.
- Jangan membocorkan informasi sensitif melalui error response.
- Semua input dari client harus dianggap tidak terpercaya.

## TypeScript & Code Quality

- Jangan menggunakan `any` hanya untuk menghilangkan TypeScript error.
- Jangan menggunakan `@ts-ignore`, `@ts-nocheck`, atau menonaktifkan type checking hanya agar kode lolos.
- Jangan menonaktifkan ESLint/linter rule hanya untuk menghilangkan error.
- Jangan menangkap error lalu mengabaikannya.
- Jangan menduplikasi functionality yang sudah tersedia di codebase.

Jika terdapat type/error yang sulit diselesaikan, cari penyebabnya dan perbaiki sumber masalahnya.

## Testing Guardrails

- Jangan melewati test yang diwajibkan oleh issue.
- Jangan menghapus test agar implementasi lolos.
- Jangan melakukan `.skip`, `.only`, atau menonaktifkan test untuk menyembunyikan failure.
- Jangan mengubah existing test hanya agar implementasi yang salah menjadi lulus.
- Jangan mengurangi assertion atau coverage penting hanya untuk mendapatkan hasil test hijau.
- Business rule utama yang berubah atau ditambahkan harus memiliki test.
- Bug fix harus memiliki regression test jika memungkinkan.

Setelah implementasi:

1. Jalankan test yang relevan.
2. Jalankan seluruh test suite jika memungkinkan.
3. Jalankan TypeScript type-check.
4. Jalankan lint jika tersedia.
5. Verifikasi acceptance criteria issue.

Issue tidak boleh dinyatakan selesai jika verification yang diwajibkan masih gagal.

## Database Guardrails

- Jangan mengubah database schema tanpa kebutuhan requirement.
- Jangan mengedit migration lama yang sudah diterapkan untuk menyamarkan perubahan schema.
- Jangan menghapus data atau constraint hanya agar implementasi lebih mudah.
- Jangan melakukan query database dari controller atau service; gunakan repository.
- Gunakan transaction jika satu business operation membutuhkan beberapa perubahan database yang harus berhasil atau gagal bersama-sama.

## Dependency Guardrails

Sebelum menambahkan package/dependency baru:

1. Periksa apakah functionality sudah tersedia di project.
2. Periksa apakah dapat dilakukan dengan dependency yang sudah digunakan.
3. Pastikan dependency memang diperlukan oleh requirement.

Jangan menambahkan teknologi hanya karena dianggap lebih modern atau lebih advanced.

## Sebelum Menyatakan Issue Selesai

Pastikan:

- requirement terpenuhi;
- business rule terpenuhi;
- edge case yang diwajibkan ditangani;
- authentication/authorization bekerja;
- validation bekerja;
- error handling sesuai;
- test relevan lulus;
- type-check lulus;
- lint lulus jika tersedia;
- tidak ada perubahan di luar scope;
- tidak ada temporary/debug code yang tertinggal;
- acceptance criteria telah diverifikasi.

Laporkan file yang dibuat atau diubah dan hasil verification yang dijalankan.