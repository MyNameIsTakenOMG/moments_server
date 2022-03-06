import Post from '../models/postModel.js'
import Comment from '../models/commentModel.js'
import User from '../models/userModel.js'
import validateObjectId from '../utils/validateObjectId.js'


const toggleLike = async(req,res)=>{
    try {
        const {id} = req.params
        const theLoggingUsername = req.user.user

        const theComment = await Comment.findById(id)
        const index = theComment.likes.findIndex(name=>name===theLoggingUsername)

        // like the comment
        if(index===-1){
            theComment.likes.push(theLoggingUsername)
            await theComment.save()
            let receiver = await User.findOne({username:theComment.author})
            // decide if the login user liked the comment before
            let theIndex = await receiver.notifications.findIndex(notif=>notif.sender===theLoggingUsername&&notif.type==='like'&&notif.subjectId.toString()===theComment._id.toString())
            console.log('notification index: ',theIndex);
            // decide if need to create a new notif ( if the login user did not like the post before)
            if(theIndex===-1){
                receiver.notifications.push({sender:theLoggingUsername,notif_type:'like',subjectId:theComment._id,subject_type:'comment'})
                await receiver.save()
                // decide if need to send a new notif (if the receiver is online)
                let isExisting = await req.redisClient.exists(theComment.author)
                console.log('is author in redis: ',isExisting);
                // if the receiver is online, then send a notification 
                if(isExisting===1){
                    let socketId = await req.redisClient.get(theComment.author)
                    req.io.to(socketId).emit('like',`user ${theLoggingUsername} liked your comment`)
                }
            }
            res.status(200).json({message:'liked'})
        }
        // unlike the comment
        else{
            theComment.likes.splice(index,1)
            await theComment.save()
            res.status(200).json({message:'unliked'})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'failed to fetch the data'})
    }
    
}

