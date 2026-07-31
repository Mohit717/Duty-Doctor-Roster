import { Router } from "express";
import { rosterController } from "./roster.controller";

const router = Router();
const controller = new rosterController();

router.get("/doctors", controller.getDoctors);
router.get("/roster", controller.getRoster);
router.post("/roster/generate", controller.generateRoster);
router.patch("/assignments/:id", controller.updateAssignment);

export default router;