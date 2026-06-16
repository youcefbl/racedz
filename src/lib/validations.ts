import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8)
});

export const registerUserSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  arabicFullName: z.string().optional(),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().min(6),
  password: z.string().min(8),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().optional()
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  arabicFullName: z.string().optional(),
  phone: z.string().min(6),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const createRaceSchema = z.object({
  source: z.enum(["ORGANIZATION", "PLATFORM"]).default("ORGANIZATION"),
  title: z.string().min(3),
  description: z.string().min(20),
  raceType: z.enum([
    "ROAD",
    "TRAIL",
    "ULTRA_TRAIL",
    "MARATHON",
    "HALF_MARATHON",
    "TEN_K",
    "FIVE_K",
    "KIDS",
    "CHARITY",
    "OTHER"
  ]),
  registrationStatus: z.enum(["NOT_OPEN", "OPEN", "CLOSED", "FULL", "CANCELLED"]).default("NOT_OPEN"),
  startDate: z.string().datetime(),
  registrationCloseAt: z.string().datetime().optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional(),
  address: z.string().optional(),
  organizerName: z.string().optional(),
  organizerUrl: z.string().url().optional(),
  availablePlaces: z.number().int().nonnegative().optional(),
  maxParticipants: z.number().int().positive().optional()
});

export const raceRegistrationSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  dateOfBirth: z.string().min(8),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  emergencyContactName: z.string().min(2),
  emergencyContactPhone: z.string().min(6),
  clubName: z.string().optional(),
  raceCategoryId: z.string().min(1),
  tshirtSize: z.string().optional(),
  acceptedTerms: z.coerce.boolean().refine(Boolean, "Terms must be accepted")
});

export type RaceRegistrationInput = z.infer<typeof raceRegistrationSchema>;
