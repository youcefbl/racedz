import type { EventRegistrationStatus, RaceEvent, RaceType } from "@/types/race";

export const RACE_TYPE_LABELS: Record<RaceType, string> = {
  ROAD: "Road race",
  TRAIL: "Trail",
  ULTRA_TRAIL: "Ultra trail",
  MARATHON: "Marathon",
  HALF_MARATHON: "Half marathon",
  TEN_K: "10K",
  FIVE_K: "5K",
  KIDS: "Kids race",
  CHARITY: "Charity race",
  OTHER: "Other"
};

export const EVENT_REGISTRATION_STATUS_LABELS: Record<EventRegistrationStatus, string> = {
  NOT_OPEN: "Not open yet",
  OPEN: "Registration open",
  CLOSED: "Registration closed",
  FULL: "Full",
  CANCELLED: "Cancelled"
};

export const sampleRaces: RaceEvent[] = [
  {
    id: "race-alger-10k",
    source: "ORGANIZATION",
    title: "Alger 10K",
    slug: "alger-10k",
    description:
      "A fast city road race through central Alger, designed for first-time runners and experienced athletes chasing a personal best.",
    raceType: "TEN_K",
    status: "PUBLISHED",
    registrationStatus: "OPEN",
    startDate: "2026-10-02T08:00:00.000Z",
    registrationOpenAt: "2026-06-01T08:00:00.000Z",
    registrationCloseAt: "2026-09-25T22:59:00.000Z",
    wilaya: "Alger",
    city: "Alger Centre",
    commune: "Alger Centre",
    address: "Place des Martyrs, Alger",
    organizer: {
      id: "org-alger-running-club",
      name: "Alger Running Club",
      slug: "alger-running-club",
      url: "/organizations/alger-running-club"
    },
    mainImageUrl: "/racedz-logo.png",
    rules: "Participants must wear their bib visibly and respect the marked route.",
    requiredDocuments: "Medical certificate optional for the 5K and required for the 10K.",
    contactEmail: "events@racedz.dz",
    contactPhone: "+213 555 000 100",
    maxParticipants: 1500,
    availablePlaces: 1320,
    categories: [
      { id: "cat-alger-5k", name: "5K Community Run", distanceKm: 5, priceDzd: 1000 },
      { id: "cat-alger-10k", name: "10K Open", distanceKm: 10, priceDzd: 1800 }
    ]
  },
  {
    id: "race-oran-half",
    source: "ORGANIZATION",
    title: "Oran Half Marathon",
    slug: "oran-half-marathon",
    description:
      "A coastal half marathon route connecting Oran landmarks with a festive finish area for clubs and families.",
    raceType: "HALF_MARATHON",
    status: "PUBLISHED",
    registrationStatus: "OPEN",
    startDate: "2026-11-14T07:30:00.000Z",
    registrationOpenAt: "2026-07-01T08:00:00.000Z",
    registrationCloseAt: "2026-11-01T22:59:00.000Z",
    wilaya: "Oran",
    city: "Oran",
    commune: "Oran",
    address: "Front de mer, Oran",
    organizer: {
      id: "org-oran-trail-team",
      name: "Oran Trail Team",
      slug: "oran-trail-team",
      url: "/organizations/oran-trail-team"
    },
    mainImageUrl: "/racedz-logo.png",
    rules: "Road closures apply. Runners must pass all timing checkpoints.",
    requiredDocuments: "Medical certificate required.",
    contactEmail: "oran@racedz.dz",
    maxParticipants: 2200,
    availablePlaces: 2040,
    categories: [
      { id: "cat-oran-10k", name: "10K", distanceKm: 10, priceDzd: 1600 },
      { id: "cat-oran-21k", name: "21K Half Marathon", distanceKm: 21.1, priceDzd: 2800 }
    ]
  },
  {
    id: "race-tizi-trail",
    source: "ORGANIZATION",
    title: "Tizi Ouzou Trail Challenge",
    slug: "tizi-ouzou-trail-challenge",
    description:
      "A mountain trail event in Kabylie with technical climbs, aid stations, and scenic ridge sections.",
    raceType: "TRAIL",
    status: "PUBLISHED",
    registrationStatus: "OPEN",
    startDate: "2026-12-05T06:30:00.000Z",
    registrationOpenAt: "2026-08-01T08:00:00.000Z",
    registrationCloseAt: "2026-11-20T22:59:00.000Z",
    wilaya: "Tizi Ouzou",
    city: "Tizi Ouzou",
    commune: "Tizi Ouzou",
    address: "Maison de la culture Mouloud Mammeri",
    organizer: {
      id: "org-kabylie-mountain-runners",
      name: "Kabylie Mountain Runners",
      slug: "kabylie-mountain-runners",
      url: "/organizations/kabylie-mountain-runners"
    },
    mainImageUrl: "/racedz-logo.png",
    rules: "Mandatory equipment checks happen before bib collection.",
    requiredDocuments: "Medical certificate and emergency contact required.",
    contactEmail: "trail@racedz.dz",
    maxParticipants: 700,
    availablePlaces: 580,
    categories: [
      {
        id: "cat-tizi-25k",
        name: "Trail 25K",
        distanceKm: 25,
        elevationGainM: 1250,
        priceDzd: 3200,
        cutoffTimeMin: 360
      },
      {
        id: "cat-tizi-50k",
        name: "Trail 50K",
        distanceKm: 50,
        elevationGainM: 2600,
        priceDzd: 5200,
        cutoffTimeMin: 720
      }
    ]
  },
  {
    id: "race-constantine-city",
    source: "PLATFORM",
    title: "Constantine City Run",
    slug: "constantine-city-run",
    description:
      "A community road race crossing Constantine's iconic bridges with 5K and 10K categories.",
    raceType: "ROAD",
    status: "PUBLISHED",
    registrationStatus: "NOT_OPEN",
    startDate: "2027-01-23T08:00:00.000Z",
    registrationOpenAt: "2026-09-01T08:00:00.000Z",
    registrationCloseAt: "2027-01-10T22:59:00.000Z",
    wilaya: "Constantine",
    city: "Constantine",
    commune: "Constantine",
    address: "Centre-ville, Constantine",
    organizer: {
      id: "org-racedz-platform",
      name: "RaceDZ Community Desk",
      slug: "racedz-platform",
      url: "/"
    },
    mainImageUrl: "/racedz-logo.png",
    rules: "Open to runners aged 14 and above for 10K, all ages for the family 5K.",
    contactEmail: "constantine@racedz.dz",
    maxParticipants: 1200,
    availablePlaces: 1200,
    categories: [
      { id: "cat-constantine-5k", name: "5K Family Run", distanceKm: 5, priceDzd: 800 },
      { id: "cat-constantine-10k", name: "10K", distanceKm: 10, priceDzd: 1500 }
    ]
  }
];

