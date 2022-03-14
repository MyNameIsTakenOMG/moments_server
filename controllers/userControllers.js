import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import jsonwebtoken from 'jsonwebtoken'
import path from 'path'
import dotenv from 'dotenv'
import {OAuth2Client} from 'google-auth-library'
import cloudinary from '../utils/cloudinary.js'
import DatauriParser from 'datauri/parser.js'
import sgMail from '@sendgrid/mail'

import Comment from '../models/commentModel.js';
import User from "../models/userModel.js";
import Post from '../models/postModel.js';

dotenv.config()

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const resetting_secret = process.env.RESETTING_SECRET
const jwt_secret=process.env.JWT_SECRET
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const userProjection = {
    username:1,
    email:1,
    avatar:1,
    bio:1,
    location:1,
    hobbies:1,
    profession:1,
    isGoogleUser:1,
    followers:1,
    following:1,
    posts:1,
    new_notifs:{$subtract:[{$size:'$notifications'},'$lastCheck']}
}

const getSearchedUsers = async(req,res)=>{
    console.log('hitting user search route in the backend');
    try {
        const {cursor,query}  =req.query
        let str = query.replace(/\s+/g,' ').trim()
        if(!str) res.status(422).json({message:'search string invalid'})
        const limit = parseInt(req.query.limit)
        console.log('limit: ',limit);
        console.log('cursor: ',cursor);
        console.log(typeof cursor);
        console.log('query: ',query);
        let newCursor
        let theArray=[]
        // first fetch
        if(!cursor)
            theArray = await User.aggregate().search({index:'name_search',text:{path:['username','bio','location','hobbies','profession'],query:query,fuzzy:{}}})
                                .sort({_id:-1})
                                .limit(limit+1)
                                .project({email:0,password:0,notifications:0,lastCheck:0})
                                .exec()
        // subsequent fetch
        else{
            let id = mongoose.Types.ObjectId(cursor)
             theArray = await User.aggregate()
                                .search({index:'name_search',text:{path:['username','bio','location','hobbies','profession'],query:query,fuzzy:{}}})
                                .match({_id:{$lte:id}})
                                .sort({_id:-1})
                                .limit(limit+1)
                                .project({email:0,password:0,notifications:0,lastCheck:0})
                                .exec()
        }

        //if there is more
        if(theArray.length===limit+1){
            newCursor = theArray[limit]._id
            theArray = theArray.slice(0,-1)
        }
        // if there is no more
        else newCursor = null

        console.log('newCursor: ',newCursor);

        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
                                
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }    
}

