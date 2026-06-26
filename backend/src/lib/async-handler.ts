import type { NextFunction, Request, Response } from "express";

export type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

export function asyncHandler(fn: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
