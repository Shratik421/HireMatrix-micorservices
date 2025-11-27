import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken"
import { JwtPayload } from "jsonwebtoken";
import { sql } from "../utils/db.js";
interface User {
    user_id: number;
    name: string;
    email: string;
    phone_number: string;
    role: "jobseeker" | "recruiter";
    bio: string | null;
    resume: string | null;
    resume_public_id: string | null;
    profile_pic: string | null;
    profile_pic_public_id: string | null;
    skills: string[];
    subscription: string | null;
}


export interface AuthenticatedRequest extends Request {
    user?: User
}
export const isAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        // console.log("authHeader : ",authHeader);

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                message: "Authorization header is missing or invalid",
            })
            return
        }

        const token: any = authHeader.split(" ")[1];
        // console.log("token : ",token)

        const decodedPayload = jwt.verify(
            token, process.env.JWT_SECRET!
        ) as JwtPayload

        // console.log("decodedPayload :",decodedPayload);
        

        if (!decodedPayload || !decodedPayload.id) {
            res.status(401).json({
                message: "Invalid token",
            })
            return
        }

        const users = await sql`
        SELECT u.user_id, u.name, u.email, u.phone_number,u.role , u.bio,u.resume, u.resume_public_id,u.profile_pic,u.profile_pic_public_id,u.subscription ,
        ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) as skills
        FROM users u LEFT JOIN user_skills us ON u.user_id  = us.user_id LEFT JOIN skills s ON us.skill_id = s.skill_id WHERE u.user_id= ${decodedPayload.id}
        GROUP BY u.user_id;
        `;

        // console.log("users : ",users);
        

        if (users.length === 0) {
            res.status(401).json({
                message: "User associated with this token no loger exists"
            })
            return
        }

        const user = users[0] as User;

    // console.log("user  : ",user);
    

        user.skills = user.skills || [];
        req.user = user;
        next();
    } catch (error) {
          console.error("AUTH ERROR:", error);
        res.status(401).json({
            message: "Authentication Failed , Please Login again"
        })
    }
}