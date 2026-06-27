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
const dashboardRouter = require("./dashboard/route");
const connectDB = require("./db");
const cors = require("cors");
const {
  generalLimiter,
  authLimiter,
  helmetConfig,
} = require("./middleware/security");
require("dotenv").config();
const passport = require("./passport.js");
const app = express();
const port = process.env.PORT || 5001;

app.set("trust proxy", 1);
app.use(helmetConfig);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

connectDB();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(generalLimiter);

app.use("/api/auth", authLimiter, authRouter);
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
app.use("/api/dashboard", dashboardRouter);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
