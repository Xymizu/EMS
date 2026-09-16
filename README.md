# Employee Management System

Backend V1 Employee Management System dengan schema MySQL dan authentication JWT access token.

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
| `JWT_SECRET` | Secret JWT minimum 32 karakter; gunakan nilai acak dan jangan commit secret asli |
| `JWT_ACCESS_TOKEN_TTL_SECONDS` | Masa berlaku access token dalam detik; contoh `900` |
| `JWT_ISSUER` | Issuer JWT; gunakan `ems-api` |
| `JWT_AUDIENCE` | Audience JWT; gunakan `ems-client` |
| `PORT` | Port HTTP API; default `3000` |

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

## Menjalankan API

Pastikan migration sudah diterapkan dan `JWT_SECRET` pada `.env` berisi nilai acak minimum 32 karakter, kemudian jalankan:

```bash
npm run dev
```

Untuk menjalankan tanpa file watcher:

```bash
npm start
```

### Login

User harus sudah tersedia di tabel `users` dengan `password_hash` bcrypt.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"user-password"}'
```

Response sukses berisi `accessToken`, `tokenType: "Bearer"`, dan `expiresIn`. Credential yang salah selalu menghasilkan pesan generik dan response tidak pernah memuat `password_hash`.

### Current user

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <token>"
```

Endpoint mengembalikan data user beserta employee yang terhubung. Nilai `employee` adalah `null` bila user belum mempunyai employee.

### Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <token>"
```

Logout V1 bersifat stateless. Server tidak menyimpan session atau blacklist; client harus menghapus access token. Token tetap valid secara cryptographic sampai waktu expiration.

## Employee Management

Semua endpoint berikut memerlukan `Authorization: Bearer <token>` dari user dengan role `ADMIN` atau `SUPER_ADMIN`. Role diperiksa dari database pada setiap operasi.

| Method | Endpoint | Kegunaan |
|---|---|---|
| `POST` | `/employees` | Membuat user dan employee |
| `GET` | `/employees` | Melihat daftar employee |
| `GET` | `/employees/:employeeId` | Melihat detail employee |
| `PATCH` | `/employees/:employeeId` | Mengubah sebagian data employee |

### Membuat employee

```bash
curl -X POST http://localhost:3000/employees \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"nama":"Budi Santoso","email":"budi@example.com","password":"Password123!","tanggal_masuk":"2026-09-16","role":"STAFF"}'
```

Pembuatan user dan employee berlangsung dalam satu transaction. Email duplikat menghasilkan `409 EMAIL_ALREADY_EXISTS`; password di-hash dengan bcrypt dan tidak pernah dikirim pada response.

### List dan detail

```bash
curl http://localhost:3000/employees \
  -H "Authorization: Bearer <admin-token>"

curl http://localhost:3000/employees/12 \
  -H "Authorization: Bearer <admin-token>"
```

### Partial update

```bash
curl -X PATCH http://localhost:3000/employees/12 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"nama":"Budi Setiawan","role":"ADMIN"}'
```

Field yang dapat diubah adalah `nama`, `email`, `password`, `tanggal_masuk`, dan `role`. Body kosong menghasilkan `400 VALIDATION_ERROR`. Target yang tidak ada menghasilkan `404 EMPLOYEE_NOT_FOUND`, sedangkan user non-admin mendapat `403 FORBIDDEN`.

Database baru memerlukan provisioning Admin pertama melalui proses operasional/seed tepercaya. API tidak menyediakan endpoint bootstrap tanpa authentication. V1 juga belum mencegah Admin menurunkan role dirinya sendiri atau Admin terakhir.

## Pemeriksaan project

```bash
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
```
