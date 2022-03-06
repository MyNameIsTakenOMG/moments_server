import express from 'express'
import { getSearchedPosts,getEditPostById,getMyPosts,createNewPost, toggleLike,deleteUserPostById, getAllPosts, getFollowingPosts, getPostById, getUserPosts, updateUserPostById } from '../controllers/postControllers.js'
import multer from 'multer'
import validator from '../validations/validator.js'
import joiSchemas from '../validations/joiSchemas.js'

const upload = multer()
const router = express.Router()

router.get('/',getAllPosts)

router.get('/following_posts',getFollowingPosts)

router.get('/my_posts',getMyPosts)

router.get('/user_posts/:username',getUserPosts)

router.post('/new_post',upload.single('image'),validator(joiSchemas.post_schema),createNewPost)

router.get('/search',getSearchedPosts)

router.get('/:postId/toggle_like',toggleLike)

router.get('/edit/:postId',getEditPostById)

router.get('/:postId',getPostById)  // get certain post or comment

router.patch('/:postId',upload.single('image'),validator(joiSchemas.post_schema),updateUserPostById)

router.delete('/:postId',deleteUserPostById)


export default router