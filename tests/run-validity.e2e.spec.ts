import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { confirmWorkoutMatch, createRunnerRun, getRunnerRecords } from "../src/lib/coach/service";
import { getPrisma } from "../src/lib/db";
import { getWilayaLeaderboards } from "../src/lib/leaderboard";
import { getFeed, toggleKudos } from "../src/lib/social";

const prisma = getPrisma();
const userId = `validity-${randomUUID()}`;

test.afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

test("excluded GPS activity stays private and cannot affect social, records, rankings, or workout completion", async () => {
  const now = new Date();
  const goalId = `goal-${randomUUID()}`;
  const planId = `plan-${randomUUID()}`;
  const workoutId = `workout-${randomUUID()}`;

  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.test`,
      firstName: "Validity",
      lastName: "Runner",
      wilaya: "Alger",
      emailVerifiedAt: now,
      onboardedAt: now
    }
  });
  await prisma.runnerGoal.create({
    data: {
      id: goalId,
      userId,
      goalType: "TEN_K",
      targetDate: new Date(now.getTime() + 30 * 86_400_000),
      targetDistanceKm: 10,
      experienceLevel: "INTERMEDIATE",
      currentWeeklyDistanceKm: 20,
      availableTrainingDays: [1, 3, 6],
      preferredLocale: "en",
      status: "ACTIVE"
    }
  });
  await prisma.trainingPlan.create({
    data: {
      id: planId,
      userId,
      goalId,
      version: 1,
      startsOn: new Date(now.getTime() - 86_400_000),
      endsOn: new Date(now.getTime() + 7 * 86_400_000),
      status: "ACTIVE",
      source: "RULE_BASED"
    }
  });
  await prisma.trainingWorkout.create({
    data: {
      id: workoutId,
      trainingPlanId: planId,
      scheduledFor: now,
      workoutType: "LONG_RUN",
      title: "Long run",
      targetDistanceKm: 10,
      intensity: "EASY",
      instructions: "Easy effort",
      status: "PLANNED"
    }
  });

  const result = await createRunnerRun(userId, {
    startedAt: now,
    distanceKm: 60.619,
    durationSeconds: 3 * 3600 + 17 * 60 + 58,
    movingTimeSeconds: 1 * 3600 + 46 * 60 + 28,
    source: "GPS",
    isPublic: true,
    perceivedEffort: 6
  });

  expect(result.run.validity).toBe("EXCLUDED");
  expect(result.run.validityReason).toBe("IMPOSSIBLE_PACE");
  expect(result.run.isPublic).toBe(false);
  expect(result.run.workoutId).toBeNull();
  expect((await getRunnerRecords(userId)).longestRunKm).toBe(0);
  expect((await getFeed(userId)).runs).toEqual([]);

  const leaderboards = await getWilayaLeaderboards({ wilaya: "Alger" });
  expect(leaderboards.distance.some((entry) => entry.userId === userId)).toBe(false);
  expect(leaderboards.pace.some((entry) => entry.userId === userId)).toBe(false);
  await expect(toggleKudos(userId, result.run.id)).rejects.toThrow("RUN_NOT_FOUND");
  await expect(confirmWorkoutMatch(userId, result.run.id, workoutId)).rejects.toMatchObject({ code: "RUN_NOT_VALID" });
  expect((await prisma.trainingWorkout.findUniqueOrThrow({ where: { id: workoutId } })).status).toBe("PLANNED");
});
