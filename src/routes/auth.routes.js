import express from "express"
import bcrypt from "bcrypt"
import { prisma } from "../lib/prisma.js"
import jwt from "jsonwebtoken";
const router =express.Router();


//POST /api/v1/auth/register
router.post("/register",async(req,res)=>{
    try {
        const {name,email,password}=req.body;

        //1. validate required field
        if(
            typeof name !=="string"||
            typeof email !=="string" ||
            typeof password !=="string" ||
            !name.trim() ||
            !email.trim() ||
            !password

        ){
            return res.status(400).json({
                success:false,
                message:"Name,email,and password are required",
            });
        }

        const normalizedEmail=email.trim().toLowerCase();

        if(
            normalizedEmail.length>254||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ){
            return res.status(400).json({
                success:false,
                message:"Please provide a valid email address",
            });
        }

        if(password.length<8 || Buffer.byteLength(password,"utf8")>72){
            return res.status(400).json({
                success:false,
                message:"Password must be at least 8 characters and most 72 UTF-8 bytes",
            });
        }

        //2.Hash the password 
        const passwordHash=await bcrypt.hash(password,12);

        //3.create user in postgresql
        const user=await prisma.user.create({
            data:{
                name:name.trim(),
                email:normalizedEmail,
                passwordHash

            },
            select:{
                id:true,
                name:true,
                email:true,
                role:true,
                createdAt:true
            },
        });

        //4.return safe user information
        return res.status(201).json({
            success:true,
            message:"Account created successfully",
            data:user
        });

    } catch (error) {
    //postgreSQL unique constraint violation
    if(error.code==="P2002"){
        return res.status(409).json({
            success:false,
            message:"An account with this email already exits",
        });
    }

    console.error("Registraction failed:",error);

    return res.status(500).json({
        success:false,
        message:"Failed to create account"
    });
    }

});




//Post api/v1/auth/login
router.post("/login",async (req,res)=>{
    try {
        const {email,password}=req.body;

        if(
            typeof email!=="string"||
            typeof password!=="string"||
            !email.trim()||
            !password
        ){
            return res.status(400).json({
                success:false,
                message:"Email and password are required"
            });
        }

        const normalizedEmail=email.trim().toLowerCase();

        const user=await prisma.user.findUnique({
            where:{email:normalizedEmail}
        });

        //Use the same response for either incorrect field
        if(!user || !(await bcrypt.compare(password,user.passwordHash))){
            return res.status(401).json({
                success:false,
                message:"Invalid email or password",
            });
        }

        if(!process.env.JWT_SECRET){
            throw new Error("JWT_SECRET is not configured");
        }

        const token=jwt.sign(
            {role:user.role},
            process.env.JWT_SECRET,
            {
                subject:user.id,
                expiresIn:"1h",
                issuer:"eventpass-api",
                audience:"eventpass-client"
            }
        );

        return res.status(200).json({
            success:true,
            message:"Login successful",
            data:{
                user:{
                    id:user.id,
                    name:user.name,
                    email:user.email,
                    role:user.role
                },
                token,
                tokenType:"Bearer",
                expiresIn:3600,
            }
        });
    } catch (error) {
        console.error("Login failed:",error.message);

        return res.status(500).json({
            success:false,
            message:"Login failed"
        });
    }
});

export default router;