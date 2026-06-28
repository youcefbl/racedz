# Algeria Races Platform — Codex Development Brief

## 1. Project Summary

Build a web platform for the Algerian running community that centralizes information about upcoming marathons, road races, trail races, and other running events in Algeria.

The platform should serve two main audiences:

1. **Runners / participants**
   - Discover upcoming races and trails in Algeria.
   - Search by wilaya, city, distance, race type, and date.
   - Register online for events.
   - Manage their profile, registrations, and race history.

2. **Organizers**
   - Create and manage races.
   - Manage registration data.
   - Export participant lists.
   - Track payment/registration status.
   - Communicate event details to participants.

The goal is to create a platform similar in concept to international platforms such as RunSignup, Race Roster, Find a Race, Finishers, and World’s Marathons, but focused on Algeria.

---

## 2. Product Positioning

Suggested positioning:

> The central platform for discovering, registering, and managing running events in Algeria.

Possible user-facing names:
- RunDZ
- ZidRun
- DzRaces
- Algeria Runs
- TrailDZ
- Djazair Runs

The first version should focus on simplicity, trust, and usability.

---

## 3. MVP Goals

The MVP should allow:

### Public users

- View list of upcoming races.
- Filter races by:
  - Wilaya
  - City
  - Race type
  - Distance
  - Date
- View race details.
- Register for a race.
- Receive registration confirmation.
- Access basic user account/profile.

### Organizers

- Create an organizer account.
- Create and edit race events.
- Add race distances/categories.
- View registered participants.
- Export participant data as CSV/Excel.
- Update registration status.
- Close/open registrations.

### Admin

- Approve or reject organizer accounts.
- Approve or reject race events before publication.
- Manage users, organizations, and races.
- View platform statistics.

---

## 4. Recommended Tech Stack

Use a practical, modern stack that is easy to deploy and maintain.

### Frontend

Recommended:
- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**

Reasons:
- Good SEO for race pages.
- Fast development.
- Easy public pages and dashboard pages.
- Good deployment options.

### Backend

Two good options:

#### Option A — Full-stack Next.js

Use:
- Next.js App Router
- API routes / server actions
- Prisma ORM
- PostgreSQL

This is simpler for MVP.

#### Option B — Separate backend

Use:
- Go or Node.js/NestJS backend
- PostgreSQL
- REST API

This is better if the project is expected to become more complex.

For the first MVP, prefer **Option A: Next.js + Prisma + PostgreSQL**.

### Database

Use:
- PostgreSQL

### File Storage

Use:
- S3-compatible storage for:
  - Event images
  - GPX files
  - Medical certificates, if required
  - Organization documents

For local development, use local file upload or MinIO.

### Auth

Use one of:
- NextAuth/Auth.js
- Clerk
- Supabase Auth
- Custom email/password auth

For MVP, use:
- Email/password
- Optional Google login later

### Payments

Payment integration depends on Algeria availability.

For MVP:
- Support manual payment validation first.
- Store payment method as:
  - Bank transfer
  - BaridiMob proof upload
  - Cash with organizer
  - Future online payment gateway

Later:
- Integrate local payment gateway if available.

---

## 5. Core Roles

Define these roles:

```ts
enum UserRole {
  RUNNER = "RUNNER",
  ORGANIZER = "ORGANIZER",
  ADMIN = "ADMIN"
}
```

### Runner

Can:
- Browse races.
- Register for races.
- Manage profile.
- View own registrations.

### Organizer

Can:
- Create and manage own organization.
- Create and manage events.
- View registrations for own events.
- Export participants.

### Admin

Can:
- Manage everything.
- Approve organizers.
- Approve events.
- Moderate content.

---

## 6. Core Features

## 6.1 Public Race Calendar

Page: `/races`

Display upcoming races as cards/list.

Each race card should show:
- Race name
- Date
- Wilaya/city
- Race type
- Available distances
- Registration status
- Organizer
- Main image

Filters:
- Search keyword
- Wilaya
- City
- Race type
- Distance
- Date range

Race types:
- Road race
- Trail
- Ultra trail
- Marathon
- Half marathon
- 10K
- 5K
- Kids race
- Charity race
- Other

---

## 6.2 Race Details Page

Page: `/races/[slug]`

Show:
- Race title
- Main image
- Date and time
- Location
- Wilaya and city
- Organizer
- Description
- Distances/categories
- Registration fees
- Registration deadline
- Max participants
- Race rules
- Required documents
- Route/elevation information
- GPX file link, if available
- Contact info
- Registration button

