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

function extractDeviceDetails(userAgent) {
  const parser = new UAParser(userAgent || "");
  const ua = parser.getResult();
  const deviceDetails = {
    type: ua.device?.type || null,
    vendor: ua.device?.vendor || null,
    model: ua.device?.model || null,
    os: {
      name: ua.os?.name || null,
      version: ua.os?.version || null
    },
    browser: {
      name: ua.browser?.name || null,
      version: ua.browser?.version || null
    }
  };
  const summaryParts = [];
  if (deviceDetails.vendor || deviceDetails.model) {
    summaryParts.push(
      [deviceDetails.vendor, deviceDetails.model].filter(Boolean).join(" ")
    );
  }
  if (deviceDetails.type) {
    summaryParts.push(`type: ${deviceDetails.type}`);
  }
  const osSummary = [deviceDetails.os.name, deviceDetails.os.version]
    .filter(Boolean)
    .join(" ");
  if (osSummary) {
    summaryParts.push(`OS: ${osSummary}`);
  }
  const browserSummary = [
    deviceDetails.browser.name,
    deviceDetails.browser.version
  ]
    .filter(Boolean)
    .join(" ");
  if (browserSummary) {
    summaryParts.push(`Browser: ${browserSummary}`);
  }

  return {
    details: deviceDetails,
    summary: summaryParts.join(" | ") || null
  };
}

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
    const userAgent = req.headers["user-agent"] || "";
    const { details: deviceDetails, summary: deviceSummary } =
      extractDeviceDetails(userAgent);

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
      userAgent: userAgent || null,
      device: {
        ...deviceDetails,
        summary: deviceSummary
      },
      headers: {
        host: req.headers["host"],
        "accept-language": req.headers["accept-language"],
        "sec-ch-ua-platform": req.headers["sec-ch-ua-platform"],
        "sec-ch-ua": req.headers["sec-ch-ua"],
        "sec-ch-ua-mobile": req.headers["sec-ch-ua-mobile"],
        referer: req.headers["referer"],
        origin: req.headers["origin"]
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
  const userAgent = req.headers["user-agent"] || "";
  const { details: deviceDetails, summary: deviceSummary } =
    extractDeviceDetails(userAgent);

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
    client: data,
    userAgent: userAgent || null,
    device: {
      ...deviceDetails,
      summary: deviceSummary
    }
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
