import express from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";



const router = express.Router();
//POST /api/v1/tickets/check-in
router.post(
  "/check-in",
  authenticateToken,
  authorizeRoles("ORGANIZER", "ADMIN"),
  async (req, res) => {
    try {
      const { qrCode } = req.body;

      if (typeof qrCode !== "string" || !qrCode.trim()) {
        return res.status(400).json({
          success: false,
          message: "A valid qrCode is required",
        });
      }

      const ticket = await prisma.$transaction(async (tx) => {
        const existingTicket = await tx.ticket.findUnique({
          where: { qrcode: qrCode.trim() },
          select: {
            id: true,
            eventId: true,
            checkedIn: true,
            booking: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!existingTicket) {
          return { error: "TICKET_NOT_FOUND" };
        }

//Organizers can check in tickets only for their own events
    //Admins can check in tickets for any event
        if (req.user.role !== "ADMIN") {
          const event = await tx.event.findUnique({
            where: { id: existingTicket.eventId },
            select: { organizerId: true },
          });

          if (!event || event.organizerId !== req.user.id) {
            return { error: "NOT_EVENT_OWNER" };
          }
        }

        if (existingTicket.booking.status !== "CONFIRMED") {
          return { error: "BOOKING_NOT_CONFIRMED" };
        }

        if (existingTicket.checkedIn) {
          return { error: "ALREADY_CHECKED_IN" };
        }

        const result = await tx.ticket.updateMany({
          where: {
            id: existingTicket.id,
            checkedIn: false,
            booking: {
              status: "CONFIRMED",
            },
          },
          data: {
            checkedIn: true,
            checkedInAt: new Date(),
          },
        });

        if (result.count === 0) {
          return { error: "ALREADY_CHECKED_IN" };
        }

        return {
          ticket: await tx.ticket.findUnique({
            where: { id: existingTicket.id },
            select: {
              id: true,
              eventId: true,
              checkedIn: true,
              checkedInAt: true,
            },
          }),
        };
      });

      if (ticket.error === "TICKET_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      if (ticket.error === "NOT_EVENT_OWNER") {
        return res.status(403).json({
          success: false,
          message: "You cannot check in tickets for an event you do not own",
        });
      }

      if (ticket.error === "BOOKING_NOT_CONFIRMED") {
        return res.status(409).json({
          success: false,
          message: "Ticket booking is not confirmed",
        });
      }

      if (ticket.error === "ALREADY_CHECKED_IN") {
        return res.status(409).json({
          success: false,
          message: "Ticket has already been checked in",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Ticket checked in successfully",
        data: ticket.ticket,
      });
    } catch (error) {
      console.error("Ticket check-in failed:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to check in ticket",
      });
    }
  }
);

export default router;