For trail events, include:
- Elevation gain
- Distance
- Difficulty
- Cut-off time
- Aid stations
- Mandatory equipment
- GPX file

---

## 6.3 User Registration for Race

Page: `/races/[slug]/register`

Required participant fields:
- First name
- Last name
- Email
- Phone number
- Date of birth
- Gender
- Wilaya
- City
- Emergency contact name
- Emergency contact phone
- Club/team name, optional
- Selected race distance/category
- T-shirt size, optional
- Medical certificate upload, optional depending on event
- Accept terms checkbox

Registration status:
- Pending
- Confirmed
- Cancelled
- Rejected
- Waiting list

Payment status:
- Not required
- Pending
- Paid
- Failed
- Refunded
- Manual review

---

## 6.4 Organizer Dashboard

Page: `/organizer/dashboard`

Organizer can:
- View own events
- Create event
- Edit event
- View participants
- Export participant list
- Open/close registration
- Upload event files
- Manage race categories

Pages:
- `/organizer/events`
- `/organizer/events/new`
- `/organizer/events/[id]/edit`
- `/organizer/events/[id]/registrations`
- `/organizer/profile`

---

## 6.5 Admin Dashboard

Page: `/admin`

Admin can:
- View statistics
- Manage users
- Manage organizations
- Approve/reject organizations
- Approve/reject races
- Feature races on homepage
- Disable suspicious users/events

Pages:
- `/admin/users`
- `/admin/organizations`
- `/admin/races`
- `/admin/registrations`

---

## 7. Suggested Database Schema

Use Prisma with PostgreSQL.

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String?
  firstName     String
  lastName      String
  phone         String?
  role          UserRole       @default(RUNNER)
  gender        Gender?
  dateOfBirth   DateTime?
  wilaya        String?
  city          String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  organizations OrganizationMember[]
  registrations RaceRegistration[]
}

enum UserRole {
  RUNNER
  ORGANIZER
  ADMIN
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

model Organization {
  id          String               @id @default(cuid())
  name        String
  slug        String               @unique
  description String?
  email       String?
  phone       String?
  website     String?
  facebookUrl String?
  instagramUrl String?
  wilaya      String?
  city        String?
  status      OrganizationStatus   @default(PENDING)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  members     OrganizationMember[]
  races       RaceEvent[]
}

enum OrganizationStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

model OrganizationMember {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           OrganizerRole @default(MEMBER)
  createdAt      DateTime      @default(now())

  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
}

enum OrganizerRole {
  OWNER
  ADMIN
  MEMBER
}

model RaceEvent {
  id                 String            @id @default(cuid())
  organizationId     String
  title              String
  slug               String            @unique
  description        String
  raceType           RaceType
  status             RaceStatus        @default(DRAFT)
  startDate          DateTime
  endDate            DateTime?
  registrationOpenAt DateTime?
  registrationCloseAt DateTime?
  wilaya             String
  city               String
  address            String?
  latitude           Float?
  longitude          Float?
  mainImageUrl       String?
  rules              String?
  requiredDocuments  String?
  contactEmail       String?
  contactPhone       String?
  maxParticipants    Int?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  organization       Organization      @relation(fields: [organizationId], references: [id])
  categories         RaceCategory[]
  registrations      RaceRegistration[]
}

enum RaceType {
  ROAD
  TRAIL
  ULTRA_TRAIL
  MARATHON
  HALF_MARATHON
  TEN_K
  FIVE_K
  KIDS
  CHARITY
  OTHER
}

enum RaceStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  CANCELLED
  COMPLETED
  REJECTED
}

model RaceCategory {
  id              String       @id @default(cuid())
  raceEventId     String
  name            String
  distanceKm      Float
  elevationGainM  Int?
  priceDzd        Int?
  maxParticipants Int?
  minAge          Int?
  maxAge          Int?
  startTime       DateTime?
  cutoffTimeMin   Int?
  gpxFileUrl      String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  raceEvent       RaceEvent    @relation(fields: [raceEventId], references: [id])
  registrations   RaceRegistration[]
}

