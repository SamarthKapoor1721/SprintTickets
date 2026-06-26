import { Router } from "express";

export const statusRouter = Router();

statusRouter.get("/", (_req, res) => {
  res.json({ status: "ok", service: "Executive Review Hub API" });
});
