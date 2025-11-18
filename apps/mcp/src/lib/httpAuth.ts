import type { Request } from "express";

/**
 * Verifies a Bearer token in the Authorization header against an expected value.
 */
export const verifyBearerToken = (req: Request, expectedValue: string): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.substring("Bearer ".length);
  return token === expectedValue;
};


