import { isAuth } from '../middleware/auth.js';
import express from "express";
import { createCompany, createJob, deleteCompany, getAllActiveJobs, getAllApplicationForJobs, getAllCompany, getCompaniesDetails, getSingleJob, updateApplication, updateJob } from "../controller/jobs.js";
import uploadFile from '../middleware/multer.js';

const router = express.Router()

router.get("/getallcompanies", isAuth, getAllCompany)
router.get("/getCompaniesDetails/:id", isAuth, getCompaniesDetails)
router.get("/getAllActiveJobs", getAllActiveJobs)
router.get("/getSingleJob/:jobId", getSingleJob)
router.post("/create-company", isAuth, uploadFile, createCompany)
router.delete("/delete-company/:companyId", isAuth, deleteCompany)
router.post("/create-job", isAuth, createJob)
router.put("/update-job/:jobId", isAuth, updateJob)
router.get("/application/:jobId",isAuth,getAllApplicationForJobs)
router.put("/update-application/:id",isAuth,updateApplication)

export default router;