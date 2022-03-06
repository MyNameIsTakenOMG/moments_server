import mongoose from 'mongoose'


const postSchema = mongoose.Schema({
    title:String,
    contents:String,
    author:String,
    avatar:String,
    tags:[String],
    image:String,
    likes:[String], // usernames --> likes
    comments:[mongoose.Schema.Types.ObjectId],// comments ids --> direct comments
    allComments:{
        type:Number,
        default:0
    }
},{timestamps:true})

const Post = mongoose.model('Post',postSchema)

export default  Post