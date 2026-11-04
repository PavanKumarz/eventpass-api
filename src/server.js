import "dotenv/config";
import app from "./app.js";
import { expirePendingBookings } from "./services/booking-expiration.service.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`EventPass API running on port ${PORT}`);

  //Run an intial epiration check
  expirePendingBookings().catch((error)=>{
    console.error("Initial booking expiration failed:",error);
  });

  //check for expired bookings every 30 seconds

  setInterval(()=>{
    expirePendingBookings().catch((error)=>{
      console.error("Booking expiration failed",error);
    });
  },30_000)
});