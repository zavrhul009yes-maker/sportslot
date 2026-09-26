-- ============================================================
-- МИГРАЦИЯ 02: Тестовые данные
-- ============================================================

INSERT INTO public.activities (name, description) VALUES
('Теннис', 'Большой теннис на корте'),
('Плавание', 'Бассейн 50 метров'),
('Йога', 'Зал восточных практик'),
('Кроссфит', 'Зона свободных весов'),
('Баскетбол', 'Зал №1')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.trainers (full_name, specialization, bio) VALUES
('Игорь Дмитриев', 'Теннис', 'КМС по теннису, 8 лет опыта'),
('Елена Смирнова', 'Плавание', 'Мастер спорта'),
('Ольга Радонежская', 'Йога', 'Сертифицированный инструктор'),
('Александр Волков', 'Кроссфит', 'Тренер по функциональному тренингу'),
('Мария Петрова', 'Баскетбол', 'Тренер женской сборной вуза')
ON CONFLICT DO NOTHING;

UPDATE public.records r SET activity_id = a.id
FROM public.activities a WHERE r.activity = a.name AND r.activity_id IS NULL;

UPDATE public.records r SET trainer_id = t.id
FROM public.trainers t WHERE r.trainer = t.full_name AND r.trainer_id IS NULL;

INSERT INTO public.status_history (record_id, old_status, new_status, comment)
SELECT id, NULL, status, 'Миграция: начальная запись'
FROM public.records
WHERE id NOT IN (SELECT DISTINCT record_id FROM public.status_history);