import Post from '../models/postModel.js'
import cloudinary from '../utils/cloudinary.js'
import path from 'path'
import DatauriParser from 'datauri/parser.js'
import mongoose from 'mongoose'
import Comment from '../models/commentModel.js'
import User from '../models/userModel.js'
import validateObjectId from '../utils/validateObjectId.js'
 
 const getAllPosts = async(req,res)=>{
    try {
        console.log('get all posts route');
        const {cursor} = req.query
        console.log('the cursor is: ',cursor);
        const limit = parseInt(req.query.limit)
        let theArray=[]
        let newCursor
        // first fetch
        // if(!cursor) theArray = await Post.find({}).sort({createdAt:-1}).limit(limit+1).exec()
        if(!cursor) theArray = await Post.find({}).sort({_id:-1}).limit(limit+1).exec()
        // subsquent fetch
        else{
            // const convertedCursor = new Date(cursor)
            // theArray = await Post.find({}).where('createdAt').lte(convertedCursor).sort({createdAt:-1}).limit(limit+1).exec()
            theArray = await Post.find({}).where('_id').lte(cursor).sort({_id:-1}).limit(limit+1).exec()
        }
        // if there is more
        if(theArray.length===limit+1){
            // newCursor = theArray[limit].createdAt
            newCursor = theArray[limit]._id
            theArray = theArray.slice(0,-1)
        }
        // there is no more
        else newCursor = null
        
        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
    } catch (error) {
        console.log(error);
        res.status(404).json({message:'Something wrong, please try again later'})
    }   
}

