-- Numeric pace target (seconds per km) for a planned session, derived by the adaptive planner from
-- the runner's own recent average pace. Nullable: runners with no trustworthy recent pace get no
-- target rather than an invented one, and every pre-existing workout keeps NULL.
ALTER TABLE "TrainingWorkout" ADD COLUMN "targetPaceSecondsPerKm" INTEGER;
