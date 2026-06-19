import { paginationSchema } from "@/lib/validations";

export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function parsePagination(searchParams?: { page?: string | number; limit?: string | number }): PaginationParams {
  const parsed = paginationSchema.safeParse({
    page: searchParams?.page,
    limit: searchParams?.limit
  });

  const page = parsed.success ? parsed.data.page : 1;
  const limit = parsed.success ? parsed.data.limit : 25;

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

export function buildPaginationMeta(total: number, page: number, limit: number): Omit<PaginatedResult<unknown>, "items"> {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}
