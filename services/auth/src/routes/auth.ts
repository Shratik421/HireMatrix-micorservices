import express from 'express';
import { loginUser, registerUser,forgetPasword, resetPassword } from '../controllers/auth.js';
import uploadFile from '../middleware/multer.js';
const router = express.Router();

router.post("/register", uploadFile, registerUser);
router.post("/loginUser",loginUser)
router.post("/forget-password",forgetPasword)
router.post("/reset/:token",resetPassword)


export default router;