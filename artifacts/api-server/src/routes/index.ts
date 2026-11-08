import { Router, type IRouter } from "express";
import healthRouter from "./health";
import setupRouter from "./setup";
import authRouter from "./auth";
import universeRouter from "./universe";
import adminRouter from "./admin";
import merchantRouter from "./merchant";
import noticesRouter from "./notices";
import pushRouter from "./push";

const router: IRouter = Router();

// El orden importa: las rutas públicas van antes del candado de vecinos.
router.use(healthRouter);
router.use(setupRouter);
router.use(authRouter);
router.use(merchantRouter);
router.use(pushRouter);
router.use(noticesRouter);
router.use(universeRouter);
router.use(adminRouter);

export default router;