const getComments = async(req,res)=>{
    console.log('hitting the route of getting comments array');
    try {
        const {type } = req.query
        const {id} = req.params

        const {cursor} = req.query
        const limit = parseInt(req.query.limit)
        let commentsArray=[]
        let newCursor, subject
        const findComment = async(id)=>{
            try {
                let foundComment = await Comment.findById(id)
                return foundComment
            } catch (error) {
                console.log(error);
            }
        }

        const getArrayAndCursor = async(cursor,limit,subject)=>{
            let array = []
            let newCursor
            let promiseArray = []
            // first fetch
            if(!cursor){
                // if there is more
                if(subject.comments.length>=limit+1){
                    for (let i = 0; i < limit; i++) {
                        promiseArray.push(findComment(subject.comments[(subject.comments.length-1)-i]))    
                    }
                    array = await Promise.all(promiseArray)
                    newCursor = subject.comments.length-(limit+1)
                }
                // if there is no more
                else{
                    for (let i = subject.comments.length-1; i >=0; i--) {
                        promiseArray.push(findComment(subject.comments[i]))
                    }
                    array = await Promise.all(promiseArray)
                    newCursor = null
                }
            }
            // subsequent fetch
            else{
                let parsedCursor = parseInt(cursor)
                // if there is more
                if(parsedCursor>=limit){
                    for (let i = 0; i < limit; i++) {
                        promiseArray.push(findComment(subject.comments[parsedCursor-i]))                        
                    }
                    array = await Promise.all(promiseArray)
                    newCursor = parsedCursor-limit
                }
                // if there is no more
                else{
                    for (let i = parsedCursor; i>=0; i--) {
                        promiseArray.push(findComment(subject.comments[i]))                        
                    }
                    array = await Promise.all(promiseArray)
                    newCursor =null
                }
            }
            return {array,newCursor}
        }

        if(type==='post') subject = await Post.findById(id)
        else if(type==='comment') subject = await Comment.findById(id)
        
        let result = await getArrayAndCursor(cursor,limit,subject)
        commentsArray = [...result.array]
        newCursor = result.newCursor

        return res.status(200).json({
            data:commentsArray,
            cursor:newCursor
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const createComment = async(req,res)=>{
    const {contents,postId,commentId} = req.body
    const theLoggingUsername = req.user.user
    const theUser = await User.findOne({username:theLoggingUsername})
    console.log('req.body: ',req.body);

    try {
        // if this is a direct comment on a post
        if(postId){
            console.log('postId: ',postId);
            const thePost = await Post.findById(postId)
            let receiver = await User.findOne({username:thePost.author})
            const newComment = new Comment({
                author:theLoggingUsername,
                avatar:theUser.avatar,
                contents:contents,
                path:''.concat(postId),
            })
    
            await newComment.save()
            thePost.comments.push(newComment._id)
            thePost.allComments+=1
            await thePost.save()
            // add a new notif to the receiver
            receiver.notifications.push({sender:theLoggingUsername,notif_type:'comment',messageId:newComment._id,subjectId:thePost._id,subject_type:'post'})
            await receiver.save()
            // decide if the receiver is online, if yes, then send a new notif
            let isExisting = await req.redisClient.exists(thePost.author)
            console.log('is author in redis: ',isExisting);
            // if the receiver is online, then send a notification 
            if(isExisting===1){
                let socketId = await req.redisClient.get(thePost.author)
                req.io.to(socketId).emit('comment',`user ${theLoggingUsername} commented on your post`)
            }
            res.status(200).json({comment:newComment,message:'New comment created successfully'})
        }
        // this is a direct comment on another comment 
        else if(commentId){
            console.log('commentId: ',commentId);
            const theComment = await Comment.findById(commentId)
            let receiver = await User.findOne({username:theComment.author})
            const newComment = new Comment({
                author:theLoggingUsername,
                avatar:theUser.avatar,
                contents:contents,
                path: theComment.path.concat(`/${theComment._id}`),
            })

            await newComment.save()
            //add the new comment to its all predecessors
            const idArray = newComment.path.split('/')
            await Promise.all(idArray.map(async(Id,index)=>{
                if(index===0){   //first id ====> post
                    let thePost = await Post.findById(Id)
                    thePost.allComments+=1
                    await thePost.save()
                }else if(index===(idArray.length-1)){ // last id ===>parent comment
                    let theComment = await Comment.findById(Id)
                    theComment.comments.push(newComment._id)
                    theComment.allComments+=1
                    await theComment.save()
                }else{
                    let theComment = await Comment.findById(Id)
                    theComment.allComments+=1
                    await theComment.save()
                }
            }))            
            // add a new notif to the receiver
            receiver.notifications.push({sender:theLoggingUsername,notif_type:'comment',messageId:newComment._id,subjectId:theComment._id,subject_type:'comment'})
            await receiver.save()
            // decide if the receiver is online, if yes, then send a new notif
            let isExisting = await req.redisClient.exists(theComment.author)
            console.log('is author in redis: ',isExisting);
            // if the receiver is online, then send a notification 
            if(isExisting===1){
                let socketId = await req.redisClient.get(theComment.author)
                req.io.to(socketId).emit('comment',`user ${theLoggingUsername} commented on your comment`)
            }
            res.status(200).json({comment:newComment,message:'New comment created successfully'})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

const deleteComment = async(req,res)=>{
    try {
        const {id} = req.params
        console.log('this is delete route from comments, id: ',id);
        // validate the id
        const validateResult = validateObjectId(id)
        if(!validateResult) return res.status(404).json({message:'no data found'})
        //delete all comments under the comment
        const theComment = await Comment.findById(id)
        const thePath = theComment.path.concat(`/${theComment._id}`)
        console.log('thePath: ',thePath);
        // const myRex = new RegExp('^'+thePath)
        // const deleteResult = await Comment.deleteMany({path:myRex})
        const deleteResult = await Comment.deleteMany({path:{$regex:'^'+thePath}})
        console.log('delete result: ',deleteResult);
        // delete the comment and remove it from its all predecessors
        const counts = (theComment.path.match(/\//g) || []).length
            // if this is the comment on a post
        if(counts===0){
            console.log('should be here');
            const thePost = await Post.findById(theComment.path)
            thePost.allComments-=(theComment.allComments+1)
            thePost.comments.pull(id)
            await thePost.save()
            console.log('thePost: ',thePost);
            await Comment.deleteOne({_id:id})
            res.status(200).json({message:'successfully deleted the comment'})
        }
            // if this is a comment on another comment
        else{
            const theList = theComment.path.split('/')
            await Promise.all( theList.map(async(listItem,index)=>{
                if(index===0){   //first id ====> post
                    let thePost = await Post.findById(listItem)
                    thePost.allComments-=(theComment.allComments+1)
                    await thePost.save()
                }else if(index===(theList.length-1)){ // last id ===>parent comment
                    let parentComment = await Comment.findById(listItem)
                    parentComment.comments.pull(id)
                    parentComment.allComments-=(theComment.allComments+1)
                    await parentComment.save()
                }else{
                    let parentComment = await Comment.findById(listItem)
                    parentComment.allComments-=(theComment.allComments+1)
                    await theComment.save()
                }
            }))
            await Comment.deleteOne({_id:id})
            res.status(200).json({message:'Deleted successfully'})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:'Something wrong, please try again later'})
    }
}

export {toggleLike,getComments,createComment,deleteComment}