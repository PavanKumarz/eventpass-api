import { prisma, } from "../lib/prisma.js";


export async function expirePendingBookings(){
    const now=new Date();

    //Find bookings whose reservation time has expired

    const expiredCandidates=await prisma.booking.findMany({
        where:{
            status:"PENDING",
            expiresAt:{
                lte:now,
            },
        },
        select:{
            id:true,
            eventId:true,
            quantity:true,
        },
    });

    let expiredCount=0;

    //Process each booking in its own transaction

    for (const booking of expiredCandidates){
        const didExpire=await prisma.$transaction(async (tx)=>{
            //claim the booking only if it is still pending and expired
            //This prevent two workers from releasing the same inventory

            const result=await tx.booking.updateMany({
                where:{
                    id:booking.id,
                    status:"PENDING",
                    expiresAt:{
                        lte:now
                    },
                },
                data:{
                    status:"EXPIRED",
                }
            });

            if(result.count===0){
                return false;
            }

            //Restore the tickets reserved by this booking
            await tx.event.update({
                where:{
                    id:booking.eventId,
                },
                data:{
                    availableTickets:{
                        increment:booking.quantity,
                    },
                },
            });
            return true;
        });

        if(didExpire){
            expiredCount++;
        }
    }

    return expiredCount;

}