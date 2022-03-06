
const validator = (schema)=>(req,res,next)=>{
    console.log('req.body: ',req.body);
    const {error} = schema.validate(req.body,{abortEarly:false})
    const valid = error ==null
    if(valid) return next()
    else {
        const {details} = error
        const errorMessage = details.map(d=>d.message).join(',')
        console.log('error: ',errorMessage);
        res.status(422).json({message:'invalid request data'})
    }
}

export default validator;