const signUpUser = async(req,res)=>{
    const {su_username,su_email,su_password} = req.body
    try {
        // if email already been used
        const isEmailUsed  = await User.findOne({email:su_email})
        if(isEmailUsed) return res.status(400).json({message:'email already exists'})
        //if username already been used
        const isUsernameUsed = await User.findOne({username:su_username})
        if(isUsernameUsed) return res.status(400).json({message:'username already exists'})

        // create a new user
        const hashedPwd = await bcrypt.hash(su_password,12)
        const newUser = new User({
            username:su_username,
            email:su_email,
            password:hashedPwd,
        })
        await newUser.save()

        //create a JWT token and put it in the cookie ( in production, remember to setup domain for cookie)
        const token = jsonwebtoken.sign({user:newUser.username},jwt_secret,{expiresIn:'7d',algorithm:'HS256'})
        
        if(process.env.NODE_ENV==='production') res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7,sameSite:'none',secure:true})
        else res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7})
        let newRegularUser = await User.findOne({username:newUser.username},userProjection)
        res.status(200).json({user:newRegularUser,message:'account created successfully'})

    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const loadUserInfo = async(req,res)=>{
    try {
        const theLoggingUsername = req.user.user
        const theUser = await User.findOne({username:theLoggingUsername},userProjection)
        res.status(200).json(theUser)
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const signInUser = async(req,res)=>{
    try {
        const {si_user,si_password,token} = req.body 
        // if user signed in with google acount
        if(token){
            const ticket = await client.verifyIdToken({
                idToken:token,
                audience:process.env.GOOGLE_CLIENT_ID
            })
            const {name,email,picture} = ticket.getPayload()
            // check if the email has been registered as a regular user
            let isRegularUser = await User.findOne({email:email,isGoogleUser:false})
            if(isRegularUser) res.status(400).json({message:'sorry, the email has been registered'})

            const isGoogleUser = await User.findOne({email:email,isGoogleUser:true},userProjection)
            // if the user is a new google user
            if(!isGoogleUser){  
                const newUser = new User({
                                    username:name+'(G)',
                                    email:email,
                                    isGoogleUser:true,
                                    avatar:picture,
                                })
                await newUser.save()
                //create a JWT token and put it in the cookie ( in production, remember to setup domain for cookie)
                const token = jsonwebtoken.sign({user:newUser.username},jwt_secret,{expiresIn:'7d',algorithm:'HS256'})
                if(process.env.NODE_ENV==='production') res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7,sameSite:'none',secure:true})
                else res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7})
                let newGoogleUser = await User.findOne({username:newUser.username},userProjection)
                res.status(200).json({user:newGoogleUser,message:'Logged in successfully'})
            }
            // if this is an existing google user
            else{
                // check if the google user changed their google names or google avatar or not
                if(isGoogleUser.username!==name){
                    let newName = `${name}(G)`
                    let updatedPosts = await Post.updateMany({author:isGoogleUser.username},{author:newName})
                    console.log('updated posts: ',updatedPosts);
                    let updatedComments = await Comment.updateMany({author:isGoogleUser.username},{author:newName})
                    console.log('updated comments: ',updatedComments);
                }
                else if(isGoogleUser.avatar!==picture){
                    let updatedPosts = await Post.updateMany({author:isGoogleUser.username},{avatar:picture})
                    console.log('updated posts: ',updatedPosts);
                    let updatedComments = await Comment.updateMany({author:isGoogleUser.username},{avatar:picture})
                    console.log('updated comments: ',updatedComments);
                }
                isGoogleUser.username = name+'(G)'
                isGoogleUser.avatar = picture
                await isGoogleUser.save()
                //create a JWT token and put it in the cookie ( in production, remember to setup domain for cookie)
                const token = jsonwebtoken.sign({user:isGoogleUser.username},jwt_secret,{expiresIn:'7d',algorithm:'HS256'})
                if(process.env.NODE_ENV==='production') res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7,sameSite:'none',secure:true})
                else res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7})
                res.status(200).json({user:isGoogleUser,message:'Logged in successfully'})
            }
            
        }
        // if user signed in with regular user account
        else if(si_password && si_user) {
            let theUser = ''
            theUser = await User.findOne({}).or([{username:si_user},{email:si_user}])
            if(theUser){  // if user exists
                const match = await bcrypt.compare(si_password,theUser.password)
                if(match){
                    //create a JWT token and put it in the cookie ( in production, remember to setup domain for cookie)
                    const token = jsonwebtoken.sign({user:theUser.username},jwt_secret,{expiresIn:'7d',algorithm:'HS256'})
                    if(process.env.NODE_ENV==='production') res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7,sameSite:'none',secure:true})
                    else res.cookie('token',token,{httpOnly:true,maxAge:60*60*24*7})
                    let theRegularUser = await User.findOne({username:theUser.username},userProjection)
                    res.status(200).json({user:theRegularUser,message:'Logged in successfully'})
                }
                else res.status(400).json({message:'account or password not correct'}) 
            }
            else res.status(400).json({message:'account or password not correct'})
        }
        else res.status(400).json({message:'user info cannot be empty'})     
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const signOutUser = (req,res)=>{
    if(process.env.NODE_ENV==='production')res.clearCookie('token',{httpOnly:true,maxAge:60*60*24*7,sameSite:'none',secure:true})
    else res.clearCookie('token',{httpOnly:true,maxAge:60*60*24*7})
    res.status(200).json({message:'successfully logged out'})
}

