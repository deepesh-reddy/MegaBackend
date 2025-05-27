import { Router } from "express";
import { registerUser } from "../controllers/user.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"
import { loginUser } from "../controllers/user.controllers.js";

const router = Router()

router.route('/register').post(
    upload.fields([
        {
            name:'avatar',
            maxCount:1
        },
        {
            name:'coverImage',
            maxCount:1
        }
    ]),
    registerUser)
// router.post('/register', registerUser);

router.route('/login').get(loginUser)


export default router;