-- Capture the runner's height so the coach can reason about BMI alongside body weight.
ALTER TABLE "RunnerGoal" ADD COLUMN "heightCm" INTEGER;
