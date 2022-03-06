import express from 'express'
import multer from 'multer'
import validator from '../validations/validator.js'
import joiSchemas from '../validations/joiSchemas.js'
import { createComment,deleteComment,getComments,toggleLike } from '../controllers/commentControllers.js'
const upload = multer()
const router = express.Router()


router.get('/:id/toggle_like',toggleLike)

router.get('/:id/comments',getComments)

router.post('/new_comment',upload.none(),validator(joiSchemas.comment_schema),createComment)

router.delete('/:id',deleteComment)

export default router