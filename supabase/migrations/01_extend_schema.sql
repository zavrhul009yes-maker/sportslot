-- ============================================================
-- МИГРАЦИЯ 01: Расширение схемы SportSlot
-- ============================================================

-- 1. Справочник видов спорта
CREATE TABLE IF NOT EXISTS public.activities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read activities" ON public.activities FOR SELECT USING (true);

-- 2. Справочник тренеров
CREATE TABLE IF NOT EXISTS public.trainers (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialization TEXT NOT NULL,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read trainers" ON public.trainers FOR SELECT USING (true);

-- 3. FK из records
ALTER TABLE public.records
    ADD COLUMN IF NOT EXISTS activity_id INTEGER REFERENCES public.activities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trainer_id INTEGER REFERENCES public.trainers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_records_user_id ON public.records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_activity_id ON public.records(activity_id);
CREATE INDEX IF NOT EXISTS idx_records_trainer_id ON public.records(trainer_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON public.records(status);

-- 4. История статусов
CREATE TABLE IF NOT EXISTS public.status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    comment TEXT
);

ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of own records"
ON public.status_history FOR SELECT
USING (EXISTS (SELECT 1 FROM public.records WHERE records.id = status_history.record_id AND records.user_id = auth.uid()));

CREATE POLICY "Admins can view all history"
ON public.status_history FOR SELECT
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_status_history_record_id ON public.status_history(record_id);

-- 5. Оценки тренеров
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL UNIQUE REFERENCES public.records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trainer_id INTEGER NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reviews" ON public.reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all reviews" ON public.reviews FOR SELECT USING (public.is_admin());

-- 6. Триггер: запись истории при смене статуса
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.status_history (record_id, old_status, new_status, changed_by, comment)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Изменение через приложение');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_record_status_change ON public.records;
CREATE TRIGGER on_record_status_change
    AFTER UPDATE ON public.records
    FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- 7. Триггер: запись истории при создании
CREATE OR REPLACE FUNCTION public.log_status_create()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.status_history (record_id, old_status, new_status, changed_by, comment)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Запись создана');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_record_status_create ON public.records;
CREATE TRIGGER on_record_status_create
    AFTER INSERT ON public.records
    FOR EACH ROW EXECUTE FUNCTION public.log_status_create();

-- 8. Бизнес-правило: запрет пересечения
CREATE OR REPLACE FUNCTION public.check_slot_available()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM public.records r
    WHERE r.trainer_id = NEW.trainer_id
      AND r.date = NEW.date
      AND r.time_slot = NEW.time_slot
      AND r.status = 'Подтверждена'
      AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Этот слот уже занят у выбранного тренера';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_record_check_slot ON public.records;
CREATE TRIGGER on_record_check_slot
    BEFORE INSERT OR UPDATE ON public.records
    FOR EACH ROW EXECUTE FUNCTION public.check_slot_available();