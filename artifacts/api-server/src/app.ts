import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadSession } from "./lib/auth";

const app: Express = express();

// Replit y la mayoría de hostings ponen un proxy delante: necesario para req.ip y cookies seguras.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Sin CORS: la web y la API viven en el mismo dominio, así nadie más puede usar la sesión.
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(loadSession);

app.use("/api", router);

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ message: "Ruta no encontrada." });
});

// Express 5 envía aquí los errores de handlers async.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === "object" && (err as { name?: string }).name === "ZodError") {
    res.status(400).json({ message: "Datos inválidos.", issues: (err as { issues?: unknown }).issues });
    return;
  }
  req.log?.error({ err }, "unhandled error");
  res.status(500).json({ message: "Algo falló de nuestro lado. Inténtalo de nuevo." });
});

export default app;
