# PRD — Employee Management System (EMS)
**Versi dokumen:** 1.0
**Pemilik proyek:** Ri (Arif Muhamad Fahri)
**Tujuan dokumen:** Panduan teknis pengembangan pribadi + bukti proses kerja untuk portfolio

---

## 1. Executive Summary

**Problem Statement**
Sebagai developer yang sedang membangun kemampuan fullstack menuju level intermediate–advanced, belum ada proyek nyata yang mencakup siklus lengkap dari CRUD dasar hingga production engineering (testing, deployment, observability) dengan business logic yang cukup kompleks untuk merefleksikan pekerjaan mid-level sungguhan.

**Proposed Solution**
Membangun EMS (Employee Management System) — aplikasi internal untuk mengelola user, employee, project, task, RBAC, kolaborasi, dan reporting — dikembangkan bertahap dalam 5 versi (V1–V5), di mana setiap konsep teknis baru diperkenalkan karena ada kebutuhan nyata dari versi sebelumnya, bukan ditambahkan secara arbitrer.

**Success Criteria**
- V1–V5 selesai diimplementasikan dan dapat didemokan end-to-end (login → task selesai → report → deploy).
- Setiap versi memiliki test coverage untuk flow inti (≥ 70% pada service/business-logic layer di V5).
- Aplikasi berjalan di lingkungan production-like: containerized (Docker), berjalan di belakang reverse proxy dengan HTTPS, memiliki health check dan logging.
- Dokumentasi teknis (arsitektur, trade-off, dan alasan keputusan) tersedia untuk tiap versi sebagai bahan portfolio/interview.
- Dashboard reporting V4 mampu menampilkan agregasi project & task dengan waktu query < 500ms pada dataset uji ~10.000 baris task.

---

## 2. User Experience & Functionality

### 2.1 User Personas

| Persona | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Staff / Employee** | Karyawan biasa, anggota satu atau lebih project | Melihat & mengerjakan task miliknya, update status, upload file, diskusi |
| **Lead / Reviewer** | Memimpin project atau tim department, punya wewenang assign & review | Assign task, review/approve pekerjaan, lihat progress project |
| **Admin** | Mengelola data organisasi (employee, department, project) | CRUD data master, atur akses, kelola project |
| **Manager / Super Admin** | Melihat kondisi lintas department, mengambil keputusan | Dashboard, reporting, workload, performance department/project |

### 2.2 User Stories & Acceptance Criteria

#### V1 — Core EMS
- **Sebagai** Staff, **saya ingin** login dengan email & password, **agar** saya bisa mengakses task saya.
 - AC: Login gagal menampilkan pesan error yang jelas tanpa membocorkan apakah email atau password yang salah.
 - AC: Session/token tervalidasi di setiap request terproteksi.
- **Sebagai** Admin, **saya ingin** membuat dan mengedit data employee, **agar** data organisasi selalu akurat.
 - AC: Field wajib divalidasi (nama, email unik, tanggal masuk).
- **Sebagai** Lead, **saya ingin** membuat project dan menambahkan member, **agar** tim tahu siapa mengerjakan apa.
 - AC: Satu project punya tepat satu lead; member bisa lebih dari satu.
- **Sebagai** Staff, **saya ingin** mengubah status task saya, **agar** progres pekerjaan terlihat oleh tim.
 - AC: Hanya assignee, lead, atau admin/super admin yang bisa mengubah status task tersebut (sesuai tabel akses V1).

#### V2 — Organization & RBAC
- **Sebagai** Super Admin, **saya ingin** mendefinisikan department, position, level, dan permission granular, **agar** hak akses mencerminkan struktur organisasi nyata.
 - AC: Permission dicek di authorization middleware (hak umum) dan di service/policy layer (aturan bisnis kontekstual) — dua lapis, bukan satu.
 - AC: Contoh kasus wajib lulus: user dengan permission `project.delete` tetap ditolak menghapus project berstatus `approved`.
- **Sebagai** Lead Design, **saya ingin** bisa assign task tanpa menjadi Admin sistem, **agar** wewenang operasional terpisah dari wewenang administratif aplikasi.

#### V3 — Collaboration & Workflow
- **Sebagai** Designer, **saya ingin** upload hasil desain dan mendapat review dari Lead, **agar** ada siklus revisi yang terlacak.
 - AC: Alur status: `Uploaded → In Review → Revision Requested → Re-review → Approved`, setiap transisi tercatat di activity history.
