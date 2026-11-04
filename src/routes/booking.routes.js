import express from "express";
import {randomUUID} from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.middleware.js";


const router=express.Router();

//Post /api/v1/bookings

router.post("/",authenticateToken,async(req,res)=>{
    try {
        const {eventId,quantity}=req.body;

        //Validate input
        if(
            typeof eventId!=="string" ||
            !eventId.trim() ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity >10
        ){
            return res.status(400).json({
                success:false,
                message:"Provide a valid eventId and a quantity between 1 and 10"
            });
        }

        const now=new Date();
        const expiresAt=new Date(now.getTime()+10*60*1000);

        const booking=await prisma.$transaction(async (tx)=>{
            //Reserve tickets only if the vent is published and enough tickets remains. This update  is atomic in PostgreSQL.
            
            const reservation=await tx.event.updateMany({
                where:{
                    id:eventId,
                    status:"PUBLISHED",
                    availableTickets:{gte:quantity},
                },
                data:{
                    availableTickets:{decrement:quantity},
                },
            });

            if(reservation.count===0){
                const event=await tx.event.findUnique({
                    where:{id:eventId},
                    select:{id:true,status:true}
                });

                if (!event){
                    const error=new Error("EVENT_NOT_FOUND");
                    throw error;
                }

                const error=new Error("INSUFFICIENT_TICKETS");
                throw error;
            }

            return tx.booking.create({
                data:{
                    userId:req.user.id,
                    eventId,
                    quantity,
                    status:"PENDING",
                    expiresAt,
                    tickets:{
                        create:Array.from({length:quantity},()=>({
                            userId:req.user.id,
                            eventId,
                            qrcode:randomUUID(),
                        })),
                    },
                },
                include:{
                    tickets:{
                        select:{
                            id:true,
                            qrcode:true,
                            checkedIn:true
                        }
                    }
                }
            });
        });

        return res.status(201).json({
            success:true,
            message:"Tickets reserved successfully",
            data:booking,
        });
    } catch (error) {
        if(error.message==="EVENT_NOT_FOUND"){
            return res.status(404).json({
                success:false,
                message:"Event not found"
            });
        }

        if(error.message==="EVENT_NOT_BOOKABLE"){
            return res.status(409).json({
                success:false,
                message:"This event is not available for booking",
            });
        }

        if(error.message==="INSUFFICIENT_TICKETS"){
            return res.status(409).json({
                success:false,
                message:"not enough tickets avaiable"
            });
        }

        console.error("Create booking failed:",error);

        return res.status(500).json({
            success:false,
            message:"Failed to create booking",
        });
    }

});


//Patch: /api/v1/bookings/:id/confirm
router.patch("/:id/confirm",authenticateToken,async(req,res)=>{
    try {
        const {id}=req.params;
        const now=new Date();

        const result=await prisma.$transaction(async (tx)=>{
            //Atomically confirm only this user's unexpired pending booking
            const updated=await tx.booking.updateMany({
                where:{
                    id,
                    userId:req.user.id,
                    status:"PENDING",
                    expiresAt:{gt:now},
                },
                data:{
                    status:"CONFIRMED",
                },
            });

            if (updated.count===0){
                const booking=await tx.booking.findFirst({
                    where:{
                        id,
                        userId:req.user.id,
                    },
                    select:{
                        id:true,
                        status:true,
                        expiresAt:true
                    },
                });

                if(!booking){
                    return {error:"NOT_FOUND"};
                }

                if(
                    booking.status==="PENDING" && booking.expiresAt<=now
                ){
                    return {error:"EXPIRED"};
                }
                return {error:"NOT_CONFIRMABLE"};
            }

            return{
                booking:await tx.booking.findUnique({
                    where:{id},
                    include:{
                        tickets:{
                            select:{
                                id:true,
                                qrcode:true,
                                checkedIn:true
                            },
                        },
                    },
                }),
            }
        });
        if(result.error==="NOT_FOUND"){
            return res.status(404).json({
                success:false,
                message:"Booking not found",
            });
        }

        if (result.error==="EXPIRED"){
            return res.status(409).json({
                success:false,
                message:"Booking has expired and cannot be confirmed"
            });
        }

        if (result.error==="NOT_CONFIRMABLE"){
            return res.status(409).json({
                success:false,
                message:"Booking cannot be conformed in its current state",

            });
        }

        return res.status(200).json({
            success:true,
            message:"Booking confirmed successfully",
            data:result.booking
        });


    } catch (error) {
        console.error("Confirm booking failed",error);

        return res.status(500).json({
            success:false,
            message:"Failed to confirm booking",
        });
    }
});
export default router;