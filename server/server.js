const express = require("express");
const authRouter = require("./auth/route");
const chatRouter = require("./bill/route");
const fetchUser = require("./middleware/fetchuser");
const billSummaryRouter = require("./bill/billSummaryRoute");
const billsRouter = require("./bill/billsRoute");
const processBillRouter = require("./bill/processBillRoute");
const billChatRouter = require("./bill/billChatRoute");

const actChatRouter = require("./act/route");
const actSummaryRouter = require("./act/actSummaryRoute");
const actsRouter = require("./act/actsRoute");
const processActRouter = require("./act/processActRoute");
const actChatManagementRouter = require("./act/actChatRoute");
const egazettesRouter = require("./egazette/egazettesRoute");
const egazetteChatRouter = require("./egazette/egazetteChatRoute");
const egazetteSummaryRouter = require("./egazette/egazetteSummaryRoute");
const processEGazetteRouter = require("./egazette/processEGazetteRoute");
const policyRouter = require("./policy/route");
const policyChatRouter = require("./policy/policyChatRoute");
const policySummaryRouter = require("./policy/policySummaryRoute");
const processPolicyRouter = require("./policy/processPolicyRoute");
const documentChatRouter = require("./document/documentChatRoute");
const documentsRouter = require("./document/documentsRoute");
const dashboardRouter = require("./dashboard/route");
const profileRouter = require("./profile/route");
const catalogIngestionRouter = require("./catalog/ingestionRoute");
const activityRouter = require("./activity/route");
const contactRouter = require("./contact/route");
const internalCronRouter = require("./internal/cronRoute");
const recommendationsRouter = require("./recommendation/recommendationsRoute");
const graphRouter = require("./graph/route");
const { connectDB } = require("./db");
const cors = require("cors");
const {
  generalLimiter,
  authLimiter,
  helmetConfig,
} = require("./middleware/security");
require("dotenv").config();
require("./passport.js");
const app = express();
const port = process.env.PORT || 5001;

app.set("trust proxy", 1);
app.use(helmetConfig);

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = new Set([
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://localhost:3000",
      ]);

      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(generalLimiter);

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/contact", contactRouter);
app.use("/api/internal/cron", internalCronRouter);
app.use("/api/chat", fetchUser, chatRouter);
app.use("/api/bill-summary", fetchUser, billSummaryRouter);
app.use("/api/bills", fetchUser, billsRouter);
app.use("/api/process-bill", fetchUser, processBillRouter);
app.use("/api/bill-chats", billChatRouter);

app.use("/api/act-chat", fetchUser, actChatRouter);
app.use("/api/act-summary", fetchUser, actSummaryRouter);
app.use("/api/acts", fetchUser, actsRouter);
app.use("/api/process-act", fetchUser, processActRouter);
app.use("/api/act-chats", actChatManagementRouter);
app.use("/api/egazettes", fetchUser, egazettesRouter);
app.use("/api/egazette-chat", fetchUser, egazetteChatRouter);
app.use("/api/egazette-summary", fetchUser, egazetteSummaryRouter);
app.use("/api/process-egazette", fetchUser, processEGazetteRouter);
app.use("/api/policies", fetchUser, policyRouter);
app.use("/api/policy-chat", fetchUser, policyChatRouter);
app.use("/api/policy-summary", fetchUser, policySummaryRouter);
app.use("/api/process-policy", fetchUser, processPolicyRouter);
app.use("/api/document-chat", fetchUser, documentChatRouter);
app.use("/api/documents", fetchUser, documentsRouter);
app.use("/api/recommendations", fetchUser, recommendationsRouter);
app.use("/api/graph", graphRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/profile", profileRouter);
app.use("/api/catalog-operations", catalogIngestionRouter);
app.use("/api/activity", activityRouter);

app.get("/", (req, res) => {
  res.json({
    name: "Rashtram AI API",
    status: "OK",
    health: "/health",
  });
});

app.get("/health", async (req, res) => {
  try {
    await connectDB();
    res.status(200).json({
      status: "OK",
      database: "connected",
      aiProvider: "openai",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "ERROR",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

module.exports = app;