- **Sebagai** anggota project, **saya ingin** mendapat notifikasi saat ada comment/assignment baru, **agar** saya tidak ketinggalan update.
- **Sebagai** siapa pun, **saya ingin** melihat riwayat aktivitas (audit trail) pada task/project, **agar** ada transparansi & akuntabilitas.

#### V4 — Reporting & Dashboard
- **Sebagai** Manager, **saya ingin** melihat dashboard progress per department/project, **agar** saya bisa mengambil keputusan cepat.
 - AC: Dashboard bisa difilter berdasarkan periode, employee, department, project, dan status.
 - AC: Query reporting tidak menurunkan performa query operasional (dipisah bila perlu).
- **Sebagai** Lead, **saya ingin** melihat workload tiap anggota tim, **agar** distribusi task lebih adil.

#### V5 — Production Engineering
- **Sebagai** developer, **saya ingin** seluruh flow inti tertutup oleh automated test, **agar** perubahan kode tidak merusak fitur yang sudah ada.
- **Sebagai** operator sistem, **saya ingin** aplikasi ter-containerized dan punya CI/CD pipeline, **agar** deployment konsisten dan repeatable.
- **Sebagai** operator sistem, **saya ingin** ada logging, monitoring, dan health check, **agar** masalah production bisa terdeteksi sebelum berdampak besar ke user.
- **Sebagai** user, **saya ingin** proses generate report berat berjalan di background (queue/worker), **agar** aplikasi tetap responsif.
 - AC: Flow `POST /reports` → job dibuat → masuk queue → worker proses → hasil disimpan di object storage → status `COMPLETED` → user bisa mengambil hasil.

### 2.3 Non-Goals
- **Bukan** aplikasi payroll/penggajian — di luar scope EMS ini.
- **Bukan** aplikasi absensi/attendance dengan integrasi hardware (fingerprint, GPS check-in).
- **Bukan** multi-tenant SaaS — EMS ini didesain untuk satu organisasi/perusahaan saja.
- Realtime update (WebSocket/SSE) di V3 bersifat opsional, hanya diimplementasikan jika ada kebutuhan nyata yang teridentifikasi, bukan default.
- Mobile app native tidak termasuk scope; frontend cukup web responsive.
- Teknologi seperti Redis, queue, atau load balancer di V5 **tidak** dipakai hanya karena tersedia — hanya ketika ada masalah nyata yang mereka selesaikan (prinsip roadmap).

---

## 3. AI System Requirements

Tidak berlaku (Not Applicable) — EMS adalah sistem manajemen operasional konvensional tanpa komponen AI/LLM pada V1–V5. Bagian ini disiapkan sebagai placeholder bila fitur seperti *smart task suggestion* atau *auto-summarize report* ditambahkan di versi mendatang.

---

## 4. Technical Specifications

### 4.1 Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js + Express.js (V1–V2), migrasi/evaluasi ke NestJS seiring kompleksitas RBAC & modularitas bertambah (V2 ke atas) |
| Frontend | React |
| Database | Relational (PostgreSQL/MySQL — **TBD**, pilih satu di awal V1) |
| Auth | Email/password + token-based session (JWT — **TBD** detail implementasi) |
| Cache | Redis — baru dipakai di V5 jika ada query yang terbukti mahal/sering dipanggil |
| Queue/Worker | **TBD** (mis. BullMQ di atas Redis) — untuk async job seperti report generation di V5 |
| Object Storage | **TBD** (mis. S3-compatible) — untuk attachment (V3) dan hasil report (V5) |
| Container | Docker |
| CI/CD | **TBD** (mis. GitHub Actions) |
| Monitoring | **TBD** (mis. Prometheus/Grafana atau layanan managed) |

### 4.2 Data Model (V1 baseline)

```
USER (user_id PK, nama, email, password_hash)
EMPLOYEE (employee_id PK, user_id FK -> USER, role, tanggal_masuk)
PROJECT (project_id PK, nama_project, lead_employee_id FK -> EMPLOYEE)
PROJECT_MEMBER (project_id FK, employee_id FK)
TASK (task_id PK, nama_task, project_id FK -> PROJECT, assigned_employee_id FK -> EMPLOYEE, status)
```

Relasi utama:
- USER–EMPLOYEE: 1:1
- EMPLOYEE–PROJECT (lead): 1:N
- EMPLOYEE–PROJECT (member): N:M
- PROJECT–TASK: 1:N
- EMPLOYEE–TASK: 1:N (V1: satu task satu assignee)