model RaceRegistration {
  id                    String             @id @default(cuid())
  userId                String
  raceEventId            String
  raceCategoryId         String
  bibNumber              String?
  status                 RegistrationStatus @default(PENDING)
  paymentStatus          PaymentStatus      @default(PENDING)
  paymentMethod          PaymentMethod?
  paymentProofUrl        String?
  emergencyContactName   String
  emergencyContactPhone  String
  clubName               String?
  tshirtSize             String?
  medicalCertificateUrl  String?
  notes                  String?
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  user                  User                @relation(fields: [userId], references: [id])
  raceEvent              RaceEvent           @relation(fields: [raceEventId], references: [id])
  raceCategory           RaceCategory        @relation(fields: [raceCategoryId], references: [id])

  @@unique([userId, raceCategoryId])
}

enum RegistrationStatus {
  PENDING
  CONFIRMED
  CANCELLED
  REJECTED
  WAITING_LIST
}

enum PaymentStatus {
  NOT_REQUIRED
  PENDING
  PAID
  FAILED
  REFUNDED
  MANUAL_REVIEW
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  BARIDIMOB
  ONLINE_CARD
  OTHER
}
```

---

## 8. Suggested Pages

### Public

```txt
/
  Homepage

/races
  Race calendar and filters

/races/[slug]
  Race details

/races/[slug]/register
  Race registration page

/organizations/[slug]
  Organizer public profile

/about
  About the platform

/contact
  Contact page
```

### Auth

```txt
/login
/register
/forgot-password
/account
/account/registrations
/account/profile
```

### Organizer

```txt
/organizer
/organizer/events
/organizer/events/new
/organizer/events/[id]
/organizer/events/[id]/edit
/organizer/events/[id]/registrations
/organizer/profile
```

### Admin

```txt
/admin
/admin/users
/admin/organizations
/admin/races
/admin/registrations
```

---

## 9. API Routes

If using Next.js route handlers, create:

```txt
GET    /api/races
POST   /api/races
GET    /api/races/:id
PATCH  /api/races/:id
DELETE /api/races/:id

GET    /api/races/:id/categories
POST   /api/races/:id/categories

POST   /api/races/:id/register
GET    /api/me/registrations

GET    /api/organizer/events
GET    /api/organizer/events/:id/registrations
GET    /api/organizer/events/:id/registrations/export

GET    /api/admin/races
PATCH  /api/admin/races/:id/approve
PATCH  /api/admin/races/:id/reject

