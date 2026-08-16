import "server-only";

// Explicit response DTOs for /api/v1. Prisma rows are never returned directly — every field the
// app receives is listed here on purpose. Deliberately NOT exposed anywhere below: password
// hashes, MFA secrets/backup codes, security stamps, national ID, other users' phone numbers,
// payment proof URLs (the file is served only through its authorized route), organizer bank
// details for races the caller has not registered for, import/debug provenance fields, and any
// infrastructure or owner identifier.

export type RaceSummaryDto = {
  id: string;
  slug: string;
  title: string;
  raceType: string;
  registrationStatus: string;
  startDate: string;
  endDate: string | null;
  wilaya: string;
  city: string;
  mainImageUrl: string | null;
  organizerName: string;
  distancesKm: number[];
  minPriceDzd: number | null;
  availablePlaces: number | null;
};

export type RaceCategoryDto = {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM: number | null;
  priceDzd: number | null;
  maxParticipants: number | null;
  startTime: string | null;
  cutoffTimeMin: number | null;
};

export type RaceDetailDto = RaceSummaryDto & {
  description: string;
  commune: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  rules: string | null;
  requiredDocuments: string | null;
  elevationGainText: string | null;
  conditions: string | null;
  shirtEnabled: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  maxParticipants: number | null;
  categories: RaceCategoryDto[];
  announcements: Array<{ id: string; title: string; body: string; publishedAt: string }>;
};

type RaceRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  raceType: string;
  registrationStatus: string;
  startDate: Date;
  endDate: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  wilaya: string;
  city: string;
  commune: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mainImageUrl: string | null;
  organizerName: string | null;
  rules: string | null;
  requiredDocuments: string | null;
  elevationGainText: string | null;
  conditions: string | null;
  shirtEnabled: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  maxParticipants: number | null;
  availablePlaces: number | null;
  organization: { name: string } | null;
  categories: Array<{
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number | null;
    priceDzd: number | null;
    maxParticipants: number | null;
    startTime: Date | null;
    cutoffTimeMin: number | null;
  }>;
};

/** The column set both mappers below require. Keep in sync with RaceRow. */
export const raceSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  raceType: true,
  registrationStatus: true,
  startDate: true,
  endDate: true,
  registrationOpenAt: true,
  registrationCloseAt: true,
  wilaya: true,
  city: true,
  commune: true,
  address: true,
  latitude: true,
  longitude: true,
  mainImageUrl: true,
  organizerName: true,
  rules: true,
  requiredDocuments: true,
  elevationGainText: true,
  conditions: true,
  shirtEnabled: true,
  contactEmail: true,
  contactPhone: true,
  maxParticipants: true,
  availablePlaces: true,
  organization: { select: { name: true } },
  categories: {
    orderBy: { distanceKm: "asc" as const },
    select: {
      id: true,
      name: true,
      distanceKm: true,
      elevationGainM: true,
      priceDzd: true,
      maxParticipants: true,
      startTime: true,
      cutoffTimeMin: true
    }
  }
} as const;

export function toRaceSummary(race: RaceRow): RaceSummaryDto {
  const prices = race.categories.map((category) => category.priceDzd).filter((price): price is number => price != null);
  return {
    id: race.id,
    slug: race.slug,
    title: race.title,
    raceType: race.raceType,
    registrationStatus: race.registrationStatus,
    startDate: race.startDate.toISOString(),
    endDate: race.endDate?.toISOString() ?? null,
    wilaya: race.wilaya,
    city: race.city,
    mainImageUrl: race.mainImageUrl,
    organizerName: race.organization?.name ?? race.organizerName ?? "ZidRun",
    distancesKm: race.categories.map((category) => category.distanceKm),
    minPriceDzd: prices.length ? Math.min(...prices) : null,
    availablePlaces: race.availablePlaces
  };
}

