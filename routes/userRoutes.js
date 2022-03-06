import express from "express";
import multer from 'multer'
import { getSearchedUsers,getUserFollowers,getUserFollowing,getUserNotifs,getUserProfile,signInUser,signOutUser,signUpUser,toggleFollowUser,loadUserInfo,updateUserProfile,requestReset,resetPassword } from "../controllers/userControllers.js";
import jwt from 'express-jwt'
import dotenv from 'dotenv'
import sgMail from '@sendgrid/mail'

import validator from '../validations/validator.js'
import joiSchemas from '../validations/joiSchemas.js'

dotenv.config()

const jwt_secret=process.env.JWT_SECRET
const resetting_secret = process.env.RESETTING_SECRET
const upload = multer()
const router = express.Router()
sgMail.setApiKey(process.env.SENDGRID_API_KEY)


router.get('/search',getSearchedUsers)

router.post('/signup',upload.none(),validator(joiSchemas.signUp_schema),signUpUser)

router.get('/load',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),loadUserInfo)

router.post('/signin',upload.none(),validator(joiSchemas.signIn_schema),signInUser)

router.get('/signout',signOutUser)

router.get('/:username/notifications',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),getUserNotifs)

router.get('/:username/profile',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),getUserProfile)

router.get('/:username/following',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),getUserFollowing)

router.get('/:username/followers',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),getUserFollowers)

router.patch('/:username/profile',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),upload.single('avatar'),validator(joiSchemas.userProfile_schema),updateUserProfile)

router.post('/reset_request',upload.none(),validator(joiSchemas.resetRequest_schema),requestReset)

router.post('/reset',upload.none(),validator(joiSchemas.resetPwd_schema),jwt({secret:resetting_secret,algorithms:['HS256'],getToken:req=>req.body.token}),resetPassword)

router.get('/:username/toggle_follow',jwt({secret:jwt_secret,algorithms:['HS256'],getToken:req=>req.cookies.token}),toggleFollowUser)

export default  router