Model ini diperluas bertahap di V2 (department, position, level, permission), V3 (comment, attachment, notification, activity_log), dan V4 (view/aggregation untuk reporting) — bukan didefinisikan penuh di awal, mengikuti prinsip *requirement-driven*.

### 4.3 Architecture Overview

**Authorization Flow (dari V2 dan seterusnya):**
```
REQUEST
 → Authentication Middleware ("siapa user ini?")
 → Authorization Middleware ("punya permission umum?")
 → Controller (baca request, panggil proses)
 → Service/Policy (cek aturan bisnis kontekstual)
 → Model/Repository → Database
 → Response
```
Dua lapis otorisasi ini disengaja: middleware menangani cek permission generik, sedangkan service layer menangani aturan bisnis yang bergantung pada state data (contoh: project `approved` tidak bisa dihapus meski user punya permission `project.delete`).

**Async Flow (V5):**
```
POST /reports → API membuat job → Queue → Worker ambil job
→ Generate report → Simpan ke Object Storage → status = COMPLETED
→ user mengambil hasil
```

Arsitektur secara keseluruhan tetap **modular monolith** dengan satu relational database — microservice, message broker kompleks, atau load balancer multi-instance **tidak** menjadi target default, sesuai prinsip "teknologi dipakai karena ada masalah yang diselesaikan, bukan karena tersedia."

### 4.4 Integration Points
- REST API internal antara frontend React dan backend Express/NestJS.
- Object storage API (V3, V5) untuk file attachment dan hasil report.
- Queue system (V5) untuk background job.
- Tidak ada integrasi pihak ketiga eksternal (payment, email provider, dsb.) yang didefinisikan di scope ini — **TBD** jika notification email dibutuhkan di V3.

### 4.5 Security & Privacy
- Password disimpan sebagai hash (bukan plaintext) — algoritma **TBD** (mis. bcrypt/argon2).
- Rate limiting pada endpoint auth (V5).
- Validasi input di setiap layer (controller & service) untuk mencegah injection dan data korup.
- Secret/env management terpisah dari kode (V5) — tidak ada credential hardcoded.
- Audit trail (V3) mencatat siapa melakukan apa dan kapan, untuk akuntabilitas dan investigasi insiden.
- HTTPS/TLS wajib di environment production (V5).

---

## 5. V1 Detailed Specification

### 5.1 Functional Requirements

**AUTH**
| ID | Requirement |
|---|---|
| FR-AUTH-001 | User dapat login menggunakan email dan password. |
| FR-AUTH-002 | User yang belum terautentikasi tidak dapat mengakses protected resource. |
| FR-AUTH-003 | User dapat logout. |
| FR-AUTH-004 | Sistem dapat mengetahui user yang sedang login beserta employee yang terhubung dengannya. |

**EMPLOYEE**
| ID | Requirement |
|---|---|
| FR-EMP-001 | Admin dapat membuat employee. |
| FR-EMP-002 | Admin dapat melihat daftar employee. |
| FR-EMP-003 | Admin dapat melihat detail employee. |
| FR-EMP-004 | Admin dapat mengedit employee. |
| FR-EMP-005 | Email user harus unik. |

**PROJECT**
| ID | Requirement |
|---|---|
| FR-PROJ-001 | Admin dapat membuat project. |
| FR-PROJ-002 | Project memiliki satu Lead. |
| FR-PROJ-003 | Admin dapat menambahkan employee sebagai project member. |
| FR-PROJ-004 | Admin dapat menghapus member dari project. |
| FR-PROJ-005 | Employee dapat melihat project yang dia ikuti. |
| FR-PROJ-006 | Satu employee dapat mengikuti lebih dari satu project. |

**TASK**
| ID | Requirement |
|---|---|
| FR-TASK-001 | Admin/Lead dapat membuat task dalam project. |
| FR-TASK-002 | Task harus terhubung ke satu project. |
| FR-TASK-003 | Task dapat diberikan kepada satu employee. |
| FR-TASK-004 | Employee hanya dapat melihat task yang memang boleh dia akses. |
| FR-TASK-005 | Assignee dapat mengubah status task miliknya. |
| FR-TASK-006 | Status task V1: `TODO → IN_PROGRESS → DONE` |

### 5.2 Business Rules

