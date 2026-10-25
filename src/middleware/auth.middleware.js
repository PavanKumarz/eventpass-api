import jwt from "jsonwebtoken";

export function authenticateToken(req,res,next){
    const authHeader=req.headers.authorization;


if(!authHeader|| !authHeader.startsWith(("Bearer "))){
    return res.status(401).json({
        success:false,
        message:"Authentication token required",
    });
}

const token=authHeader.slice(7);

if(!process.env.JWT_SECRET){
    console.error("JWT_SECRET is not configured");

    return res.status(500).json({
        success:false,
        message:"Athentication services is not configured",
    });
}

try {
    const payload=jwt.verify(token,process.env.JWT_SECRET,{
        issuer:"eventpass-api",
        audience:"eventpass-client"
    });

    if(typeof payload==="string" || !payload.sub){
        return res.status(401).json({
            success:false,
            message:"Invalid authentication token",
        });
    }

    req.user={
        id:payload.sub,
        role:payload.role,
    };

    next();
} catch (error) {
    return res.status(401).json({
        success:false,
        message:"Invalid or expired authentication token"
    });
}}