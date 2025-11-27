
import axios from 'axios';
import { AuthenticatedRequest } from "../middleware/auth.js";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";
import { applicationStatusUpdateTemplate } from '../utils/template.js';
import { publishToTopic } from '../utils/producer.js';

export const createCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
        throw new ErrorHandler(401, "Authentication Error");
    }

    if (user?.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden only recruiter can create a company")
    }

    const { name, description, website } = req.body;
    if (!name || !website || !description) {
        throw new ErrorHandler(400, "All the feilds requireed")
    }

    const existingCompanies = await sql`SELECT company_id from companies where name=${name}`;

    if (existingCompanies.length > 0) {
        throw new ErrorHandler(409, `A company with the name ${name} already exist`);
    }

    const file = req.file;
    if (!file) {
        throw new ErrorHandler(400, "Company logo file is required");
    }

    const fileBuffer = getBuffer(file);
    if (!fileBuffer || !fileBuffer.content) {
        throw new ErrorHandler(500, "Failed to create file buffer");

    }

    const { data } = await axios.post(`${process.env.UPLOAD_SERVICE}/api/utils/upload`,
        { buffer: fileBuffer.content }
    )

    console.log("data : ", data);

    const [newCompany] = await sql`INSERT INTO companies (name,description,website,logo, logo_public_id,recruiter_id) VALUES (${name},${description},${website},${data.url},${data.public_id},${req.user?.user_id})  RETURNING *`


    res.json({
        message: "Company create successfully",
        data: newCompany
    })



})


export const deleteCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    const { companyId } = req.params;

    const [company] = await sql`SELECT logo_public_id FROM companies WHERE company_id = ${companyId} AND recruiter_id = ${user?.user_id}`;

    if (!company) {
        throw new ErrorHandler(404, "Company not found or your are not authorized to delete the company")
    }

    await sql`DELETE FROM companies WHERE company_id = ${companyId}`;

    res.json({
        messgae: "Company and all assiciated jobs have to deleted"
    })

})

export const createJob = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
        throw new ErrorHandler(401, "Authentication Error");
    }

    if (user?.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden only recruiter can create a company")
    }
    console.log("req body : ", req.body);

    const { title, description, salary, location, role, job_type, work_location, company_id, openings } = req.body;

    if (!title || !description || !salary || !location || !role || !job_type || !work_location || !company_id || !openings) {
        throw new ErrorHandler(400, "All the feilds requireed")
    }


    const [company] = await sql`SELECT company_id FROM companies WHERE company_id =${company_id} AND recruiter_id = ${user.user_id}`;

    if (!company) {
        throw new ErrorHandler(404, "Company not found!")
    }

    const [newJob] = await sql`INSERT INTO jobs (title,description,salary,location,role,job_type,work_location,company_id,posted_by_recruiter_id ,openings) VALUES (${title}, ${description} , ${salary} , ${location}, ${role}, ${job_type} , ${work_location},${company_id},${user.user_id},${openings}) RETURNING *`;

    res.json({
        message: "Job Posted successfully!",
        job: newJob
    })
})

export const updateJob = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
        throw new ErrorHandler(401, "Authentication Error");
    }

    const { jobId } = req.params

    if (user?.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden only recruiter can create a company")
    }
    console.log("req body : ", req.body);

    const { title, description, salary, location, role, job_type, work_location, company_id, openings, is_active } = req.body;

    const [existingJob] = await sql`SELECT posted_by_recruiter_id FROM jobs WHERE job_id =${jobId}`

    if (!existingJob) {
        throw new ErrorHandler(404, "Job not found")
    }

    if (existingJob.posted_by_recruiter_id !== user.user_id) {
        throw new ErrorHandler(403, "Forbidden : You are not allowed ")
    }

    const [updatedJob] = await sql`UPDATE jobs SET title = ${title} ,
    description = ${description},
    salary=${salary},
    location = ${location},
    role=${role},
    job_type=${job_type},
    work_location=${work_location},
    openings= ${openings},
    is_active = ${is_active}
    WHERE job_id = ${jobId} RETURNING *;
    `

    res.json({
        message: "Job updated successfully!!",
        job: updatedJob
    })

})



