# Employee Management System

Backend V1 Employee Management System dengan schema MySQL dan authentication JWT access token.

## Kebutuhan

- Node.js 22 atau lebih baru
- MySQL 8.0.16 atau lebih baru; konfigurasi lokal memakai image MySQL 8.4
- XAMPP dengan MariaDB 10.4 dapat dipakai untuk development lokal
- Docker dengan Compose plugin, atau instalasi MySQL lokal

Seluruh tabel memakai InnoDB, character set `utf8mb4`, dan collation `utf8mb4_unicode_ci` agar schema yang sama dapat dijalankan pada MySQL 8 dan MariaDB bawaan XAMPP.

## Konfigurasi

Salin `.env.example` menjadi `.env`, lalu ganti seluruh nilai `replace_with_...`. Docker hanya mempublikasikan MySQL ke `127.0.0.1` dan mewajibkan password. Jangan commit `.env`.

Variabel yang digunakan:

| Variable | Kegunaan |
|---|---|
| `DB_HOST` | Host MySQL |
| `DB_PORT` | Port MySQL |
| `DB_USER` | User MySQL yang boleh membuat database dan tabel |
| `DB_PASSWORD` | Password user MySQL; wajib kecuali compatibility mode development |
| `DB_PASSWORD_IS_EMPTY` | Compatibility mode XAMPP lokal; tidak boleh `true` pada production |
| `DB_ADMIN_USER` | User administratif yang hanya digunakan oleh `db:setup` |
| `DB_ADMIN_PASSWORD` | Password user administratif; tidak digunakan runtime API |
| `DB_NAME` | Database development |
| `TEST_DB_NAME` | Database khusus integration test; harus berbeda dari `DB_NAME` |
| `JWT_SECRET` | Secret JWT minimum 32 karakter; gunakan nilai acak dan jangan commit secret asli |
| `JWT_ACCESS_TOKEN_TTL_SECONDS` | Masa berlaku access token dalam detik; contoh `900` |
| `JWT_ISSUER` | Issuer JWT; gunakan `ems-api` |
| `JWT_AUDIENCE` | Audience JWT; gunakan `ems-client` |
| `PORT` | Port HTTP API; default `3000` |
| `TRUST_PROXY` | Isi `true` hanya saat API berada tepat di belakang reverse proxy tepercaya |

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

`db:setup` memakai kredensial admin untuk membuat database development/test dan memberikan akses kepada `DB_USER`. Runtime API hanya memakai `DB_USER`; production menolak user `root` dan password kosong. `db:migrate` membuat tabel dalam urutan `users`, `employees`, `projects`, `project_members`, lalu `tasks`.

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

Untuk membuat dan menjalankan build production tanpa runtime TypeScript:

```bash
npm run build
npm start
```

`GET /health` memeriksa koneksi database dan menghasilkan `200` atau `503`. Proses menangani `SIGINT`/`SIGTERM` dengan menutup HTTP server dan connection pool secara graceful.

Semua endpoint daftar menerima query `limit` (default `50`, maksimum `100`) dan `offset` (default `0`, maksimum `1000000`). Query pagination yang tidak valid menghasilkan `400 VALIDATION_ERROR`.

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

Semua endpoint berikut memerlukan `Authorization: Bearer <token>` dari user dengan role `ADMIN` atau `SUPER_ADMIN`. Role diperiksa dari database pada setiap operasi. Hanya Super Admin yang dapat memberikan role `SUPER_ADMIN`, dan pengguna tidak dapat mengubah role dirinya sendiri.

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

## Project Management

Operasi tulis project memerlukan role `ADMIN` atau `SUPER_ADMIN`. Staff dapat melihat project yang dipimpin atau diikutinya, tetapi project lain disembunyikan.

| Method | Endpoint | Kegunaan |
|---|---|---|
| `POST` | `/projects` | Membuat project dan memilih employee lead |
| `GET` | `/projects` | Melihat seluruh project beserta lead |
| `GET` | `/projects/:projectId` | Melihat detail project |
| `PATCH` | `/projects/:projectId` | Mengganti nama dan/atau lead |
| `DELETE` | `/projects/:projectId` | Menghapus project tanpa dependency |

Contoh membuat project:

```bash
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"nama_project":"Employee Management System","lead_employee_id":"2"}'
```

`lead_employee_id` harus menunjuk employee yang tersedia. Mengubah lead tidak mengubah `project_members`. Project yang masih memiliki member atau task tidak dihapus dan menghasilkan `409 PROJECT_HAS_DEPENDENCIES`.

## Project Members

Admin dan Super Admin dapat mengelola relasi many-to-many antara project dan employee.

| Method | Endpoint | Kegunaan |
|---|---|---|
| `GET` | `/projects/:projectId/members` | Melihat member project |
| `POST` | `/projects/:projectId/members` | Menambahkan satu employee |
| `DELETE` | `/projects/:projectId/members/:employeeId` | Menghapus membership |

```bash
curl -X POST http://localhost:3000/projects/1/members \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"2"}'
```

Project dan employee harus tersedia. Membership duplikat menghasilkan `409 PROJECT_MEMBER_ALREADY_EXISTS`. Lead project dan member yang masih memiliki task dengan status apa pun tidak dapat dihapus. Menghapus membership tidak menghapus employee, project, atau task.

## Task Management

Admin dan Super Admin dapat mengelola seluruh task. Project Lead dapat membuat, melihat, mengubah, dan menghapus task pada project yang dipimpinnya. Staff dapat melihat task yang di-assign kepadanya. Assignee wajib merupakan member dari project task tersebut.

| Method | Endpoint | Kegunaan |
|---|---|---|
| `POST` | `/projects/:projectId/tasks` | Membuat task berstatus `TODO` |
| `GET` | `/projects/:projectId/tasks` | Melihat seluruh task project |
| `GET` | `/tasks/:taskId` | Melihat detail task |
| `PATCH` | `/tasks/:taskId` | Mengubah nama dan/atau assignee |
| `DELETE` | `/tasks/:taskId` | Menghapus task |

```bash
curl -X POST http://localhost:3000/projects/1/tasks \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"nama_task":"Membuat halaman login","assigned_employee_id":"2"}'
```

Employee yang tersedia tetapi bukan project member menghasilkan `400 ASSIGNEE_NOT_PROJECT_MEMBER`. PATCH ini tidak menerima `project_id` atau `status`; perubahan status task mempunyai endpoint dan aturan transisi terpisah.

### Mengubah status task

Assignee dapat mengubah status task miliknya. Project lead dapat mengubah task pada project yang dipimpinnya, sedangkan Admin dan Super Admin dapat mengubah seluruh task.

```bash
curl -X PATCH http://localhost:3000/tasks/7/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
```

Transition yang diperbolehkan:

```text
TODO <-> IN_PROGRESS <-> DONE
```

Transisi langsung `TODO` ke `DONE`, `DONE` ke `TODO`, dan update ke status yang sama menghasilkan `400 INVALID_TASK_STATUS_TRANSITION`. Staff yang bukan assignee dan lead dari project lain menghasilkan `403 FORBIDDEN`.

## Pemeriksaan project

```bash
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
```
