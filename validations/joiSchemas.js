import Joi from 'joi'

const joiSchemas = {
    signUp_schema:Joi.object({
        su_username:Joi.string().pattern(/^[a-zA-Z0-9@_]{5,20}$/).required(),
        su_email:Joi.string().email({minDomainSegments:2,tlds:{}}).required(),
        su_password:Joi.string().pattern(/^[a-zA-Z0-9@-_]{5,20}$/).required(),
        su_confirmPassword:Joi.ref('su_password')
    }).with('su_password','su_confirmPassword'),
    signIn_schema:Joi.object({
        si_user:Joi.string().replace(/\s+/g,''),
        si_password:Joi.string().pattern(/^[a-zA-Z0-9@-_]{5,20}$/),
        token:Joi.string()
    }).and('si_user','si_password').without('token',['si_user','si_password']).xor('si_user','token'),
    userProfile_schema:Joi.object({
        bio:Joi.string().replace(/\s+/g,' ').trim().max(400).required(),
        location:Joi.string().replace(/\s+/g,' ').trim().max(100).required(),
        hobbies:Joi.string().replace(/\s+/g,'').max(150).required(),
        profession:Joi.string().replace(/\s+/g,' ').trim().max(100).required(),
    }),
    resetRequest_schema:Joi.object({
        rs_email:Joi.string().email({minDomainSegments:2,tlds:{}}).required()
    }),
    resetPwd_schema:Joi.object({
        rs_newPwd:Joi.string().pattern(/^[a-zA-Z0-9@-_]{5,20}$/).required(),
        token:Joi.string().required()
    }),
    post_schema:Joi.object({
        title:Joi.string().max(100).required(),
        contents:Joi.string().replace(/\s+/g,' ').trim().required(),
        tags:Joi.string().replace(/\s+/g,'').max(100).required(),
        // image:Joi.any().required()
    }),
    comment_schema:Joi.object({
        postId:Joi.string(),
        commentId:Joi.string(),
        contents:Joi.string().replace(/\s+/g,' ').trim().required()
    }).xor('postId','commentId')
}

export default joiSchemas;
