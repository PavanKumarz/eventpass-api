import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.routes.js"
import { authenticateToken } from "./middleware/auth.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api/v1/auth",authRoutes);

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
app.post("/api/v1/events",authenticateToken, async (req, res) => {
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


// //Get all events
// app.get("/api/v1/events",async(req,res)=>{
//   try {
//     const events=await prisma.event.findMany({
//       orderBy:{
//         createdAt:"desc",
//       }
//     });

//     return res.status(200).json({
//       success:true,
//       count:events.length,
//       data:events
//     });
//   } catch (error) {
//     console.error("Get events failed:",error);
//     return res.status(500).json({
//       success:false,
//       message:"Failed to fetch events"
//     });
//   }
// });


//Get a single event by id 
app.get("/api/v1/events/:id",async(req,res)=>{
  try {
    const {id}=req.params;

    const event =await prisma.event.findUnique({
      where:{id},
    });

    if(!event){
      return res.status(404).json({
        success:false,
        message:"Event not found"
      });
    }

    return res.status(200).json({
      success:true,
      data:event,
    });
  } catch (error) {
    console.error("Get event failed:",error);

    return res.status(500).json({
      success:false,
      message:"Failed to fetch event"
    });
  }
});


//get all events with pagination
app.get("/api/v1/events",async(req,res)=>{
  try {
    //read pagination values from URL
    const page=Math.max(
      1,
      Number.parseInt(req.query.page,10) || 1   
    );

    const limit =Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)|| 10)
  );

  //calculate how many records to skip
  const skip=(page-1)*limit;


  // //Fetch events and total count from the database
  // const[events,totalEvents]=await prisma.$transaction([
  //   prisma.event.findMany({
  //     skip,
  //     take:limit,
  //     orderBy:{
  //       createdAt:"desc",
  //     },
  //   }),
  //   prisma.event.count(),
  // ])

  // fiilter event by status
  const {status}=req.query
  // validate the requested status
  const allowedStatuses=["DRAFT","PUBLISHED","CANCELLED"];

  if(status && !allowedStatuses.includes(status)){
    return res.status(400).json({
      success:false,
      message:"Invalid status.Use DRAFT,PUBLISHED, or CANCELLED",
    });

  }

  const where=status ? {status} : {};

  const[events,totalEvents]=await prisma.$transaction([
    prisma.event.findMany({
      where,
      skip,
      take:limit,
      orderBy:{
        createdAt:"desc",
      },
    }),
    prisma.event.count({where}),
  ])

  const totalPages=Math.ceil(totalEvents/limit);

  return res.status(200).json({
    success:true,
    pagination:{
      currentPage:page,
      limit,
      totalEvents,
      totalPages,
      hasNextPage:page <totalPages,
      hasPreviousPage:page>1 && totalEvents >0,
    },
    data:events
  });
  } catch (error) {
    console.error("Get events failed:",error);

    return res.status(500).json({
      success:false,
      message:"Failed to fetch events"
    });
  }
});

// //publish an event
// app.patch("/api/v1/events/:id/publish",async(req,res)=>{
//   try {
//     const {id}=req.params;

//     const event=await prisma.event.findUnique({
//       where:{id},
//     });

//     if(!event){
//       return res.status(404).json({
//         success:false,
//         message:"Event not found"
//       });
//     }

//     if (event.status!=="DRAFT"){
//       return res.status(400).json({
//         success:false,
//         message:"Only draft events can be published"
//       });
//     }

//     const publishedEvent= await prisma.event.update({
//       where:{id},
//       data:{status:"PUBLISHED"},
//     });

//     return res.status(200).json({
//       success:true,
//       message:"Event published successfully",
//       data:publishedEvent,
//     });
//   } catch (error) {
//     console.error("Publish event failed:",error);


//     return res.status(500).json({
//       success:false,
//       message:"Failed to publish event"
//     });
//   }
// });


//Publish an event atomically
app.patch("/api/v1/events/:id/publish",async(req,res)=>{
  try {
    const{id}=req.params;

    const result =await prisma.event.updateMany({
      where:{
        id,
        status:"DRAFT",
      },
      data:{
        status:"PUBLISHED",
      }
    });

    if (result.count===0){
      const event=await prisma.event.findUnique({
        where:{id},
        select:{id:true}
      });

      if(!event){
        return res.status(404).json({
          success:false,
          message:"Event not found",
        });
      }

      return res.status(409).json({
        success:false,
        message:"Only draft event can be published"
      });
    }

    const publishedEvent=await prisma.event.findUnique({
      where:{id},
    });

    return res.status(200).json({
      success:true,
      message:"Event published successfully",
      data:publishedEvent
    });


  } catch (error) {
    console.error("Publish event failed:",error);

    return res.status(500).json({
      success:false,
      message:"Failed to publish event"
    })
  }
});


//cancel a published event atomically
app.patch("/api/v1/events/:id/cancel",async(req,res)=>{
  try {
    
    const {id}=req.params;

    const result=await prisma.event.updateMany({
      where:{
        id,
        status:"PUBLISHED",
      },
      data:{
        status:"CANCELLED",
      },
    });

    if(result.count===0){
      const event=await prisma.event.findUnique({
        where:{id},
        select:{id:true,status:true},
      });

      if(!event){
        return res.status(404).json({
          success:false,
          message:"Event not found",
        });
      }

      return res.status(409).json({
        success:false,
        message:"Only published events can be cancelled"
      });
    }

    const cancelledEvent=await prisma.event.findUnique({
      where:{id}
    });

    return res.status(200).json({
      success:true,
      message:"Event cancelled successfully",
      data:cancelledEvent
    });
  } catch (error) {
    console.error("Cancel event failed",error);

    return res.status(500).json({
      success:false,
      message:"Failed to cancel event"
    });
  }
});


//Protected route for testing JWT authentication
app.get("/api/v1/auth/me",authenticateToken,async(req,res)=>{
  try {
    const user=await prisma.user.findUnique({
      where:{id:req.user.id},
      select:{
        id:true,
        name:true,
        email:true,
        role:true,
        createdAt:true
      },
    });

    if(!user){
      return res.status(401).json({
        success:false,
        message:"User account not found"
      });
    }

    return res.status(200).json({
      success:true,
      data:user,
    });
  } catch (error) {
    console.error("Fetch current user failed",error);

    return res.status(500).json({
      success:false,
      message:"Failed to fetch current user"
    })
  }
})
export default app;
