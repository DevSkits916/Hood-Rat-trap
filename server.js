import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { RateLimiterMemory } from "rate-limiter-flexible";
import UAParser from "ua-parser-js";
import { writeVisit, hashIP } from "./logger.js";
import { clientPayloadSchema } from "./validators.js";

const app = express();

const PORT = process.env.PORT || 10000;
const CONSENT_REQUIRED = process.env.CONSENT_REQUIRED === "true";

app.disable("x-powered-by");

// security + parsing
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

// access log to stdout
app.use(morgan("combined"));

// static files
app.use(express.static("public", { etag: true, maxAge: "1h" }));

// rate limit POST /collect to deter spam
const limiter = new RateLimiterMemory({ points: 60, duration: 60 }); // 60/min
app.use("/collect", async (req, res, next) => {
  try {
    await limiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ ok: false, error: "Too many requests" });
  }
});

// health check
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// server-side visit log on every page request (minimal)
app.use((req, _res, next) => {
  if (req.method === "GET" && req.accepts(["html", "json"]) === "html") {
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();
    const rawIP =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const ipHash = hashIP(rawIP);

    writeVisit({
      ts: new Date().toISOString(),
      kind: "pageview",
      path: req.path,
      method: req.method,
      ipHash,
      headers: {
        host: req.headers["host"],
        "accept-language": req.headers["accept-language"],
        "sec-ch-ua-platform": req.headers["sec-ch-ua-platform"],
        "sec-ch-ua": req.headers["sec-ch-ua"],
        "sec-ch-ua-mobile": req.headers["sec-ch-ua-mobile"],
        referer: req.headers["referer"],
        origin: req.headers["origin"]
      },
      uaParsed: {
        browser: ua.browser,
        os: ua.os,
        device: ua.device,
        engine: ua.engine
      }
    });
  }
  next();
});

// receive client-side details
app.post("/collect", (req, res) => {
  const parse = clientPayloadSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  const data = parse.data;
  const rawIP =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "";
  const ipHash = hashIP(rawIP);

  writeVisit({
    ts: new Date().toISOString(),
    kind: "client",
    ipHash,
    path: req.headers["referer"] || req.body?.ref || null,
    client: data
  });

  res.json({ ok: true });
});

// config for the frontend
app.get("/config", (_req, res) => {
  res.json({ consentRequired: CONSENT_REQUIRED });
});

app.listen(PORT, () => {
  console.log(`listening on :${PORT}`);
});
