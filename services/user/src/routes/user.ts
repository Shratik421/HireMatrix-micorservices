import express, { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import { addSkillToUser, applyForJob, deleteSkillFromUser, getAllApplication,  getUserProfile, myProfile, updateProfilePic, updateResume, updateUserProfile } from "../controller/user.js";
import uploadFile from "../middleware/multer.js";

const router  = express.Router();

router.get("/me",isAuth,myProfile);

router.get("/user-profile/:userId",isAuth,getUserProfile);
router.get("/get-all-applications",isAuth,getAllApplication);
router.post("/applyForJob/:job_id",isAuth,applyForJob)
router.put("/update-user",isAuth,updateUserProfile)
router.put("/update-pic",isAuth,uploadFile, updateProfilePic)
router.put("/update-resume",isAuth,uploadFile, updateResume)
router.post("/addSkill",isAuth,addSkillToUser)
router.delete("/deleteSkill",isAuth,deleteSkillFromUser)


export default router