const getUserNotifs = async(req,res)=>{
    try {
        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        const {username} = req.params
        const theUser = await User.findOne({username:username})
    
        let theArray =[]
        let thePromiseArray =[]
        let newCursor
        const buildNotif = async(user_notif)=>{
            const {sender,notif_type,messageId,subject_type,subjectId} = user_notif
            let theMessage, theSubject,notif = {}
            let theSender = await User.findOne({username:sender})
            notif.sender_avatar = theSender.avatar
            notif.sender = sender
            notif.notif_type = notif_type
            notif.subject_type = subject_type
            notif.messageId = messageId
            // if notif subject type is post
            if(notif.subject_type==='post'){
                notif.postId = subjectId
                theSubject = await Post.findById(notif.postId)
                if(!theSubject) return null;
                notif.subject_contents = theSubject.title
            }
            // if notif subject type is comment
            else if(notif.subject_type==='comment'){
                theSubject = await Comment.findById(subjectId)
                if(!theSubject) return null
                notif.subject_contents = theSubject.contents
                let theIndex = theSubject.path.search(/\//)
                let thePostId
                if(theIndex===-1) thePostId = theSubject.path
                else thePostId = theSubject.path.slice(0,theIndex)
                notif.postId = thePostId
            }
            // if notif type is comment
            if(notif.notif_type==='comment'){
                theMessage = await Comment.findById(messageId)
                if(!theMessage) return null
                notif.contents = theMessage.contents
            }
            return notif
        }  
        // first fetch
        if(!cursor){
            // update lastCheck 
            theUser.lastCheck =  theUser.notifications.length
            await theUser.save()
            // if there is more
            if(theUser.notifications.length>=limit+1){
                for(let i =0;i<limit;i++){
                   thePromiseArray.push(buildNotif(theUser.notifications[(theUser.notifications.length-1)-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                theArray = theArray.filter(item=>item!==null)
                newCursor = theUser.notifications.length-(limit+1)
            }
            // if there is no more
            else{
                for(let i =theUser.notifications.length-1;i>=0;i--){
                    thePromiseArray.push(buildNotif(theUser.notifications[i]))
                }
                theArray = await Promise.all(thePromiseArray)
                theArray = theArray.filter(item=>item!==null)
                newCursor = null
            }
        }
        //subsequent fetch
        else{
            let parsedCursor = parseInt(cursor)
            // if there is more
            if(parsedCursor>=limit){
                for (let i = 0; i < limit; i++) {
                    thePromiseArray.push(buildNotif(theUser.notifications[parsedCursor-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                theArray = theArray.filter(item=>item!==null)
                newCursor = parsedCursor-limit
            }
            // if there is no more
            else{
                for (let i = parsedCursor; i >=0; i--) {
                    thePromiseArray.push(buildNotif(theUser.notifications[i]))
                }
                theArray = await Promise.all(thePromiseArray)
                theArray = theArray.filter(item=>item!==null)
                newCursor = null
            }
        }
        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const getUserProfile = async(req,res)=>{
    try {
        console.log('hitting user profile route...');
        const {username} = req.params
        console.log('username: ',username);
        const theUser = await User.findOne({username:username},{password:0,notifications:0,lastCheck:0})
        if(!theUser){
            res.status(404).json({message:'no user found'})
        }else{
            res.status(200).json(theUser)
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const getUserFollowing = async(req,res)=>{
    console.log(' hitting get followings of the user route...');
    try {
        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        const {username} = req.params
        const theUser = await User.findOne({username:username})
        let theArray = []
        let thePromiseArray =[]
        let newCursor
        const findUser = async(username)=>{
            try {
                let foundUser = await User.findOne({username:username},{email:0,password:0,notifications:0,lastCheck:0})
                return foundUser
            } catch (error) {
                console.log(error);
            }
        }
        // first fetch
        if(!cursor){
            // if there is more
            if(theUser.following.length>=limit+1){  
                for (let i = 0; i < limit; i++) {  
                    thePromiseArray.push(findUser(theUser.following[(theUser.following.length-1)-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = theUser.following.length-(limit+1)
            }
            // if there is no more
            else{
                for (let i = theUser.following.length-1; i >= 0; i--) {
                    thePromiseArray.push(findUser(theUser.following[i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = null
            }
        }
        // subsequent fetch
        else{
            let parsedCursor = parseInt(cursor)
            // if there is more
            if(parsedCursor>=limit){
                for (let i = 0; i < limit; i++) {
                    thePromiseArray.push(findUser(theUser.following[parsedCursor-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = parsedCursor-limit
            }
            // if there is no more
            else{
                for (let i = parsedCursor; i >=0; i--) {
                    thePromiseArray.push(findUser(theUser.following[i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = null
            }
        }
        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const getUserFollowers = async(req,res)=>{
    console.log(' hitting get followers of the user route...');
    try {
        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        const {username} = req.params
        const theUser = await User.findOne({username:username},{email:0,password:0,notifications:0,lastCheck:0})

        let theArray = []
        let thePromiseArray =[]
        let newCursor
        const findUser = async(username)=>{
            try {
                let foundUser = await User.findOne({username:username})
                return foundUser
            } catch (error) {
                console.log(error);
            }
        }
        // first fetch
        if(!cursor){
            // if there is more
            if(theUser.followers.length>=limit+1){  
                for (let i = 0; i < limit; i++) {  
                    thePromiseArray.push(findUser(theUser.followers[(theUser.followers.length-1)-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = theUser.followers.length-(limit+1)
            }
            // if there is no more
            else{
                for (let i = theUser.followers.length-1; i >= 0; i--) {
                    thePromiseArray.push(findUser(theUser.followers[i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = null
            }
        }
        // subsequent fetch
        else{
            // if there is more
            let parsedCursor = parseInt(cursor)
            if(parsedCursor>=limit){
                for (let i = 0; i < limit; i++) {
                    thePromiseArray.push(findUser(theUser.followers[parsedCursor-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = parsedCursor-limit
            }
            // if there is no more
            else{
                for (let i = parsedCursor; i >=0; i--) {
                    thePromiseArray.push(findUser(theUser.followers[i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = null
            }
        }
        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const updateUserProfile =async(req,res)=>{
    try {
        const {bio,location,hobbies,profession} =req.body
        let hobbyArray=hobbies.replace(/\s+/g,'').split(',')
        const {username} = req.params
        const theUser = await User.findOne({username:username})
        const postsList = await Post.find({author:theUser.username})
        const commentsList = await Comment.find({author:theUser.username})

        theUser.bio = bio,
        theUser.location = location
        theUser.hobbies = hobbyArray
        theUser.profession = profession
        
        // using parser to convert buffer into base64 encoded string if user uploaded a new avatar
        if(req.file){
            if(theUser.isGoogleUser) return res.status(400).json({message:'Cannot change Google user avatar'})
            const parser = new DatauriParser()
            const result = parser.format(path.extname(req.file.originalname),req.file.buffer)
            // upload the base64 string to Cloudinary and upload to cloudinary
            const cloudinaryRes = await cloudinary.uploader.upload(result.content,{upload_preset:'moments_app_preset'})
            // delete the original avatar
            if(theUser.avatar){
                const public_id = theUser.avatar.slice(theUser.avatar.lastIndexOf('/')+1,theUser.avatar.lastIndexOf('.'))
                cloudinary.uploader.destroy(public_id, function(error,result) { console.log(error,result) });
            }
            theUser.avatar = cloudinaryRes.secure_url
        }
        await theUser.save()
        console.log('user info updated');
        // update the name and the avatar for the posts and the comments that the user created
        await Promise.all(postsList.map(async(post)=>{
            post.avatar = theUser.avatar
            await post.save()
        }))
        await Promise.all(commentsList.map(async(comment)=>{
            comment.avatar = theUser.avatar
            await comment.save()
        }))
        let thePatchedUser = await User.findOne({username:theUser.username},{bio:1,location:1,profession:1,hobbies:1,username:1,avatar:1})
        res.status(200).json({user:thePatchedUser,message:'Profile updated successfully'})

    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }

}

const requestReset = async(req,res)=>{
    try {      
        console.log('req.body: ',req.body);
        const {rs_email} = req.body
        const theUser = await User.find({email:rs_email})
        if(!theUser) return res.status(400).json({message:'The email has not been registered'})
        if(theUser.isGoogleUser) return res.status(400).json({message:'Cannot reset Google User password'})
    
        // create a token
        const token = jsonwebtoken.sign({email:rs_email},resetting_secret,{expiresIn:'1h',algorithm:'HS256'})
    
        const msg = {
            to: `${rs_email}`, 
            from: 'fangzhengonly@gmail.com', 
            template_id:'d-aba4ad6169ff4fbaa280fc9887b67fdb',
            dynamic_template_data:{
                Weblink:`http://localhost:3000/reset/${token}`
              }
          }
    
        const response = await sgMail.send(msg)
        console.log('Email sent the response: ',response)
    
        res.status(200).json({message:'The resetting email has been sent'})
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const resetPassword = async(req,res)=>{
    try {
        const {rs_newPwd} = req.body
        const {email} = req.user
        const theUser = await User.findOne({email:email})
        if(theUser && theUser.isGoogleUser===false){
            const hashedPwd = await bcrypt.hash(rs_newPwd,12)
            theUser.password = hashedPwd
            await theUser.save()
            return res.status(200).json({message:'Password reset successfully'})
        }
        else return res.status(400).json({message:'Invalid request, cannot reset password'})
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const toggleFollowUser = async(req,res)=>{
    try {
        const theLoggingUsername = req.user.user
        const theLoggingUser = await User.findOne({username:theLoggingUsername})  
        
        const {username} = req.params
        const theUser = await User.findOne({username:username})
    
        // check if the logging user already followed the user 
        const followingIndex = await theLoggingUser.following.findIndex(name=>name===theUser.username)
        const followerIndex = await theUser.followers.findIndex(name=>name===theLoggingUsername)
        
        // follow the user
        if(followingIndex===-1){
            theLoggingUser.following.push(theUser.username)    // logging user has one more following
            theUser.followers.push(theLoggingUser.username)    // the user has one more follower
            await theLoggingUser.save()
            await theUser.save()
            res.status(200).json({message:'Followed successfully'})
        }
        // unfollow the user
        else{
            theLoggingUser.following.pull(theLoggingUser.following[followingIndex])
            theUser.followers.pull(theUser.followers[followerIndex])
            await theLoggingUser.save()
            await theUser.save()
            res.status(200).json({message:'Unfollowed successfully'})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

export {getSearchedUsers,signUpUser,signInUser,signOutUser,toggleFollowUser,loadUserInfo,getUserNotifs,getUserProfile,getUserFollowers,getUserFollowing,updateUserProfile,requestReset,resetPassword}