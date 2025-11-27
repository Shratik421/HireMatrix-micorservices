
import express from "express";
import cloudinary from "cloudinary"
import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();


const router = express.Router();
const ai = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);




router.post("/upload", async (req, res) => {
    try {
        const { buffer, public_id } = req.body;
        if (public_id) {
            await cloudinary.v2.uploader.destroy(public_id)
        }
        const cloud = await cloudinary.v2.uploader.upload(buffer)
        res.json({
            url: cloud.secure_url,
            public_id: cloud.public_id
        })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
})

router.post("/career", async (req, res) => {
    try {
        const { skills } = req.body;

        if (!skills || skills.length === 0) {
            return res.status(400).json({ message: "Skills required" });
        }

        const model = ai.getGenerativeModel({
            model: "gemini-2.0-flash", // or gemini-2.0-pro
        });

        const prompt = ` 
Based on the following skills: ${skills}. 
 
Please act as a career advisor and generate a career path suggestion. 
Your entire response must be in a valid JSON format. Do not include any text or markdown 
formatting outside of the JSON structure. 
 
The JSON object should have the following structure: 
{ 
 "summary": "A brief, encouraging summary of the user's skill set and their general job 
title.", 
 "jobOptions": [ 
 { 
"title": "The name of the job role.", 
"responsibilities": "A description of what the user would do in this role.", 
"why": "An explanation of why this role is a good fit for their skills." 
 } 
 ], 
 "skillsToLearn": [ 
 { 
"category": "A general category for skill improvement (e.g., 'Deepen Your Existing Stack 
Mastery', 'DevOps & Cloud').", 
"skills": [ 
 { 
 "title": "The name of the skill to learn.", 
 "why": "Why learning this skill is important.", 
 "how": "Specific examples of how to learn or apply this skill." 
 } 
] 
 } 
 ], 
 "learningApproach": { 
"title": "How to Approach Learning", 
"points": ["A bullet point list of actionable advice for learning."] 
 } 
} 
 `;

        const result = await model.generateContent(prompt);

        const text = result.response.text();
        const rawText = text?.replace(/```json/g, " ").replace(/```/g, "").trim();


        if (!rawText) {
            throw new Error("Ai did not return a valid text response")
        }
        console.log(rawText);


        let jsonResponse;
        try {
            jsonResponse = JSON.parse(rawText);
        } catch (e) {
            return res.status(500).json({
                message: "Gemini returned invalid JSON",
                raw: rawText,
            });
        }

        res.json(jsonResponse);
    } catch (error: any) {
        console.log("error : ", error);
        res.status(500).json({ message: error.message })
    }
})


router.post("/resume-analyser", async (req, res) => {
    try {
        const { pdfBase64 } = req.body;
        if (!pdfBase64) {
            return res.status(400).json({ mesage: "pdf is required" })
        }

        const prompt = ` 
You are an expert ATS (Applicant Tracking System) analyzer. Analyze the following resume 
and provide: 
1. An ATS compatibility score (0-100) 
2. Detailed suggestions to improve the resume for better ATS performance 
 
Your entire response must be in valid JSON format. Do not include any text or markdown 
formatting outside of the JSON structure. 
 
The JSON object should have the following structure: 
{ 
  "atsScore": 85, 
  "scoreBreakdown": { 
    "formatting": { 
      "score": 90, 
      "feedback": "Brief feedback on formatting" 
    }, 
    "keywords": { 
      "score": 80, 
      "feedback": "Brief feedback on keyword usage" 
    }, 
    "structure": { 
      "score": 85, 
      "feedback": "Brief feedback on resume structure" 
    }, 
    "readability": { 
      "score": 88, 
      "feedback": "Brief feedback on readability" 
    } 
  }, 
  "suggestions": [ 
    { 
      "category": "Category name (e.g., 'Formatting', 'Content', 'Keywords', 
'Structure')", 
      "issue": "Description of the issue found", 
      "recommendation": "Specific actionable recommendation to fix it", 
      "priority": "high/medium/low" 
    } 
  ], 
  "strengths": [ 
    "List of things the resume does well for ATS" 
  ], 
  "summary": "A brief 2-3 sentence summary of the overall ATS performance" 
} 
 
Focus on: - File format and structure compatibility - Proper use of standard section headings - Keyword optimization - Formatting issues (tables, columns, graphics, special characters) - Contact information placement - Date formatting - Use of action verbs and quantifiable achievements - Section organization and flow 
`;

        const model = ai.getGenerativeModel({
            model: "gemini-2.0-flash", // or gemini-2.0-pro,

        });
        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64.replace(/^data:application\/pdf;base64,/, "")
                }
            }
        ]
        );

        const text = result.response.text();
        const rawText = text?.replace(/```json/g, " ").replace(/```/g, "").trim();

        console.log("text :", text);
        console.log("rawText :", rawText)
        if (!rawText) {
            throw new Error("Ai did not return a valid text response")
        }
        console.log(rawText);


        let jsonResponse;
        try {
            jsonResponse = JSON.parse(rawText);
        } catch (e) {
            return res.status(500).json({
                message: "Gemini returned invalid JSON",
                raw: rawText,
            });
        }
        console.log("jsonResponse :", jsonResponse)
        res.json(jsonResponse);


    } catch (error: any) {
        res.status(500).json({
            message: error.message
        })
    }
})

export default router