-- ============================================================
-- Проверочные SQL-запросы к базе данных SportSlot
-- ============================================================

-- ============================================================
-- 1. WHERE: активные записи одного пользователя
-- ============================================================
SELECT id, number, activity, date, time_slot, status
FROM public.records
WHERE status = 'Подтверждена'
ORDER BY created_at DESC;


-- ============================================================
-- 2. ORDER BY: все записи, отсортированные по дате
-- ============================================================
SELECT id, number, activity, date, time_slot, status
FROM public.records
ORDER BY created_at DESC
LIMIT 20;


-- ============================================================
-- 3. JOIN: записи с именами тренеров и видами спорта
-- ============================================================
SELECT
    r.number,
    r.activity,
    r.date,
    r.time_slot,
    r.status,
    p.full_name AS client_name,
    t.full_name AS trainer_name,
    a.name AS activity_name
FROM public.records r
LEFT JOIN public.profiles p ON p.id = r.user_id
LEFT JOIN public.trainers t ON t.id = r.trainer_id
LEFT JOIN public.activities a ON a.id = r.activity_id
ORDER BY r.created_at DESC;


-- ============================================================
-- 4. COUNT: общее количество записей
-- ============================================================
SELECT COUNT(*) AS total_records FROM public.records;


-- ============================================================
-- 5. GROUP BY: количество записей по каждому статусу
-- ============================================================
SELECT
    status,
    COUNT(*) AS count
FROM public.records
GROUP BY status
ORDER BY count DESC;


-- ============================================================
-- 6. Показатель админ-панели: топ-5 популярных видов спорта
-- ============================================================
SELECT
    activity,
    COUNT(*) AS bookings_count,
    COUNT(DISTINCT user_id) AS unique_users
FROM public.records
GROUP BY activity
ORDER BY bookings_count DESC
LIMIT 5;


-- ============================================================
-- ДОПОЛНИТЕЛЬНО: средний рейтинг каждого тренера
-- ============================================================
SELECT
    t.full_name AS trainer,
    t.specialization,
    COUNT(r.id) AS reviews_count,
    ROUND(AVG(r.rating)::numeric, 1) AS avg_rating
FROM public.trainers t
LEFT JOIN public.reviews r ON r.trainer_id = t.id
GROUP BY t.id, t.full_name, t.specialization
ORDER BY avg_rating DESC NULLS LAST;