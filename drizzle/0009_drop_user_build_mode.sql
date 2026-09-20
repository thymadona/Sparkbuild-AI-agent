-- The web course is retired. user_build_mode only ever gated /api/generate
-- (the HTML editor's build mode), which no longer exists.
DROP TABLE "user_build_mode" CASCADE;--> statement-breakpoint
-- class_enabled_lessons was seeded with the web course's ids 1-6 for every
-- class. The Python catalog starts at 101, so these rows enable nothing —
-- clear them so the ids can never re-enable a week by accident.
delete from class_enabled_lessons where lesson_id < 100;
