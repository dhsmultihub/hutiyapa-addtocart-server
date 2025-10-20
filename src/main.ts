import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cartRouter from "./cart";

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/cart", cartRouter);

// Basic error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

const port = Number(process.env["PORT"]) || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`cart-server listening on port ${port}`);
});


