-- ============================================
-- KAmesh1 — База данных сотрудников предприятия
-- Postgres 18
-- ============================================

-- Пользователи (авторизация по телефону + логин/пароль)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    login           VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(256) NOT NULL,
    phone           VARCHAR(20) UNIQUE NOT NULL,
    full_name       VARCHAR(256) NOT NULL,
    email           VARCHAR(128),
    avatar_url      TEXT,
    role            VARCHAR(32) NOT NULL DEFAULT 'user',
    department      VARCHAR(128),
    position_title  VARCHAR(128),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Роли: admin — полный доступ к системе
--       operator — ограниченные права (модерация чатов, управление пользователями)
--       user — только чат, конференции, переписка

-- Сессии (refresh-токены)
CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(512) NOT NULL,
    device_info     TEXT,
    ip_address      VARCHAR(45),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_users_login     ON users(login);
CREATE INDEX IF NOT EXISTS idx_users_phone     ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token  ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Сброс паролей (токены и коды)
CREATE TABLE IF NOT EXISTS password_resets (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(256) NOT NULL,
    code            VARCHAR(6) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets(code);

-- ============================================
-- ЧАТЫ
-- ============================================

CREATE TABLE IF NOT EXISTS chats (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(256),
    type            VARCHAR(32) NOT NULL DEFAULT 'direct',
    -- direct — личный чат, group — группой, department — отдел
    description     TEXT,
    avatar_url      TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
    chat_id         INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(32) NOT NULL DEFAULT 'member',
    -- member — участник, admin — админ чата, owner — создатель
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id              BIGSERIAL PRIMARY KEY,
    chat_id         INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id),
    content         TEXT,
    content_type    VARCHAR(32) NOT NULL DEFAULT 'text',
    -- text, image, file, voice, system
    file_url        TEXT,
    file_name       VARCHAR(256),
    file_size       BIGINT,
    mime_type       VARCHAR(128),
    reply_to        BIGINT REFERENCES messages(id),
    is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat      ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_type      ON messages(content_type);

-- ============================================
-- КОНФЕРЕНЦИИ (аудио/видео)
-- ============================================

CREATE TABLE IF NOT EXISTS conferences (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    -- ссылка-приглашение (как в Яндекс.Телемост)
    invite_link     VARCHAR(512) UNIQUE NOT NULL,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    is_recording    BOOLEAN NOT NULL DEFAULT FALSE,
    max_participants INTEGER NOT NULL DEFAULT 100,
    status          VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    -- scheduled, active, finished, cancelled
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conference_participants (
    conference_id   INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(32) NOT NULL DEFAULT 'participant',
    -- participant, presenter — ведущий (демонстрация экрана), admin
    is_muted        BOOLEAN NOT NULL DEFAULT FALSE,
    is_video_on     BOOLEAN NOT NULL DEFAULT TRUE,
    is_screen_sharing BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at         TIMESTAMPTZ,
    PRIMARY KEY (conference_id, user_id)
);

CREATE TABLE IF NOT EXISTS conference_messages (
    id              BIGSERIAL PRIMARY KEY,
    conference_id   INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id),
    content         TEXT,
    content_type    VARCHAR(32) NOT NULL DEFAULT 'text',
    file_url        TEXT,
    file_name       VARCHAR(256),
    file_size       BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conference_msgs ON conference_messages(conference_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conference_participants ON conference_participants(conference_id);

-- ============================================
-- ФАЙЛЫ (общие)
-- ============================================

CREATE TABLE IF NOT EXISTS files (
    id              SERIAL PRIMARY KEY,
    uploader_id     INTEGER NOT NULL REFERENCES users(id),
    original_name   VARCHAR(256) NOT NULL,
    storage_path    TEXT NOT NULL,
    mime_type       VARCHAR(128),
    size_bytes      BIGINT NOT NULL,
    sha256_hash     VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
