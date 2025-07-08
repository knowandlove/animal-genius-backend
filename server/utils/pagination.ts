/**
 * Pagination utilities for API endpoints
 */

import { Request } from 'express';
import { CONFIG } from '../config/constants';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Default and maximum pagination limits
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_LIMIT: CONFIG.PAGINATION.DEFAULT_LIMIT,
  MAX_LIMIT: CONFIG.PAGINATION.MAX_LIMIT,
  MIN_LIMIT: CONFIG.PAGINATION.MIN_LIMIT
};

/**
 * Extract and validate pagination parameters from request
 */
export function getPaginationParams(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const requestedLimit = parseInt(req.query.limit as string) || PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  
  // Enforce min and max limits
  const limit = Math.min(
    Math.max(requestedLimit, PAGINATION_DEFAULTS.MIN_LIMIT),
    PAGINATION_DEFAULTS.MAX_LIMIT
  );
  
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Add pagination info to response headers
 */
export function setPaginationHeaders(
  res: any,
  page: number,
  limit: number,
  total: number
): void {
  const totalPages = Math.ceil(total / limit);
  
  res.setHeader('X-Pagination-Page', page);
  res.setHeader('X-Pagination-Limit', limit);
  res.setHeader('X-Pagination-Total', total);
  res.setHeader('X-Pagination-Total-Pages', totalPages);
  
  // Add Link header for API navigation
  const links: string[] = [];
  const baseUrl = `${res.req.protocol}://${res.req.get('host')}${res.req.baseUrl}${res.req.path}`;
  
  if (page > 1) {
    links.push(`<${baseUrl}?page=1&limit=${limit}>; rel="first"`);
    links.push(`<${baseUrl}?page=${page - 1}&limit=${limit}>; rel="prev"`);
  }
  
  if (page < totalPages) {
    links.push(`<${baseUrl}?page=${page + 1}&limit=${limit}>; rel="next"`);
    links.push(`<${baseUrl}?page=${totalPages}&limit=${limit}>; rel="last"`);
  }
  
  if (links.length > 0) {
    res.setHeader('Link', links.join(', '));
  }
}