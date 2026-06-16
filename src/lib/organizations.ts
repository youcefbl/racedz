import { getPrisma } from "@/lib/db";
import { organizationRequestSchema } from "@/lib/validations";

export class OrganizationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationRequestError";
  }
}

export async function createOrganizationRequestForUser(userId: string, input: unknown) {
  const parsed = organizationRequestSchema.safeParse(input);

  if (!parsed.success) {
    throw new OrganizationRequestError("Check the organization request fields and try again.");
  }

  const prisma = getPrisma();
  const existingOpenRequest = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: {
        status: {
          in: ["PENDING", "APPROVED"]
        }
      }
    },
    include: {
      organization: true
    }
  });

  if (existingOpenRequest) {
    throw new OrganizationRequestError("You already have an open or approved organization.");
  }

  const slug = await createUniqueOrganizationSlug(parsed.data.name);

  return prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      email: parsed.data.email,
      phone: parsed.data.phone,
      website: parsed.data.website,
      facebookUrl: parsed.data.facebookUrl,
      instagramUrl: parsed.data.instagramUrl,
      wilaya: parsed.data.wilaya,
      city: parsed.data.city,
      commune: parsed.data.commune,
      status: "PENDING",
      members: {
        create: {
          userId,
          role: "OWNER"
        }
      }
    }
  });
}

export async function getUserOrganizationSummary(userId: string) {
  return getPrisma().organizationMember.findFirst({
    where: {
      userId
    },
    include: {
      organization: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function createUniqueOrganizationSlug(name: string) {
  const prisma = getPrisma();
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organization";
}
