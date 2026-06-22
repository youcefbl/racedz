import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export type PaginationInput = z.infer<typeof paginationSchema>;

const localUploadPathSchema = z.string().regex(/^\/uploads\/[a-z-]+\/[0-9]{4}-[0-9]{2}\/[a-f0-9-]+\.(jpg|png|webp|gif)$/);
const imageUrlSchema = z.union([z.string().url(), localUploadPathSchema]);

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8)
});

export const registerUserSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters."),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters."),
  arabicFullName: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(6, "Enter a valid phone number."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must include at least one letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
  confirmPassword: z.string(),
  wilaya: z.string().trim().min(2, "Choose a wilaya."),
  city: z.string().trim().optional(),
  commune: z.string().trim().optional(),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().trim().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
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
  avatarUrl: imageUrlSchema.optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const organizationRequestSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(20),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().min(6),
  logoUrl: imageUrlSchema.optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional(),
  website: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional()
});

export type OrganizationRequestInput = z.infer<typeof organizationRequestSchema>;

export const organizationProfileSchema = organizationRequestSchema.extend({
  website: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional()
});

export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

export const organizationInviteSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER")
});

export type OrganizationInviteInput = z.infer<typeof organizationInviteSchema>;

const raceTypeSchema = z.enum([
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
]);

const raceCategoryCreateSchema = z.object({
  name: z.string().min(2),
  raceType: raceTypeSchema,
  distanceKm: z.coerce.number().positive(),
  priceDzd: z.coerce.number().int().nonnegative().optional(),
  maxParticipants: z.coerce.number().int().positive().optional(),
  startTime: z.string().optional()
});

export const organizerRaceSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(1),
  elevationGainText: z.string().max(500).optional(),
  conditions: z.string().max(5000).optional(),
  raceType: raceTypeSchema,
  startDate: z.string().min(10),
  registrationCloseAt: z.string().optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional(),
  address: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  maxParticipants: z.coerce.number().int().positive().optional(),
  autoCancelUnpaidAfterHours: z.coerce.number().int().positive().optional(),
  mainImageUrl: imageUrlSchema.optional(),
  categoryName: z.string().min(2),
  distanceKm: z.coerce.number().positive(),
  priceDzd: z.coerce.number().int().nonnegative().optional(),
  categoryMaxParticipants: z.coerce.number().int().positive().optional(),
  startTime: z.string().optional(),
  categories: z.array(raceCategoryCreateSchema).min(1).max(12).optional()
});

export type OrganizerRaceInput = z.infer<typeof organizerRaceSchema>;

export const organizerRaceUpdateSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(1),
  elevationGainText: z.string().max(500).optional(),
  conditions: z.string().max(5000).optional(),
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
  startDate: z.string().min(10),
  registrationCloseAt: z.string().optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional(),
  address: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  maxParticipants: z.coerce.number().int().positive().optional(),
  autoCancelUnpaidAfterHours: z.coerce.number().int().positive().optional(),
  mainImageUrl: imageUrlSchema.optional()
});

export type OrganizerRaceUpdateInput = z.infer<typeof organizerRaceUpdateSchema>;

export const organizerCategorySchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(2),
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
  distanceKm: z.coerce.number().positive(),
  priceDzd: z.coerce.number().int().nonnegative().optional(),
  maxParticipants: z.coerce.number().int().positive().optional(),
  startTime: z.string().optional()
});

export type OrganizerCategoryInput = z.infer<typeof organizerCategorySchema>;

export const platformRaceSchema = organizerRaceSchema.extend({
  registrationStatus: z.enum(["NOT_OPEN", "OPEN", "CLOSED"]).default("NOT_OPEN"),
  organizerName: z.string().min(2).default("RaceDZ Community Desk"),
  organizerUrl: z.string().url().optional(),
  mainImageUrl: imageUrlSchema.optional()
});

export type PlatformRaceInput = z.infer<typeof platformRaceSchema>;

export const adminRaceUpdateSchema = organizerRaceUpdateSchema.extend({
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "CANCELLED", "COMPLETED", "REJECTED"]),
  registrationStatus: z.enum(["NOT_OPEN", "OPEN", "CLOSED", "FULL", "CANCELLED"]),
  organizerName: z.string().optional(),
  organizerUrl: z.string().url().optional()
});

export type AdminRaceUpdateInput = z.infer<typeof adminRaceUpdateSchema>;

export const createRaceSchema = z.object({
  source: z.enum(["ORGANIZATION", "PLATFORM"]).default("ORGANIZATION"),
  title: z.string().min(3),
  description: z.string().min(1),
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

export const raceAnnouncementSchema = z.object({
  raceId: z.string().min(1),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(2000)
});

export type RaceAnnouncementInput = z.infer<typeof raceAnnouncementSchema>;