GET    /api/admin/organizations
PATCH  /api/admin/organizations/:id/approve
PATCH  /api/admin/organizations/:id/reject
```

---

## 10. Homepage Requirements

Homepage should include:

1. Hero section
   - Title: “Find and register for races across Algeria”
   - Subtitle: “Marathons, 10K races, trail runs, and community events in one place.”
   - Search bar
   - CTA buttons:
     - “Find a race”
     - “Create an event”

2. Upcoming races section
   - Show next 6 published races.

3. Race type section
   - Road races
   - Trail races
   - Marathons
   - Kids races

4. Organizer CTA
   - “Are you organizing a race?”
   - “Create your event and manage registrations online.”

5. Footer
   - About
   - Contact
   - Terms
   - Privacy

---

## 11. UI/UX Style

Design should be:
- Clean
- Sporty
- Trustworthy
- Mobile-first
- Bilingual-ready

Suggested visual direction:
- Primary color: green or blue
- Accent color: orange/red for action buttons
- Use cards for race listings
- Use clear registration status badges

Suggested colors:

```txt
Primary: #0F766E
Accent:  #F97316
Dark:    #111827
Light:   #F9FAFB
Muted:   #6B7280
```

---

## 12. Algeria-Specific Requirements

The app should support Algerian locations.

Add a fixed wilaya list.

Example:

```ts
export const ALGERIA_WILAYAS = [
  "Adrar",
  "Chlef",
  "Laghouat",
  "Oum El Bouaghi",
  "Batna",
  "Béjaïa",
  "Biskra",
  "Béchar",
  "Blida",
  "Bouira",
  "Tamanrasset",
  "Tébessa",
  "Tlemcen",
  "Tiaret",
  "Tizi Ouzou",
  "Alger",
  "Djelfa",
  "Jijel",
  "Sétif",
  "Saïda",
  "Skikda",
  "Sidi Bel Abbès",
  "Annaba",
  "Guelma",
  "Constantine",
  "Médéa",
  "Mostaganem",
  "M'Sila",
  "Mascara",
  "Ouargla",
  "Oran",
  "El Bayadh",
  "Illizi",
  "Bordj Bou Arréridj",
  "Boumerdès",
  "El Tarf",
  "Tindouf",
  "Tissemsilt",
  "El Oued",
  "Khenchela",
  "Souk Ahras",
  "Tipaza",
  "Mila",
  "Aïn Defla",
  "Naâma",
  "Aïn Témouchent",
  "Ghardaïa",
  "Relizane",
  "Timimoun",
  "Bordj Badji Mokhtar",
  "Ouled Djellal",
  "Béni Abbès",
  "In Salah",
  "In Guezzam",
  "Touggourt",
  "Djanet",
  "El M'Ghair",
  "El Meniaa"
];
```

The UI should later support:
- French
- Arabic
- English

For MVP, start with French or English, but structure text using an i18n-friendly approach.

---

## 13. Registration Rules

Implement basic validation:

- User cannot register twice for the same category.
- Registration is blocked if event is not published.
- Registration is blocked if registration date is closed.
- Registration is blocked if max participants reached.
- Required participant fields must be completed.
- Required documents must be uploaded if event requires them.
- Organizer can manually confirm/reject registrations.

---

## 14. Security Requirements

Important from the start:

- Hash passwords using bcrypt or argon2.
- Use role-based access control.
- Organizers can only access their own organization/event data.
- Admin-only routes must be protected.
- Validate all forms using Zod.
- Never trust client-side role checks only.
- Use server-side authorization.
- Protect file uploads.
- Limit accepted file types.
- Add rate limiting for login/register routes.
- Use environment variables for secrets.
- Do not commit `.env` files.

---

## 15. Suggested Folder Structure

```txt
src/
  app/
    page.tsx
    races/
      page.tsx
      [slug]/
        page.tsx
        register/
          page.tsx
    organizer/
      page.tsx
      events/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx
          edit/
            page.tsx
          registrations/
            page.tsx
    admin/
      page.tsx
      users/
        page.tsx
      races/
        page.tsx
      organizations/
        page.tsx
    api/
      races/
      organizer/
      admin/
  components/
    ui/
    layout/
    races/
    forms/
  lib/
    auth.ts
    db.ts
    permissions.ts
    validations.ts
    algeria.ts
  prisma/
    schema.prisma
  types/
```

---

## 16. Development Tasks for Codex

Start with these tasks in order.

### Task 1 — Initialize project

Create a Next.js app with:
- TypeScript
- Tailwind CSS
- App Router
- ESLint
- shadcn/ui-ready structure

### Task 2 — Add database

Install and configure:
- Prisma
- PostgreSQL
- Initial schema from this document

Create:
- `prisma/schema.prisma`
- Initial migration
- Seed script with sample races

### Task 3 — Create public pages

Implement:
- Homepage
- Race listing page
- Race details page

Use mock/seed data first.

### Task 4 — Create auth

Implement:
- Register
- Login
- Logout
- User session
- Role-based redirects

### Task 5 — Create registration flow

Implement:
- Race registration form
- Server-side validation
- Save registration
- Show success page
- User registration history page

### Task 6 — Create organizer dashboard

Implement:
- Organizer events list
- Create event form
- Edit event form
- View registrations
- Export CSV

### Task 7 — Create admin dashboard

Implement:
- Admin list of pending organizations
- Admin list of pending races
- Approve/reject actions

### Task 8 — Add file uploads

Implement upload support for:
- Event images
- GPX files
- Payment proofs
- Medical certificates

For MVP, local upload is acceptable.
Later move to S3.

### Task 9 — Add production readiness

Add:
- Error pages
- Loading states
- Empty states
- Basic logging
- Rate limiting
- Security headers
- Backup documentation
- Deployment guide

---

## 17. Environment Variables

Create `.env.example`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/algeria_races"
NEXTAUTH_SECRET="change-me"
NEXTAUTH_URL="http://localhost:3000"

UPLOAD_PROVIDER="local"

# Future S3
AWS_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
S3_BUCKET_NAME=""

# Future email
EMAIL_PROVIDER=""
EMAIL_FROM=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
```

---

## 18. Seed Data

Create sample seed data:

Organizations:
- Alger Running Club
- Oran Trail Team
- Kabylie Mountain Runners

Events:
- Alger 10K
- Oran Half Marathon
- Tizi Ouzou Trail Challenge
- Constantine City Run

Categories:
- 5K
- 10K
- 21K
- 42K
- Trail 25K
- Trail 50K

---

