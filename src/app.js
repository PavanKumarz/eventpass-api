import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EventPass API is running",
    timestamp: new Date().toISOString(),
  });
});

//check db
app.get("/api/v1/db-check",async(req,res)=>{
  try{
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      success:true,
      message:"PostgreSQL connected through Prisma",
    });
  }catch(error){
    console.error("Database check failed:",error.message);
    res.status(500).json({
      success:false,
      message:"Database connection failed"
    })
  }
});



// Create event
app.post("/api/v1/events", async (req, res) => {
  try {
    const {
      title,
      description,
      venue,
      startsAt,
      totalTickets,
      priceInPaise,
    } = req.body;

    // Basic validation
    if (
      !title ||
      !venue ||
      !startsAt ||
      totalTickets === undefined ||
      priceInPaise === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "title, venue, startsAt, totalTickets, and priceInPaise are required",
      });
    }

    if (
      typeof title !== "string" ||
      typeof venue !== "string" ||
      title.trim() === "" ||
      venue.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "title and venue must be non empty strings",
      });
    }

    const startDate = new Date(startsAt);

    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "startsAt must be a valid date",
      });
    }

    if (
      !Number.isInteger(totalTickets) ||
      totalTickets <= 0 ||
      !Number.isInteger(priceInPaise) ||
      priceInPaise < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "totalTickets must be a positive integer and priceInPaise a non negative integer",
      });
    }

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description,
        venue: venue.trim(),
        startsAt: startDate,
        totalTickets,
        availableTickets: totalTickets,
        priceInPaise,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: event,
    });
  } catch (error) {
    console.error("Create event failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create event",
    });
  }
});



export default app;