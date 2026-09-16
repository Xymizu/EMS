CREATE TABLE users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (user_id),
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE employees (
  employee_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(32) NOT NULL,
  tanggal_masuk DATE NOT NULL,
  CONSTRAINT pk_employees PRIMARY KEY (employee_id),
  CONSTRAINT uq_employees_user_id UNIQUE (user_id),
  CONSTRAINT chk_employees_role CHECK (role IN ('STAFF', 'ADMIN', 'SUPER_ADMIN')),
  CONSTRAINT fk_employees_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE projects (
  project_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama_project VARCHAR(150) NOT NULL,
  lead_employee_id BIGINT UNSIGNED NOT NULL,
  CONSTRAINT pk_projects PRIMARY KEY (project_id),
  INDEX idx_projects_lead_employee_id (lead_employee_id),
  CONSTRAINT fk_projects_lead_employee
    FOREIGN KEY (lead_employee_id) REFERENCES employees (employee_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE project_members (
  project_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  CONSTRAINT pk_project_members PRIMARY KEY (project_id, employee_id),
  INDEX idx_project_members_employee_id (employee_id),
  CONSTRAINT fk_project_members_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_project_members_employee
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE tasks (
  task_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama_task VARCHAR(200) NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  assigned_employee_id BIGINT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'TODO',
  CONSTRAINT pk_tasks PRIMARY KEY (task_id),
  INDEX idx_tasks_project_id (project_id),
  INDEX idx_tasks_assigned_employee_id (assigned_employee_id),
  CONSTRAINT chk_tasks_status CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  CONSTRAINT fk_tasks_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_tasks_assigned_employee
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (employee_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