## 19. Definition of Done for MVP

The MVP is ready when:

- Users can browse races.
- Users can register for races.
- Organizers can create events.
- Organizers can see participant lists.
- Admin can approve races.
- Registration data can be exported.
- The site works well on mobile.
- Data is stored in PostgreSQL.
- Basic security and authorization are implemented.

---

## 20. Important Product Notes

Do not overbuild the first version.

Avoid starting with:
- Complex ranking system
- Full payment gateway integration
- Mobile app
- Social network features
- Advanced timing/results system

Focus first on:
- Race discovery
- Registration
- Organizer management
- Trust and clean UX

Once the platform gets real organizers and users, add:
- Online payments
- SMS/WhatsApp notifications
- Race results
- Bib number generation
- QR code check-in
- Club rankings
- Mobile app
- Timing-chip provider integration

---

## 21. First Prompt for Codex

Use this prompt to start development:

```txt
You are building an MVP for an Algeria-focused running race platform.

Use Next.js, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

Start by creating the project structure, Prisma schema, seed data, and public pages:
- Homepage
- Race listing page
- Race details page

Follow the product brief in README_PROJECT.md.

Prioritize clean architecture, server-side validation, role-based access control, and mobile-first UI.

Do not implement payment gateway yet. Use manual payment status fields only.
```

---

## 22. Final Brand, Stack, Logo, and UI Identity

## 22.1 Final Platform Name

Use the following official working name throughout the codebase, UI, README, and seed data:

```txt
ZidRun
```

### Tagline

```txt
Find, register, and manage races across Algeria.
```

### French tagline

```txt
Trouvez, inscrivez-vous et gérez les courses en Algérie.
```

### Arabic / Darija-friendly tagline

```txt
كل سباقات الجزائر في بلاصة وحدة
```

### Brand Positioning

ZidRun is the central Algerian platform for discovering, registering for, and managing running events.

The platform should cover:

- Road races
- 5K races
- 10K races
- Half marathons
- Marathons
- Trail races
- Ultra trail events
- Kids races
- Charity races
- Community running events

ZidRun should feel like a modern community platform, not just a simple event listing website.

---

## 22.2 Product Personality

The UI and brand should feel:

```txt
Sporty
Clean
Trustworthy
Local
Energetic
Modern
Mobile-first
Community-focused
```

Avoid a design that feels too corporate, too luxury, or too complex.

The platform should feel accessible for both:

- Serious runners and trail athletes
- Casual people who want to join a local race for the first time

---

## 22.3 Final Recommended Tech Stack

Use this stack for the MVP:

| Layer | Technology |
|---|---|
| Framework | Next.js 15 |
| Language | TypeScript |
| Frontend | React |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Backend | Next.js Server Actions / API Routes |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Auth.js / NextAuth |
| File Storage | AWS S3 |
| Email | AWS SES |
| Cache / Queue Later | Redis |
| MVP Hosting | AWS EC2 or AWS Lightsail |
| Production Database | AWS RDS PostgreSQL |
| CDN | AWS CloudFront |
| Monitoring | CloudWatch, later Sentry |

The first version should be a single full-stack Next.js application.

Do not start with microservices.

Recommended MVP architecture:

```txt
Next.js App
  ├── Public website
  ├── Runner account
  ├── Organizer dashboard
  ├── Admin dashboard
  └── API routes / server actions

PostgreSQL
S3 for files
SES for emails
```

Later, if the platform grows, split heavy features such as payments, race timing, and notifications into separate services.

---

## 22.4 Logo Direction

The logo should use this concept:

```txt
A modern route/location pin icon + ZidRun wordmark
```

### Logo Meaning

The icon should combine:

- A location pin to represent race locations across Algeria
- A route or track curve to represent running routes
- A forward movement or speed line to represent racing and progress
- A clean wordmark for "ZidRun"

### Logo Requirements

The logo must work in:

- Website header
- Mobile app icon later
- Social media avatar
- Race bib print
- Organizer dashboard
- Black and white version
- Small sizes

### Avoid

Do not use:

- A realistic runner silhouette
- Too much detail
- A direct Algerian flag inside the logo
- A generic old marathon icon
- Complex gradients that do not print well
- Thin unreadable text

### Preferred Logo Layout

Use this default layout:

```txt
[Icon] ZidRun
```

Also prepare a square icon-only version for favicon and mobile app use.

---

## 22.5 Color Palette

