# SportSlot — система бронирования спортивных занятий

Информационная система для записи на спортивные занятия в учебном заведении.

## Назначение

Пользователь выбирает вид спорта, дату, время и тренера, создаёт запись, отслеживает её состояние, оценивает тренера после посещения. Администратор управляет всеми бронированиями, видит аналитику и отзывы.

##  Стек технологий

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend / БД:** Supabase (PostgreSQL + Auth + RLS)
- **Библиотеки:** `@supabase/supabase-js`, `Chart.js`
- **Хостинг:** Render (Static Site)

##  Роли и доступ

### Пользователь
- Регистрация и вход в систему
- Создание записи на занятие
- Просмотр только своих записей (RLS)
- Отмена записи с указанием причины
- Отзыв и оценка тренера после посещения
- Добавление тренеров в избранное
- Личные заметки к записям
- Фильтрация, поиск, сортировка

### Администратор
- Просмотр всех записей всех пользователей
- Отметка «Посещено»
- Отмена любой записи
- Административная панель (6 показателей + 2 диаграммы)
- Просмотр всех отзывов + статистика
- Рейтинг тренеров с распределением оценок
- Фильтр аналитики по периоду и виду спорта

##  Матрица доступа

| Операция | Пользователь | Администратор |
|---|:---:|:---:|
| Просмотр своих записей | ✅ | ✅ |
| Просмотр всех записей | ❌ | ✅ |
| Создание записи | ✅ | ❌ |
| Отмена своей записи | ✅ | ❌ |
| Отмена любой записи | ❌ | ✅ |
| Отметка «Посещено» | ❌ | ✅ |
| Отзыв о занятии | ✅ | ❌ |
| Просмотр всех отзывов | ❌ | ✅ |
| Избранные тренеры | ✅ | ❌ |
| Личные заметки | ✅ | ❌ |
| Административная панель | ❌ | ✅ |
| Смена собственной роли | ❌ | ❌ |

##  Новые функции

1. **История изменения статусов** — таблица `status_history`, автоматическая запись через триггеры при создании и смене статуса.
2. **Отзывы и оценки тренеров** — таблица `reviews`, оценка 1–5 звёзд и текстовый отзыв после посещения.
3. **Избранные тренеры** — таблица `favorites`, звёздочка в карточке тренера, фильтр «Избранные».
4. **Личные заметки к записям** — поле `notes` в `records`, панель заметок в шапке с бейджем-счётчиком.
5. **Расширенный фильтр** — вид спорта + статус + сортировка + поиск.
6. **Административная аналитика** — 6 показателей, 2 диаграммы (Chart.js), фильтр по периоду и виду спорта.
7. **Рейтинг тренеров** — отдельная вкладка с распределением оценок и списком отзывов.

##  Бизнес-правило

**Запрет пересечения по времени.** Нельзя создать запись на слот, который уже занят у выбранного тренера на ту же дату и время.

Реализовано на **двух уровнях**:
- **Клиент** — проверка в `validateForm()` перед отправкой.
- **Сервер (БД)** — триггер `check_slot_available()` в PostgreSQL, блокирует вставку даже при обходе интерфейса.

##  Архитектура

Все запросы к данным проходят через Row Level Security PostgreSQL. Роль пользователя определяется из таблицы `profiles`.

## Figma-прототип

Ссылка на интерактивный прототип: **https://www.figma.com/design/05CXKklgmLXB3eRs45XcIT/%D0%98%D0%A1-%E2%80%93-%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8-%D0%BD%D0%B0-%D1%81%D0%BF%D0%BE%D1%80%D1%82%D0%B8%D0%B2%D0%BD%D0%BE%D0%B5-%D0%B7%D0%B0%D0%BD%D1%8F%D1%82%D0%B8%D0%B5-%E2%80%93-%D0%A4%D0%B0%D0%BC%D0%B8%D0%BB%D0%B8%D1%8F?node-id=1-5&t=YcNfMG4sPx8s2fIU-1**

##  ER-диаграмма

```mermaid
erDiagram
    profiles ||--o{ records : "создаёт"
    profiles ||--o{ reviews : "пишет"
    profiles ||--o{ favorites : "добавляет"
    activities ||--o{ records : "категория"
    trainers ||--o{ records : "ведёт"
    trainers ||--o{ reviews : "получает"
    trainers ||--o{ favorites : "в избранном"
    records ||--o{ status_history : "имеет"
    records ||--|| reviews : "оценивается"

    profiles {
        uuid id PK
        text email
        text full_name
        text role "user / admin"
        timestamptz created_at
    }

    activities {
        serial id PK
        text name UK
        text description
        timestamptz created_at
    }

    trainers {
        serial id PK
        text full_name
        text specialization
        text bio
        timestamptz created_at
    }

    records {
        uuid id PK
        uuid user_id FK
        int activity_id FK
        int trainer_id FK
        int number
        text activity
        text place
        text date
        text time_slot
        text trainer
        text comment
        text status
        text notes
        timestamptz created_at
    }

    status_history {
        uuid id PK
        uuid record_id FK
        text old_status
        text new_status
        uuid changed_by
        timestamptz changed_at
        text comment
    }

    reviews {
        uuid id PK
        uuid record_id FK
        uuid user_id FK
        int trainer_id FK
        int rating "1-5"
        text comment
        timestamptz created_at
    }

    favorites {
        uuid id PK
        uuid user_id FK
        int trainer_id FK
        timestamptz created_at
    }

    