| ID | Rule |
|---|---|
| BR-001 | Setiap User hanya boleh terhubung dengan satu Employee. |
| BR-002 | Setiap Project wajib memiliki satu Lead. |
| BR-003 | Lead harus merupakan Employee aktif. |
| BR-004 | Employee tidak boleh menjadi member Project yang sama lebih dari sekali. |
| BR-005 | Task hanya boleh diberikan kepada Employee yang merupakan member Project tersebut. |
| BR-006 | Staff hanya boleh mengubah Task yang di-assign kepadanya. |
| BR-007 | Lead boleh membuat dan assign Task pada Project yang dipimpinnya. |
| BR-008 | Admin dapat mengelola Employee dan Project. |
| BR-009 | Super Admin memiliki administrative access yang lebih tinggi daripada Admin. |
| BR-010 | Task `DONE` tidak dapat kembali ke `TODO` secara langsung. |

**BR-010 — State Transition Task**

Allowed:
```
TODO         → IN_PROGRESS
IN_PROGRESS  → TODO
IN_PROGRESS  → DONE
DONE         → IN_PROGRESS
```

Not allowed:
```
TODO → DONE
DONE → TODO
```

**Contoh alur request → response (BR-010):**
```
PATCH /tasks/17/status   (DONE → TODO)

Middleware  : punya akses task.update? → YES
Controller  : "user mau mengubah task 17 menjadi TODO"
Service     : status sekarang DONE, target TODO
              business rule: DONE → TODO tidak diperbolehkan
              → TOLAK
```
Alur ini menunjukkan bagaimana satu business rule diterjemahkan langsung menjadi keputusan di service layer — bukan di controller atau middleware.

### 5.3 Edge Cases

| ID | Kasus | Response |
|---|---|---|
| EC-001 | Login menggunakan credential salah | `401 Unauthorized` |
| EC-002 | Membuat User dengan email yang sudah digunakan | `409 Conflict` |
| EC-003 | Mengakses Employee yang tidak ada | `404 Not Found` |
| EC-004 | Menambahkan Employee yang sudah menjadi Project Member | `409 Conflict` |
| EC-005 | Assign Task kepada Employee yang bukan Project Member | `400 Bad Request` |
| EC-006 | Menghapus Project Member yang masih memiliki Task aktif | Request ditolak |
| EC-007 | Menghapus Lead dari Project Member | Request ditolak sampai Lead diganti |
| EC-008 | Staff mencoba mengubah Task employee lain | `403 Forbidden` |
| EC-009 | Project ID tidak ditemukan | `404 Not Found` |
| EC-010 | Status transition tidak valid | `400 Bad Request` |

**Panduan status code:**
- `400` → request/aturan tidak valid
- `401` → belum terautentikasi
- `403` → tahu siapa usernya, tapi tidak boleh
- `404` → resource tidak ada
- `409` → konflik dengan state/data yang sudah ada

### 5.4 API Contract

```
AUTH
POST   /auth/login
POST   /auth/logout
GET    /auth/me

EMPLOYEE
GET    /employees
GET    /employees/:employeeId
POST   /employees
PATCH  /employees/:employeeId

PROJECT
GET    /projects
GET    /projects/:projectId
POST   /projects
PATCH  /projects/:projectId
DELETE /projects/:projectId

PROJECT MEMBER
GET    /projects/:projectId/members
POST   /projects/:projectId/members
DELETE /projects/:projectId/members/:employeeId

TASK
GET    /projects/:projectId/tasks
GET    /tasks/:taskId
POST   /projects/:projectId/tasks
PATCH  /tasks/:taskId
PATCH  /tasks/:taskId/status
```
*JSON response per endpoint belum didetailkan — akan dilengkapi saat masuk fase API design.*

### 5.5 Data Constraints

**USER**
- `user_id` → PK, NOT NULL
- `email` → NOT NULL, UNIQUE
- `password_hash` → NOT NULL

**EMPLOYEE**
- `employee_id` → PK
- `user_id` → FK USER, UNIQUE, NOT NULL
- `tanggal_masuk` → NOT NULL

**PROJECT**
- `project_id` → PK
- `nama_project` → NOT NULL
- `lead_employee_id` → FK EMPLOYEE, NOT NULL

**PROJECT_MEMBER**
- `project_id` → FK PROJECT
- `employee_id` → FK EMPLOYEE
- `UNIQUE(project_id, employee_id)` — implementasi database dari **BR-004** (employee tidak boleh jadi member project yang sama dua kali)