const getFollowingPosts = async(req,res)=>{
    try {
        console.log('get following posts ');

        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        let theArray=[]
        let newCursor
        const theLoggingUsername = req.user.user
        const theUser = await User.findOne({username:theLoggingUsername}) 
        // first fetch
        // if(!cursor) theArray = await Post.find({author:{$in:theUser.following}}).sort({createdAt:-1,_id:-1}).limit(limit+1).exec()
        if(!cursor) theArray = await Post.find({author:{$in:theUser.following}}).sort({_id:-1}).limit(limit+1).exec()
        // subsquent fetch
        else{
            // const convertedCursor = new Date(cursor)
            // theArray = await Post.find({author:{$in:theUser.following}}).where('createdAt').lte(convertedCursor).sort({createdAt:-1,_id:-1}).limit(limit+1).exec()
            theArray = await Post.find({author:{$in:theUser.following}}).where('_id').lte(cursor).sort({_id:-1}).limit(limit+1).exec()
        }  
        // if there is more
        if(theArray.length===limit+1){
            // newCursor = theArray[limit].createdAt
            newCursor = theArray[limit]._id
            theArray = theArray.slice(0,-1)
        }
        // there is no more
        else newCursor = null   
        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const getMyPosts = async(req,res)=>{
    try {
        console.log('get my posts ');

        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        let theArray=[]
        let newCursor
        const theLoggingUsername = req.user.user
        // first fetch
        // if(!cursor) theArray = await Post.find({author:theLoggingUsername}).sort({createdAt:-1,_id:-1}).limit(limit+1).exec()
        if(!cursor) theArray = await Post.find({author:theLoggingUsername}).sort({_id:-1}).limit(limit+1).exec()
        // subsquent fetch
        else{
            // const convertedCursor = new Date(cursor)
            // theArray = await Post.find({author:theLoggingUsername}).where('createdAt').lte(convertedCursor).sort({createdAt:-1,_id:-1}).limit(limit+1).exec()
            theArray = await Post.find({author:theLoggingUsername}).where('_id').lte(cursor).sort({_id:-1}).limit(limit+1).exec()
        }  
        // if there is more
        if(theArray.length===limit+1){
            // newCursor = theArray[limit].createdAt
            newCursor = theArray[limit]._id
            theArray = theArray.slice(0,-1)
        }
        // there is no more
        else newCursor = null   
        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }    
}

const getSearchedPosts = async(req,res)=>{
    try {
        console.log('hitting search posts route...');
        const {query,cursor} = req.query
        let str = query.replace(/\s+/g,' ').trim()
        if(!str) res.status(422).json({message:'search string invalid'})
        const limit = parseInt(req.query.limit)
        console.log('query: ',query);
        console.log('cursor: ',cursor);
        console.log('limit: ',limit);
        let theArray=[]
        let newCursor
        // first fetch 
        if(!cursor)
            theArray = await Post.aggregate()
                                .search({index:'default2',text:{path:['title','tags'],query:query,fuzzy:{}}})
                                .sort({_id:-1})
                                .limit(limit+1)
                                .exec()
        // subsequent fetch
        else{
            let id = mongoose.Types.ObjectId(cursor)
            theArray = await Post.aggregate()
                                .search({index:'default2',text:{path:['title','tags'],query:query,fuzzy:{}}})
                                .match({_id:{$lte:id}})
                                .sort({_id:-1})
                                .limit(limit+1)
                                .exec()
        } 

        // if there is more
        if(theArray.length===limit+1){
            newCursor = theArray[limit]._id
            theArray = theArray.slice(0,-1)
        }
        // if there is no more
        else newCursor =null

        console.log('new cursor: ',newCursor);

        res.status(200).json({
            data:theArray,
            cursor:newCursor
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

 const getUserPosts = async(req,res)=>{
     console.log('hitting get posts of the user route...');
    try {
        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        const {username} = req.params
        const theUser = await User.findOne({username:username})
        
        let theArray=[]
        let thePromiseArray=[]
        let newCursor
        const findPost =async(id)=>{
            try {
                let foundPost = await Post.findById(id)
                return foundPost
            } catch (error) {
                console.log(error);
            }
        }
        // first fetch
        if(!cursor){
            // if there is more
            if(theUser.posts.length>=limit+1){  
                for (let i = 0; i < limit; i++) {  
                    thePromiseArray.push(findPost(theUser.posts[(theUser.posts.length-1)-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = theUser.posts.length-(limit+1)
            }
            // if there is no more
            else{
                for (let i = theUser.posts.length-1; i >= 0; i--) {
                    thePromiseArray.push(findPost(theUser.posts[i]))
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
                    thePromiseArray.push(findPost(theUser.posts[parsedCursor-i]))
                }
                theArray = await Promise.all(thePromiseArray)
                newCursor = parsedCursor-limit
            }
            // if there is no more
            else{
                for (let i = parsedCursor; i >=0; i--) {
                    thePromiseArray.push(findPost(theUser.posts[i]))
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

const toggleLike = async(req,res)=>{
    try {
        console.log('hitting toggle like route...');
        const {postId} = req.params
        const theLoggingUsername = req.user.user

        const thePost = await Post.findById(postId)
        const index = thePost.likes.findIndex(name=>name===theLoggingUsername)

        // like the post
        if(index===-1){
            thePost.likes.push(theLoggingUsername)
            await thePost.save()

            // find the receiver
            let receiver = await User.findOne({username:thePost.author})
            let theIndex= await receiver.notifications.findIndex(notif=>notif.sender===theLoggingUsername&&notif.type==='like'&&notif.subjectId.toString()===thePost._id.toString())
            console.log('notification index: ',theIndex);
            // decide if need to create a new notif ( if the login user did not like the post before)
            if(theIndex===-1){
                receiver.notifications.push({sender:theLoggingUsername,notif_type:'like',subjectId:thePost._id,subject_type:'post'})
                await receiver.save()
                // decide if need to send a new notif (if the receiver is online)
                let isExisting = await req.redisClient.exists(thePost.author)
                console.log('is author in redis: ',isExisting);
                // if the receiver is online, then send a notification 
                if(isExisting===1){
                    let socketId = await req.redisClient.get(thePost.author)
                    req.io.to(socketId).emit('like',`user ${theLoggingUsername} liked your post`)
                }
            }
           
            res.status(200).json({message:'liked'})
        }
        // unlike the post
        else{
            thePost.likes.pull(thePost.likes[index])
            await thePost.save()
            res.status(200).json({message:'unliked'})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
    
}

 const createNewPost = async(req,res)=>{
     try {
        const theLoggingUsername = req.user.user
        const {title,tags,contents} = req.body
        const tagArray = tags.replace(/\s+/g,'').split(',') 

        const theUser = await User.findOne({username:theLoggingUsername})
        // check if the user uploaded an image
        if(!req.file.originalname) throw new Error('no image found')
        // using parser to convert buffer into base64 encoded string
        const parser = new DatauriParser()
        const result = parser.format(path.extname(req.file.originalname),req.file.buffer)
        // upload the base64 string to Cloudinary
        const cloudinaryRes = await cloudinary.uploader.upload(result.content,{upload_preset:'moments_app_preset'})
        console.log('cloudinary response: ',cloudinaryRes);
        const newPost = new Post({
            title:title,
            author:theLoggingUsername,
            avatar:theUser.avatar,
            tags:tagArray,
            contents,
            image:cloudinaryRes.secure_url,
        })
        const savedPost = await newPost.save()

        // add the post to the user
        theUser.posts.push(savedPost._id)
        await theUser.save()
        console.log('create a new post',savedPost);

        res.status(200).json({message:'new post created!'})
         
     } catch (error) {
         console.log(error);
         res.status(500).json({message:'Something wrong, please try again later'})
     }
    
}

const getEditPostById = async(req,res)=>{
    try {
        const theLoggingUsername = req.user.user
        const {postId} = req.params
        // validate the id
        const validateResult = validateObjectId(postId)
        if(!validateResult) return res.status(404).json({message:'no data found'})

        const thePost = await Post.findById(postId)
        if(!thePost) res.status(404).json({message:'no data found'})
        else if(thePost.author!==theLoggingUsername) res.status(403).json({message:'data could not be accessed'})
        else res.status(200).json(thePost)
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }

}

// get the subject( a post or a comment) by the id
 const getPostById = async(req,res)=>{
     console.log('hitting get post by id route....');
        try {
            const {postId} = req.params
            const {type} = req.query

            // validate the id
            const validateResult = validateObjectId(postId)
            if(!validateResult) return res.status(404).json({message:'no data found'})

            if(type==='post'){
                const thePost = await Post.findById(postId)
                if(!thePost) res.status(404).json({message:'no data found'}) 
                res.status(200).json(thePost)
            }
            else if(type==='comment'){
                const theComment = await Comment.findById(postId)
                if(!theComment) res.status(404).json({message:'no data found'}) 
                res.status(200).json(theComment)
            }
            
        } catch (error) {
            console.log(error);
            res.status(500).json({message:'Something wrong, please try again later'})
        }  
    }

 const updateUserPostById = async(req,res)=>{
     try {
            const {postId} = req.params;
            // validate the id
            const validateResult = validateObjectId(postId)
            if(!validateResult) return res.status(404).json({message:'no data found'})

            const {title,tags,contents} = req.body
            const tagArray = tags.replace(/\s+/g,'').split(',')
            const thePost = await Post.findById(postId)
            const public_id = thePost.image.slice(thePost.image.lastIndexOf('/')+1,thePost.image.lastIndexOf('.'))
            // if user uploaded a new image
            if(req.file){
                // using parser to convert buffer into base64 encoded string
                const parser = new DatauriParser()
                const result = parser.format(path.extname(req.file.originalname),req.file.buffer)

                // delete the original image and upload the new one
                cloudinary.uploader.destroy(public_id, function(error,result) { console.log(error,result) });
                const cloudinaryRes = await cloudinary.uploader.upload(result.content,{upload_preset:'moments_app_preset'})

                thePost.image = cloudinaryRes.secure_url
            }

            thePost.title = title
            thePost.contents = contents
            thePost.tags = tagArray
            await thePost.save()
            res.status(200).json({message:'Post updated successfully'})

     } catch (error) {
         console.log(error)
         res.status(500).json({message:'Something wrong, please try again later'})
     }
}

// delete a user post and all the comments under it and update the user data
 const deleteUserPostById = async(req,res)=>{
     try {
        console.log('this is the delete route....');
        const {postId} = req.params
        // validate the id
        const validateResult = validateObjectId(postId)
        if(!validateResult) return res.status(404).json({message:'no data found'})
        console.log(' the post id : ', postId);

        const theLoggingUsername = req.user.user
        const theUser = await User.findOne({username:theLoggingUsername})
        const thePost = await Post.findById(postId)
        
        // delete the image
        const public_id = thePost.image.slice(thePost.image.lastIndexOf('/')+1,thePost.image.lastIndexOf('.'))
        cloudinary.uploader.destroy(public_id,function(error,result) { console.log(error,result) })

         // delete the post 
         await Post.findByIdAndDelete(postId)
       
         // update the user data
        theUser.posts.pull(postId)
        await theUser.save()
        
        // delete all comments associated with the post
        const myRex = new RegExp(`^${postId}`)
        await Comment.deleteMany({path: myRex})

         res.status(200).json({message:'Deleted successfully'})
     } catch (error) {
         console.log(error);
         res.status(500).json({message:'Something wrong, please try again later'})
     }
}

export {getSearchedPosts,getEditPostById,getAllPosts,getMyPosts,getUserPosts,toggleLike,createNewPost,getPostById,updateUserPostById,deleteUserPostById,getFollowingPosts}