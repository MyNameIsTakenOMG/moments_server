import mongoose from 'mongoose'

const userNotificationSchema = mongoose.Schema({
    sender:{
        type:String,
        default:''
    },
    notif_type:{
        type:String,  // like or comment
        default:''
    },
    messageId:{
        type:mongoose.Schema.Types.ObjectId,  // for comment operation only
        default:null
    },
    subjectId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    },
    subject_type:{
        type:String,
        default:''
    }
})




const userSchema = mongoose.Schema({
    username:{
        type:String,
        required:true
    },
    password:String,
    email:{
        type:String,
        required:true
    },
    avatar:{
        type:String,
        default:''
    },
    bio:{
        type:String,
        default:''
    },
    location:{
        type:String,
        default:''
    },
    hobbies:[String],
    profession:{
        type:String,
        default:''
    },
    isGoogleUser:{
        type:Boolean,
        default:false
    },
    following:[String], // following names not ids
    followers:[String], // followers names not ids
    posts:[mongoose.Schema.Types.ObjectId],
    notifications:[userNotificationSchema],
    lastCheck:{
        type:Number,
        default:0
    }
},{timestamps:true}) 

// userSchema.virtual('new_notifs').get(function(){
//     return (this.notifications.length-this.lastCheck)
// })

const User = mongoose.model('User',userSchema)

export default User