import { ApiError } from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {User} from '../models/user.models.js'
import {uploadOnCloudinary,deleteFromCLoudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js';
import 'dotenv/config'
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async(userId) =>{
    try {
        const user = await User.findById(userId);
        if(!user) return ;
        const accessToken =  user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,'Something went wrong while generating access and refresh tokens')
    }
}

const registerUser = asyncHandler(
    async(req,res) =>{
        const {fullName,email,username,password} = req.body;
        
        //validation
        if(
            [fullName,email,username,password].some((field) => field?.trim() === '')
        ){
            throw new ApiError(400,'All fields are required')
        }

        const existingUser = await User.findOne({
            $or: [{email},{username}]
        })
        if(existingUser){
            throw new ApiError(400,'User exists')
        }

        const avatarLocalPath = req.files?.avatar?.[0]?.path
        const coverImageLocalPath = req.files?.coverImage?.[0]?.path

        if(!avatarLocalPath){
            throw new ApiError(400,'Avatar file is missing')
        }

        // const avatar = await uploadOnCloudinary(avatarLocalPath)
        // let coverImage = ""

        // if(coverImageLocalPath){
        //     let coverImage = await uploadOnCloudinary(coverImageLocalPath)
        // }

        let avatar;
        try {
            avatar = await uploadOnCloudinary(avatarLocalPath);
            // console.log('Avatar uploaded',avatar);            
        } catch (error) {
            console.log('Error uploading avatar', error);            
            throw new ApiError(400,'Avatar file is missing');
        }

        let coverImage;
        try {
            coverImage = await uploadOnCloudinary(coverImageLocalPath);
            // console.log('coverImage uploaded',coverImage);            
        } catch (error) {
            console.log('Error uploading coverImage', error);            
            throw new ApiError(400,'coverImage file is missing');
        }

        try {
            const user = await User.create(
                {
                    fullName,
                    avatar:avatar.url,
                    coverImage:coverImage?.url || '',
                    email,
                    password,
                    username : username.toLowerCase()
                }
            )
    
            const createdUser =  await User.findById(user._id).select('-password -refreshToken');
            if(!createdUser){
                throw new ApiError(500,'Something went wrong while creating a user')
            }
    
            return res
            .status(201)
            .json(new ApiResponse(200,createdUser,'User registered successfully'))
        } catch (error) {
            console.log('User creation failed ');
            if(avatar){
                await deleteFromCLoudinary(avatar.public_id)
            }     
            if(coverImage){
                await deleteFromCLoudinary(coverImage.public_id)
            }      
            throw new ApiError(500,'Something went wrong while creating a user and images were deleted')    
        }

    }
)

const loginUser = asyncHandler(
    async(req,res) =>{
        const {username,email,password} = req.body;
        if(!email && !username ){
            throw new ApiError(400,'Email or User is required');
        }

        const user = await User.findOne({
            $or: [{email},{username}]
        })

        if(!user){
            throw new ApiError(400,`User not found`);
        }

        // console.log("User password (hashed):", user.password);
        // console.log("Entered password:", password);


        //validate password
        const isPasswordValid = await user.isPasswordCorrect(password);

        if(!isPasswordValid){
            throw new ApiError(401,'Invalid credentials')
        }

        const {accessToken,refreshToken} = await 
        generateAccessAndRefreshToken(user._id)

        const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

        if(!loggedInUser){
            throw new ApiError(401,'User not found')
        }

        const options = {
            httpOnly:true,
            secure:process.env.NODE_ENV === 'production',

        }

        return res
        .status(200)
        .cookie('accessToken',accessToken,options)
        .cookie('refreshToken',refreshToken,options)
        .json(new ApiResponse(
            200,
            {user:loggedInUser,accessToken,refreshToken},
            'User loggedIn successfully'
        ))

    }
)

const refreshAccessToken = asyncHandler(
    async(req,res) => {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if(!incomingRefreshToken){
            throw new ApiError(401,'Refresh token is required')
        }
        
        try {
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET,
            )
            // console.log(decodedToken);
            const user = await User.findById(decodedToken?._id)
            if(!user){
                throw new ApiError(401,'Invalid refresh token')
            }

            if(incomingRefreshToken !== user?.refreshToken ){
                throw new ApiError(401,'Refresh token expired')
            }

            const options = {
                httpOnly:true,
                secure: process.env.NODE_ENV === 'production'
            }

            const { accessToken, refreshToken:newRefreshToken} = await generateAccessAndRefreshToken(user._id)

            return res
            .status(200)
            .cookie('accessToken',accessToken,options)
            .cookie('refreshToken',newRefreshToken,options)
            .json(new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                'Access token refreshed successfully'
            ))

        } catch (error) {
            throw new ApiError(500,'Something went wrong while refreshing access token')
        }
    }
)

