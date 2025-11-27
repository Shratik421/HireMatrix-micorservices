import { redisClient } from './../index.js';
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";
import bcrypt from "bcrypt"
import axios from "axios"
import jwt from "jsonwebtoken"
import { forgotPasswordTemplate } from "../template.js";
import { publishToTopic } from "../producer.js";
// import { redisClient } from "..";

export const registerUser = TryCatch(async (req, res, next) => {

    const { email, name, password, phoneNumber, role, bio } = req.body;

    if (!email || !name || !password || !phoneNumber || !role) {
        throw new ErrorHandler(400, "Please fill all details");
    }


    const existingUsers = await sql`SELECT user_id from users WHERE email = ${email} `;

    if (existingUsers.length > 0) {
        throw new ErrorHandler(409, "User with this email already register")
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let registeredUser;
    if (role === "recruiter") {
        const [user] = await sql`INSERT INTO users(name ,email, password, phone_number,role) VALUES 
            (${name}, ${email} , ${hashedPassword} ,${phoneNumber} ,${role} ) RETURNING
            user_id, name ,email, phone_number, role ,created_at
            `
        registeredUser = user;
    } else if (role === "jobseeker") {
        const file = req.file

        if (!file) {
            throw new ErrorHandler(400, "Resume File is Required for jobseeeker")
        }
        const fileBuffer = getBuffer(file);
        if (!fileBuffer) {
            throw new ErrorHandler(500, "Failed to generate Buffer")
        }
        const { data } = await axios.post(`${process.env.UPLOAD_SERVICE}/api/utils/upload`,
            { buffer: fileBuffer.content }
        )

        const [user] =
            await sql`INSERT INTO users(name ,email, password, phone_number,role,bio,resume,resume_public_id) VALUES 
            (${name}, ${email} , ${hashedPassword} ,${phoneNumber} ,${role},${bio},${data.url},${data.public_id} ) RETURNING
            user_id, name ,email, phone_number, role,bio,resume ,created_at`
        registeredUser = user;

    }

    const token = jwt.sign({ id: registeredUser?.user_id }, process.env.JWT_SECRET!, { expiresIn: "15d" })

    res.json({ message: `User with email ${email} registered successfully.`, user: registeredUser, token });
})


export const loginUser = TryCatch(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ErrorHandler(400, "Please fill all details");
    }

    const user = await sql`
    SELECT u.user_id , u.name, u.email , u.password , u.phone_number,u.role,u.bio, u.resume, u.profile_pic,u.subscription, ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL )  as skills FROM users u LEFT JOIN user_skills  us ON u.user_id  = us.user_id LEFT JOIN skills s ON us.skill_id = s.skill_id 
    WHERE u.email = ${email} GROUP BY u.user_id;
    `;
    console.log("user :", user)
    if (user.length === 0) {
        throw new ErrorHandler(400, "Invalid credentials")
    }

    const userObject = user[0];
    if (!userObject) {
        throw new ErrorHandler(400, "Invalid credentials");
    }

    const matchPassword = await bcrypt.compare(password, userObject?.password)

    if (!matchPassword) {
        throw new ErrorHandler(400, "Invalid credentials")
    }

    userObject.skills = userObject.skills || [];

    delete userObject.password;


    const token = jwt.sign({ id: userObject?.user_id }, process.env.JWT_SECRET!, { expiresIn: "15d" })

    res.json({ message: `User logged successfully.`, user: userObject, token });

})



export const forgetPasword = TryCatch(async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        throw new ErrorHandler(400, "email is required")
    }

    const users = await sql`SELECT user_id, email FROM users WHERE email =${email}`;

    if (users.length === 0) {
        return res.json({
            message: " If that email exists , we have sent a reset link ",
        })
    }

    const user: any = users[0]
    const resetToken = jwt.sign({
        email: user.email, type: "reset"
    }, process.env.JWT_SECRET!, { expiresIn: "15m" })

    const resetLink = `${process.env.FRONTEND_URL}/reset/${resetToken}`


    await redisClient.set(`forget:${email}`, resetToken, {
        EX: 900
    })

    const message = {
        to: email,
        subject: "Reset your password - HireMatrix",
        html: forgotPasswordTemplate(resetLink),
    }

    publishToTopic("send-mail", message).catch((error) => {
        console.log("failed to send message  : ", error);
    });

    res.json({ message: " If that email exists , we have sent a reset link " })
})

export const resetPassword = TryCatch(async (req, res, next) => {
    const { token }: any = req.params;
    const { password } = req.body;

    let decoded: any;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!)

    } catch (error) {
        throw new ErrorHandler(400, "unAuthorized token")
    }

    if (decoded.type !== "reset") {
        throw new ErrorHandler(400, "Invalid token type");
    }

    const email = decoded.email

    const storedToken = await redisClient.get(`forget:${email}`)

    if (!storedToken || storedToken !== token) {
        throw new ErrorHandler(400, "Token has been expired");
    }

    const users = await sql`SELECT user_id FROM users WHERE email = ${email}`

    if (users.length === 0) {
        throw new ErrorHandler(404, "user not found");
    }

    const user = users[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await sql`UPDATE users SET password = ${hashedPassword} WHERE user_id  =${user?.user_id}`

    await redisClient.del(`forget:${email}`)

    res.json({ message: "Password Changed successfully" })
})