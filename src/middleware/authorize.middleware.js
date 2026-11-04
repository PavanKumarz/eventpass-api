export const authorizeRoles = (...allowedRoles)=>{
    return (req,res,next)=>{
        //The authentication middleware must run first
        if(!req.user){
            return res.status(401).json({
                success:false,
                message:"Authentication required"
            });
        }

        //check wheteher the user's role is alllowed
        if(!allowedRoles.includes(req.user.role)){
            return res.status(403).json({
                success:false,
                message:"You do not have permission to perform this action"
            });
        }
        next();
    }
}