export type RaceFilters = {
  q?: string;
  wilaya?: string;
  type?: RaceType;
  distance?: string;
  registrationStatus?: EventRegistrationStatus;
};

export function getUpcomingRaces(limit?: number) {
  const races = [...sampleRaces]
    .filter((race) => race.status === "PUBLISHED")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return typeof limit === "number" ? races.slice(0, limit) : races;
}

export function getRaceBySlug(slug: string) {
  return sampleRaces.find((race) => race.slug === slug);
}

export function getRaceById(id: string) {
  return sampleRaces.find((race) => race.id === id);
}

export function filterRaces(filters: RaceFilters) {
  const query = filters.q?.trim().toLowerCase();

  return getUpcomingRaces().filter((race) => {
    const matchesQuery = query
      ? [race.title, race.city, race.wilaya, race.organizer.name]
          .join(" ")
          .toLowerCase()
          .includes(query)
      : true;
    const matchesWilaya = filters.wilaya ? race.wilaya === filters.wilaya : true;
    const matchesType = filters.type ? race.raceType === filters.type : true;
    const matchesRegistrationStatus = filters.registrationStatus
      ? race.registrationStatus === filters.registrationStatus
      : true;
    const matchesDistance = filters.distance
      ? race.categories.some((category) => String(category.distanceKm) === filters.distance)
      : true;

    return matchesQuery && matchesWilaya && matchesType && matchesRegistrationStatus && matchesDistance;
  });
}