export function toRaceDetail(
  race: RaceRow,
  announcements: Array<{ id: string; title: string; body: string; publishedAt: Date }>
): RaceDetailDto {
  return {
    ...toRaceSummary(race),
    description: race.description,
    commune: race.commune,
    address: race.address,
    latitude: race.latitude,
    longitude: race.longitude,
    registrationOpenAt: race.registrationOpenAt?.toISOString() ?? null,
    registrationCloseAt: race.registrationCloseAt?.toISOString() ?? null,
    rules: race.rules,
    requiredDocuments: race.requiredDocuments,
    elevationGainText: race.elevationGainText,
    conditions: race.conditions,
    shirtEnabled: race.shirtEnabled,
    contactEmail: race.contactEmail ?? null,
    contactPhone: race.contactPhone ?? null,
    maxParticipants: race.maxParticipants,
    categories: race.categories.map((category) => ({
      id: category.id,
      name: category.name,
      distanceKm: category.distanceKm,
      elevationGainM: category.elevationGainM,
      priceDzd: category.priceDzd,
      maxParticipants: category.maxParticipants,
      startTime: category.startTime?.toISOString() ?? null,
      cutoffTimeMin: category.cutoffTimeMin
    })),
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      publishedAt: announcement.publishedAt.toISOString()
    }))
  };
}

export type MeDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  wilaya: string | null;
  city: string | null;
  /** True when the profile carries every field a race registration requires. */
  profileComplete: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  preferences: { language: string | null; theme: string | null; profilePrivate: boolean; distanceUnit: "km" | "mi" };
};

export function toMeDto(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  wilaya: string | null;
  city: string | null;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  language: string | null;
  theme: string | null;
  profilePrivate: boolean;
  distanceUnit?: string | null;
}): MeDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    gender: user.gender,
    // Date-only field; the time component is meaningless and would leak the row's creation clock.
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    /**
     * Whether the profile carries everything a race registration needs.
     *
     * Computed here rather than in the app so one definition governs both: the client uses it to
     * decide whether to show onboarding, and the registration endpoint enforces the same fields.
     * A client-side guess would drift the moment the registration schema changes.
     */
    profileComplete: Boolean(
      user.phone && user.gender && user.dateOfBirth && user.wilaya && user.city
    ),
    wilaya: user.wilaya,
    city: user.city,
    emailVerified: Boolean(user.emailVerifiedAt),
    mfaEnabled: user.mfaEnabled,
    preferences: {
      language: user.language,
      theme: user.theme,
      profilePrivate: user.profilePrivate,
      distanceUnit: user.distanceUnit === "mi" ? "mi" : "km"
    }
  };
}

export type RegistrationDto = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  /** Whether a proof image exists — never the storage path. The image is fetched from
   *  /api/v1/registrations/{id}/payment-proof, which re-checks ownership on every read. */
  hasPaymentProof: boolean;
  bibNumber: string | null;
  createdAt: string;
  race: { id: string; slug: string; title: string; startDate: string; wilaya: string; city: string };
  category: { id: string; name: string; distanceKm: number; priceDzd: number | null };
  /** Organizer payment instructions, included only because this row proves the caller registered. */
  paymentInstructions: { baridiMobNumber: string | null; ccpAccount: string | null; ccpKey: string | null; note: string | null } | null;
};

export function toRegistrationDto(registration: {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  bibNumber: string | null;
  createdAt: Date;
  raceEvent: {
    id: string;
    slug: string;
    title: string;
    startDate: Date;
    wilaya: string;
    city: string;
    baridiMobNumber: string | null;
    ccpAccount: string | null;
    ccpKey: string | null;
    paymentNote: string | null;
  };
  raceCategory: { id: string; name: string; distanceKm: number; priceDzd: number | null };
}): RegistrationDto {
  const needsPayment = registration.paymentStatus !== "NOT_REQUIRED" && registration.paymentStatus !== "PAID";
  return {
    id: registration.id,
    status: registration.status,
    paymentStatus: registration.paymentStatus,
    paymentMethod: registration.paymentMethod,
    hasPaymentProof: Boolean(registration.paymentProofUrl),
    bibNumber: registration.bibNumber,
    createdAt: registration.createdAt.toISOString(),
    race: {
      id: registration.raceEvent.id,
      slug: registration.raceEvent.slug,
      title: registration.raceEvent.title,
      startDate: registration.raceEvent.startDate.toISOString(),
      wilaya: registration.raceEvent.wilaya,
      city: registration.raceEvent.city
    },
    category: {
      id: registration.raceCategory.id,
      name: registration.raceCategory.name,
      distanceKm: registration.raceCategory.distanceKm,
      priceDzd: registration.raceCategory.priceDzd
    },
    paymentInstructions: needsPayment
      ? {
          baridiMobNumber: registration.raceEvent.baridiMobNumber,
          ccpAccount: registration.raceEvent.ccpAccount,
          ccpKey: registration.raceEvent.ccpKey,
          note: registration.raceEvent.paymentNote
        }
      : null
  };
}
