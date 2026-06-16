export type UserRole = "RUNNER" | "ORGANIZER" | "ADMIN" | "SUPERADMIN";

export type RaceSource = "ORGANIZATION" | "PLATFORM";

export type RaceType =
  | "ROAD"
  | "TRAIL"
  | "ULTRA_TRAIL"
  | "MARATHON"
  | "HALF_MARATHON"
  | "TEN_K"
  | "FIVE_K"
  | "KIDS"
  | "CHARITY"
  | "OTHER";

export type RaceStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "CANCELLED"
  | "COMPLETED"
  | "REJECTED";

export type EventRegistrationStatus = "NOT_OPEN" | "OPEN" | "CLOSED" | "FULL" | "CANCELLED";

export type RegistrationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "REJECTED"
  | "WAITING_LIST";

export type PaymentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "MANUAL_REVIEW";

export type RaceCategory = {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM?: number;
  priceDzd?: number;
  maxParticipants?: number;
  startTime?: string;
  cutoffTimeMin?: number;
  gpxFileUrl?: string;
};

export type RaceEvent = {
  id: string;
  source: RaceSource;
  title: string;
  slug: string;
  description: string;
  raceType: RaceType;
  status: RaceStatus;
  registrationStatus: EventRegistrationStatus;
  startDate: string;
  endDate?: string;
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  wilaya: string;
  city: string;
  commune?: string;
  address?: string;
  organizer: {
    id: string;
    name: string;
    slug: string;
    url?: string;
  };
  mainImageUrl?: string;
  rules?: string;
  requiredDocuments?: string;
  contactEmail?: string;
  contactPhone?: string;
  maxParticipants?: number;
  availablePlaces?: number;
  categories: RaceCategory[];
};