Use this official ZidRun color palette:

| Use | Name | Hex |
|---|---|---|
| Primary | Deep Teal | `#0F766E` |
| Primary Dark | Dark Teal | `#115E59` |
| Accent | Energy Orange | `#F97316` |
| Accent Dark | Strong Orange | `#EA580C` |
| Background | Off White | `#F9FAFB` |
| Card Background | White | `#FFFFFF` |
| Text Dark | Charcoal | `#111827` |
| Muted Text | Gray | `#6B7280` |
| Border | Light Gray | `#E5E7EB` |
| Success | Green | `#16A34A` |
| Warning | Amber | `#F59E0B` |
| Error | Red | `#DC2626` |

### Primary CTA

Use orange for high-intent actions:

```txt
Register Now
Complete Registration
Create Event
```

### Secondary CTA

Use teal for discovery and navigation actions:

```txt
Find a Race
View Details
Browse Events
```

---

## 22.6 Typography

Use these fonts:

| Use | Font |
|---|---|
| Headings | Sora |
| Body/UI | Inter |
| Arabic UI later | IBM Plex Sans Arabic |

Font implementation:

```ts
// Recommended Next.js font setup
import { Inter, Sora, IBM_Plex_Sans_Arabic } from "next/font/google";
```

Use:

- Sora for large headings and hero sections
- Inter for forms, cards, tables, and dashboard UI
- IBM Plex Sans Arabic when Arabic support is added

---

## 22.7 UI Style Rules

The UI should use:

- Mobile-first layouts
- Large tappable buttons
- Rounded cards
- Clear race cards
- Soft shadows
- Minimal borders
- Strong registration CTA
- Good empty states
- Badge-based race status
- Clean dashboard tables

Recommended Tailwind feel:

```txt
rounded-2xl
shadow-sm
border border-gray-200
bg-white
text-gray-900
text-gray-500 for muted copy
```

---

## 22.8 Race Card Design

Race cards should include:

- Race image
- Race type badge
- Distance badge
- Wilaya/city badge
- Race name
- Date
- Location
- Starting price
- Registration status
- Register/View details button

Example structure:

```txt
┌───────────────────────────────┐
│ Event Image                   │
│                               │
│ [Trail] [25K] [Blida]          │
│ Chréa Trail Challenge          │
│ 12 October 2026                │
│ Blida, Chréa National Park     │
│                               │
│ From 2,500 DZD   Register →    │
└───────────────────────────────┘
```

---

## 22.9 Status Badges

Use consistent registration badges:

| Status | Badge Color |
|---|---|
| Registration Open | Green |
| Closing Soon | Orange |
| Full | Red or Gray |
| Coming Soon | Blue or Gray |
| Completed | Gray |
| Cancelled | Red |

---

## 22.10 Homepage Copy

Use this homepage hero copy:

```txt
Find your next race in Algeria.
Marathons, 10K races, trail runs, and community events — all in one place.
```

Hero buttons:

```txt
Find a Race
Create an Event
```

Organizer CTA:

```txt
Are you organizing a race?
Create your event and manage registrations online with ZidRun.
```

---

## 22.11 Code Naming

Use these names in the project:

```txt
App name: ZidRun
Package name: racedz
Database name: racedz
Main brand component: ZidRunLogo
Primary domain placeholder: zidrun.com
Fallback domain placeholder: zidrun.com
```

Suggested environment variables:

```env
NEXT_PUBLIC_APP_NAME="ZidRun"
NEXT_PUBLIC_APP_TAGLINE="Find, register, and manage races across Algeria."
```

---

## 22.12 Updated First Prompt for Codex

Use this updated prompt to start development:

```txt
You are building ZidRun, an MVP for an Algeria-focused running race platform.

Use Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, Auth.js, and a mobile-first design.

Brand identity:
- Name: ZidRun
- Tagline: Find, register, and manage races across Algeria.
- Colors: Deep Teal #0F766E and Energy Orange #F97316
- Headings: Sora
- Body: Inter
- UI style: clean, sporty, trustworthy, mobile-first
- Logo direction: route/location pin icon + ZidRun wordmark

Start by creating:
- Project structure
- Prisma schema
- Seed data
- Homepage
- Race listing page
- Race details page

Follow the product brief in README_PROJECT.md.

Prioritize clean architecture, server-side validation, role-based access control, and mobile-first UI.

Do not implement payment gateway yet. Use manual payment status fields only.
```