export const getAllCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.user_id;
    const companies = await sql`SELECT * FROM companies WHERE recruiter_id = ${userId}`

    if (companies.length === 0) {
        res.json({
            message: "No Companies found"
        })
    }

    res.json(companies)
})

export const getCompaniesDetails = TryCatch(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    if (!id) {
        throw new ErrorHandler(400, "Company id is required");
    }

    const [companyData] = await sql`SELECT c.*,COALESCE (
(
    SELECT json_agg(j.*) FROM jobs j WHERE j.company_id = c.company_id
),
'[]'::json
) AS jobs 
 FROM companies c WHERE c.company_id = ${id} GROUP BY c.company_id;
 `;

    if (!companyData) {
        throw new ErrorHandler(404, "company not found!");
    }

    res.json(companyData);
})


export const getAllActiveJobs = TryCatch(async (req, res) => {
    const { title, location } = req.query as {
        title?: string,
        location?: string
    };

    let queryString = `SELECT j.job_id,j.title,j.description,j.salary,j.location,j.job_type,j.role,j.work_location,
    j.created_at,c.name AS company_name ,c.logo AS company_logo ,c.company_id AS company_id FROM jobs j JOIN companies c ON j.company_id = c.company_id WHERE j.is_active = true`

    const values = [];

    let paramsIndex = 1;


    if (title) {
        queryString += `AND j.title ILIKE $${paramsIndex}`;
        values.push(`%${title}%`);
        paramsIndex++;
    }

    if (location) {
        queryString += `AND j.location ILIKE $${paramsIndex}`;
        values.push(`%${location}%`);
        paramsIndex++;
    }

    queryString += " ORDER BY j.created_at DESC";

    const jobs = (await sql.query(queryString, values)) as any[]

    res.json(jobs);

})

export const getSingleJob = TryCatch(async (req, res) => {
    const jobId = req.params.jobId
    const [job] = await sql`SELECT * FROM jobs WHERE job_id = ${jobId}`;

    res.json(job);
})


export const getAllApplicationForJobs = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
        throw new ErrorHandler(401, "Authentication Required")
    }

    if (user.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden :only recruiter can create a company")
    }

    const { jobId } = req.params;

    const [job] = await sql`SELECT posted_by_recruiter_id FROM jobs WHERE job_id  = ${jobId}`

    if (!job) {
        throw new ErrorHandler(404, "job not found!")
    }

    if (job.posted_by_recruiter_id !== user.user_id) {
        throw new ErrorHandler(403, "Forbidden you are not allowed")
    }

    const applications = await sql`
        SELECT * FROM applications WHERE job_id=${jobId} ORDER BY subscribed DESC, applied_at ASC; 
    `;
    res.json({
        job_id: jobId,
        total: applications.length,
        applications
    });
})

export const updateApplication = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
        throw new ErrorHandler(401, "Authentication Required")
    }

    if (user.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden :only recruiter can access this ")
    }

    const { id } = req.params;
    const [application] = await sql`SELECT * FROM applications WHERE application_id =${id}`
    if (!application) {
        throw new ErrorHandler(404, "Application not found")
    }

    const [job] = await sql`SELECT posted_by_recruiter_id , title FROM jobs WHERE job_id =${application.job_id}`


    if (!job) {
        throw new ErrorHandler(404, "no job with this id")
    }

    if (job.posted_by_recruiter_id !== user.user_id) {
        throw new ErrorHandler(403, "Forbidden you are not allowed ")
    }

    const status = req.body.status;

    const [updatedApplication] = await sql`UPDATE applications SET status =${status} WHERE application_id = ${id} RETURNING * `;

    const message = {
        to: application.applicant_email,
        subject: "Application update  - Job Portal ",
        html: applicationStatusUpdateTemplate(job.title),
    };

    publishToTopic("send-mail", message).catch(error => {
        console.log("Error :", error);
    }
    );

    res.json({
        message: "Application updated ",
        job,
        updatedApplication
    })

})
