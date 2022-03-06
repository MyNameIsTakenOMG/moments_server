import mongoose from 'mongoose'


const commentSchema = mongoose.Schema({
    author:String,
    avatar:String,
    contents:String,
    likes:[String],  // ---> usernames
    path: String, // -------->  postId/[...comment ids]
    comments:[mongoose.Schema.Types.ObjectId], //--->direct comment ids when the comment is made on the other comment
    allComments:{
        type:Number,
        default:0
    }
},{timestamps:true})

const Comment = mongoose.model('Comment',commentSchema)

export default Comment