**TASK**
- `task_id` → PK
- `project_id` → FK PROJECT, NOT NULL
- `assigned_employee_id` → FK EMPLOYEE
- `status` → NOT NULL, default `TODO`

Prinsip yang berlaku di sini: `Business Rule → Database Constraint` — beberapa business rule diperkuat langsung di level database, bukan hanya di service layer.

### 5.6 Definition of Done — V1

V1 dianggap selesai ketika:

- [ ] User dapat login/logout
- [ ] Protected endpoint membutuhkan authentication
- [ ] Admin dapat create/read/update Employee
- [ ] Admin dapat membuat Project
- [ ] Project memiliki Lead
- [ ] Employee dapat ditambahkan sebagai Project Member
- [ ] Lead/Admin dapat membuat Task
- [ ] Task dapat di-assign ke Project Member
- [ ] Staff dapat melihat Task miliknya
- [ ] Staff dapat mengubah status Task miliknya
- [ ] Authorization Staff/Admin/Super Admin bekerja
- [ ] Business Rules V1 diterapkan
- [ ] Edge Cases utama menghasilkan response yang benar
- [ ] Database relationship dan constraints bekerja
- [ ] API dapat diuji end-to-end
- [ ] README menjelaskan cara menjalankan V1

Begitu semua checklist di atas tercentang → **V1.0.0 ✅ — STOP.**

Jangan menambahkan hal-hal berikut ke V1, meskipun tergoda — semuanya masuk versi berikutnya:
- ~~"sekalian notification deh"~~ → V3
- ~~"sekalian Redis"~~ → V5
- ~~"sekalian department"~~ → V2
- ~~"sekalian WebSocket"~~ → V3 (opsional)

---

## 6. Risks & Roadmap

### 6.1 Phased Rollout

| Versi | Fokus | Karakter |
|---|---|---|
| **V1** | Core EMS — auth, employee, project, task, basic role | Junior-level: fondasi fullstack, CRUD, auth, API, relational DB |
| **V2** | Organization & RBAC — department, position, level, permission, authorization flow | Junior–Intermediate: business rules & authorization |
| **V3** | Collaboration — workflow, approval, comment, file, notification, activity history | Intermediate: business logic kompleks, state transitions |
| **V4** | Reporting — dashboard, aggregation, workload, performance | Intermediate: query optimization, aggregation |
| **V5** | Production Engineering — testing, Docker, CI/CD, cache, queue, storage, monitoring | Intermediate–Advanced: operational concerns |

### 6.2 Technical Risks

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scope creep — menambah fitur di luar kebutuhan versi berjalan | Timeline molor, kompleksitas tak perlu | Disiplin pada prinsip "teknologi dipakai karena ada masalah nyata", tunda fitur yang belum perlu ke versi berikutnya |
| Perpindahan Express → NestJS di tengah jalan (V2) menambah overhead refactor | Waktu terbuang untuk migrasi, bukan fitur | Evaluasi di akhir V1: putuskan pindah ke NestJS sebelum V2 dimulai, bukan di tengah V2 |
| Business logic RBAC (V2) makin kompleks seiring bertambahnya permission | Bug otorisasi, celah keamanan | Test khusus untuk authorization (unit + integration) sebelum lanjut ke V3 |
| Desain workflow approval (V3) berubah-ubah tanpa state machine yang jelas | Bug status task/project, data tidak konsisten | Definisikan state transition diagram eksplisit sebelum implementasi |
| Query reporting (V4) memperlambat operational query | Performa aplikasi turun | Pisahkan reporting query dari operational query bila terbukti bermasalah; index baru ditambah berdasarkan data, bukan asumsi |
| Menambahkan Redis/queue/worker (V5) sebelum ada bottleneck nyata | Kompleksitas operasional tanpa manfaat terukur | Introduce hanya setelah profiling menunjukkan kebutuhan nyata |
| Solo developer, tanpa deadline tetap | Proyek berlarut-larut tanpa penyelesaian | Tetapkan target selesai per versi (mis. checkpoint bulanan) meski pace tetap santai |

---

## Prinsip Pengembangan (dipertahankan di setiap versi)

```
Requirement → Data → Flow → API → Business Logic → Database
→ Failure Modes → Security → Tests → Deployment → Observability

Problem → pahami penyebab → pilih solusi → implement → ukur → refactor
```
