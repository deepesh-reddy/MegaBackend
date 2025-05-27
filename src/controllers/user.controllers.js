import { ApiError } from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {User} from '../models/user.models.js'
import {uploadOnCloudinary,deleteFromCLoudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js';
import 'dotenv/config'

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
            console.log('Avatar uploaded',avatar);            
        } catch (error) {
            console.log('Error uploading avatar', error);            
            throw new ApiError(400,'Avatar file is missing');
        }

        let coverImage;
        try {
            coverImage = await uploadOnCloudinary(coverImageLocalPath);
            console.log('coverImage uploaded',coverImage);            
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

export {
    registerUser,
    loginUser
}