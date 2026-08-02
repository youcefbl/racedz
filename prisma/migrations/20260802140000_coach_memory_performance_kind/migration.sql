-- PERFORMANCE memory kind (combined coach review, U-25): milestones the app derives from real
-- runs (new personal best, longest run yet). Written SYSTEM_DERIVED by the run-save path only —
-- the model may not propose this kind — so the coach remembers achievements across sessions.
ALTER TYPE "CoachMemoryKind" ADD VALUE 'PERFORMANCE';