const logoutUser = asyncHandler(
    async(req,res) => {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken: undefined,
                }
            },
            {new:true}
        )
        const options={
            httpOnly:true,
            secure:process.env.NODE_ENV === 'production'
        }

        return res
        .status(200)
        .clearCookie('accessToken',options)
        .clearCookie('refreshToken',options)
        .json(new ApiResponse(200,{},'User logged out successfully'))
    }
)

const changeCurrentPassword = asyncHandler(
    async(req,res) => {
        const {oldPassword,newPassword} = req.body;
        const user = await User.findById(req.user?._id)
        const isPasswordValid = user.isPasswordCorrect(oldPassword)
        if(!isPasswordValid){
            ApiResponse(200,'Invalid old password')
        }
        user.password = newPassword;
        await user.save({validateBeforeSave:false})
        return res
        .status(200)
        .json(new ApiResponse(200,{},'Password changed successfully'));
    }
)

const getCurrentUser = asyncHandler(
    async(req,res) => {
        return 
        res.status(200)
        .json(new ApiResponse(200,req.user,'Current user details'))
    }
)

const updateAccountDetails = asyncHandler(
    async(req,res) => {
        const {fullName,email} = req.body;
        if(!fullName || !email){
            throw new ApiError(400,'Fullname and email are required');
        }
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    fullName,
                    email
                }
            },
            {new:true}
        ).select('-password -refreshToken')
        return res
        .status(200)
        .json(new ApiResponse(200,user,'Account details updated successfully'))
    }
)

const updateUserAvatar = asyncHandler(
    async(req,res) => {
        const avatarLocalPath = req.file?.path
        if(!avatarLocalPath){
            throw new ApiError(400,'File is required')
        }
        const avatar = await uploadOnCloudinary(avatarLocalPath)

        if(!avatar.url){
            throw new ApiError(400,'Something went wrong')
        }
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    avatar:avatar.url
                }
            },{new:true}
        ).select('password -refreshToken');

        return res
        .status(200)
        .json(new ApiResponse(200,user,'Avatar updated successfully'))
    }
)

const updateUserCoverImage = asyncHandler(
    async(req,res) => {
        const coverImageLocalPath = req.file?.path
        if(!coverImageLocalPath){
            throw new ApiError(400,'File is required')
        }
        const coverImage = await uploadOnCloudinary(avatarLocalPath)

        if(!coverImage.url){
            throw new ApiError(400,'Something went wrong')
        }
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    coverImage:coverImage.url
                }
            },{new:true}
        ).select('password -refreshToken');

        return res
        .status(200)
        .json(new ApiResponse(200,user,'Cover Image updated successfully'))
    }
)

const getUserChannelProfile = asyncHandler(
    async(req,res) => {
        const {username} = req.params
        if(!username?.trim()){
            throw new ApiError(400,'Username is required');
        }
        const channel = await User.aggregate(
            [
                {
                    $match:{
                        username:username?.toLowerCase()
                    }
                },
                {
                    $lookup:{
                        from:'subscriptions',
                        localField:'_id',
                        foreignField:'channel',
                        as:'subscribers'
                    }
                },
                {
                    $lookup:{
                        from:'subscriptions',
                        localField:'_id',
                        foreignField:'subscriber',
                        as:'subscribedTo'
                    }
                },
                {
                    $addFields:{
                        subscribersCount:{
                            $size:'$subscribers'
                        },
                        channelsSubscribedToCount:{
                            $size:'$subscribedTo'
                        },
                        isSubscribed:{
                            $cond:{
                                if:{$in:[req.user?._id,'$subscribers.subscriber']},
                                then:true,
                                else:false
                            }
                        }
                    }
                },
                {
                    //Project only the necessary data
                    $project:{
                        fullname:1,
                        username:1,
                        avatar:1,
                        subscribersCount:1,
                        channelsSubscribedToCount:1,
                        isSubscribed:1,
                        coverImage:1,
                        email:1
                    }
                }
            ]
        )
        if (!channel?.length){
            throw new ApiError(400,'Channel not found');      
        }

        return res
        .status(200)
        .json(new ApiResponse(
            200,
            channel[0],
            'Channel profile fetched successfully'
        ))
    }
)

const getWatchHistory = asyncHandler(
    async(req,res) => {
        const user = await User.aggregate([
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup:{
                    from:'videos',
                    localField:'watchHistory',
                    foreignField:'_id',
                    as:'watchHistory',
                    pipeline:[
                        {
                            $lookup:{
                                from:'users',
                                localField:'owner',
                                foreignField:'_id',
                                as:'owner',
                                pipeline:[
                                    {
                                        $project:{
                                            fullName:1,
                                            username:1,
                                            avatar:1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields:{
                                owner:{
                                    $first:"$owner",
                                }
                            }
                        }
                    ]
                }
            }
        ])
        return res
        .status(200)
        .json(new ApiResponse(
            200,
            user[0]?.watchHistory,
            'Watch history fetched successfully'
        ))
    }
)

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}