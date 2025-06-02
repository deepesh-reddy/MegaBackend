import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"
import { verifyJWT } from "../middlewares/auth.middlewares.js";

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
router.route('/refresh-token').post(refreshAccessToken)

router.route('/logout').post(verifyJWT,logoutUser)
router.route('/change-password').post(verifyJWT,changeCurrentPassword)
router.route('/current-user').get(verifyJWT,getCurrentUser)
router.route('/update-account').patch(verifyJWT,updateAccountDetails);

router.route('/update-avatar').patch(verifyJWT,upload.single('avatar'),updateUserAvatar);

router.route('/update-cover-image').patch(verifyJWT,upload.single('coverImage'),updateUserCoverImage);

router.route('/channel-profile/:username').get(verifyJWT,getUserChannelProfile);
router.route('/history/:username').get(verifyJWT,getWatchHistory);


export default router;