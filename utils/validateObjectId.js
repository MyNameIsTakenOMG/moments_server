import mongoose from 'mongoose'

const validateObjectId = (str)=>{
    if(mongoose.isValidObjectId(str)){
        if((String)(new mongoose.Types.ObjectId(str))===str)
            return true
        return false
    }
    return false
}

export default validateObjectId