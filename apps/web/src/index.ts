// SPDX-License-Identifier: AGPL-3.0-only
import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

export default app;
