import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export type PaginationInput = z.infer<typeof paginationSchema>;

const localUploadPathSchema = z.string().regex(/^\/uploads\/[a-z-]+\/[0-9]{4}-[0-9]{2}\/[a-f0-9-]+\.(jpg|png|webp|gif)$/);
const imageUrlSchema = z.union([z.string().url(), localUploadPathSchema]);

/**
 * Upper bound on a submitted password (`SEC-006`, field-length limits).
 *
 * bcrypt only reads the first 72 BYTES, so everything past that is already meaningless to the
 * hash — but it is not free: `bcrypt.hash()` runs at cost factor 12, and handing it a
 * body-cap-sized string means the server does that work on input that cannot affect the result.
 * Unauthenticated on register, reset and login, so there is no account to throttle behind it,
 * which makes it a cheap way to spend our CPU.
 *
 * 128 rather than 72: passphrase managers generate long passwords, refusing one at exactly the
 * bcrypt boundary would be a confusing error, and the headroom costs nothing. Deliberately NOT
 * applied to the confirm field's own length — it is compared to the password, so it is bounded
 * by it.
 */
export const MAX_PASSWORD_LENGTH = 128;
const passwordTooLong = `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(MAX_PASSWORD_LENGTH)
});

// Sign-up is intentionally minimal: name + email + password. The detailed participant
// profile (phone, wilaya, ID, date of birth, ...) is collected later — in the profile page
// and at race-registration time — so creating an account stays fast and easy.
export const registerUserSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters."),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters.").max(MAX_PASSWORD_LENGTH, passwordTooLong),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters.").max(MAX_PASSWORD_LENGTH, passwordTooLong),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
  shirtEnabled: z.boolean().optional(),
  raceType: raceTypeSchema,
  startDate: z.string().min(10),
  registrationCloseAt: z.string().optional(),
  wilaya: z.string().min(2),
  city: z.string().min(2),
  commune: z.string().optional(),
  address: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  baridiMobNumber: z.string().max(60).optional(),
  ccpAccount: z.string().max(60).optional(),
  ccpKey: z.string().max(20).optional(),
  paymentNote: z.string().max(500).optional(),
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
  shirtEnabled: z.boolean().optional(),
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
  baridiMobNumber: z.string().max(60).optional(),
  ccpAccount: z.string().max(60).optional(),
  ccpKey: z.string().max(20).optional(),
  paymentNote: z.string().max(500).optional(),
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
  organizerName: z.string().min(2).default("ZidRun Community Desk"),
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
