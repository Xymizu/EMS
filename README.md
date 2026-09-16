# Employee Management System

Fondasi database V1 untuk Employee Management System. Implementasi saat ini hanya mencakup schema MySQL, migration, dan database integration test sesuai issue #1.

## Kebutuhan

- Node.js 22 atau lebih baru
- MySQL 8.0.16 atau lebih baru; konfigurasi lokal memakai image MySQL 8.4
- XAMPP dengan MariaDB 10.4 dapat dipakai untuk development lokal
- Docker dengan Compose plugin, atau instalasi MySQL lokal

Seluruh tabel memakai InnoDB, character set `utf8mb4`, dan collation `utf8mb4_unicode_ci` agar schema yang sama dapat dijalankan pada MySQL 8 dan MariaDB bawaan XAMPP.

## Konfigurasi

Salin `.env.example` menjadi `.env`. Konfigurasi bawaan cocok untuk XAMPP lokal pada port `3306`, user `root`, dan password kosong. Jika instalasi MySQL Anda memakai password, isi `DB_PASSWORD`. Jangan commit `.env`.

Variabel yang digunakan:

| Variable | Kegunaan |
|---|---|
| `DB_HOST` | Host MySQL |
| `DB_PORT` | Port MySQL |
| `DB_USER` | User MySQL yang boleh membuat database dan tabel |
| `DB_PASSWORD` | Password user MySQL; boleh kosong untuk XAMPP lokal |
| `DB_PASSWORD_IS_EMPTY` | Isi `true` untuk memaksa password kosong, termasuk bila sistem memiliki `DB_PASSWORD` global |
| `DB_NAME` | Database development |
| `TEST_DB_NAME` | Database khusus integration test; harus berbeda dari `DB_NAME` |

## Menjalankan MySQL lokal

Sebagai alternatif XAMPP, setelah `.env` dibuat MySQL 8.4 dapat dijalankan melalui Docker:

```bash
docker compose up -d mysql
```

Tunggu health check MySQL menjadi sehat sebelum menjalankan setup.

## Instalasi dan migration

```bash
npm install
npm run db:setup
npm run db:migrate
```

`db:setup` membuat database development dan test bila belum ada. `db:migrate` membuat tabel dalam urutan `users`, `employees`, `projects`, `project_members`, lalu `tasks`.

Rollback menghapus tabel dalam urutan relasi yang aman:

```bash
npm run db:rollback
```

Migration ini merupakan baseline untuk database kosong. Jika sudah diterapkan, rollback sebelum menjalankannya kembali. Jangan mengedit migration yang sudah digunakan pada environment bersama; buat migration baru untuk perubahan berikutnya.

## Verifikasi

Database test memakai MySQL sungguhan pada `TEST_DB_NAME`. Test akan menghapus dan membuat ulang kelima tabel di database test tersebut.

```bash
npm run test:db
npm run typecheck
npm run lint
```

Jangan arahkan `TEST_DB_NAME` ke database development atau production. Test menolak berjalan bila `TEST_DB_NAME` sama dengan `DB_NAME`.
