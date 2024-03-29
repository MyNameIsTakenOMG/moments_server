import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import jwt from 'express-jwt'
import postRoutes from './routes/postRoutes.js'
import userRoutes from './routes/userRoutes.js'
import commentRoutes from './routes/commentRoutes.js'

import http from 'http'
import {Server} from 'socket.io'
import Redis from 'ioredis'

dotenv.config()
const app = express()
const port = process.env.PORT || 8000

app.use(cookieParser())

if(process.env.NODE_ENV==='production'){
  app.use((req,res,next)=>{
    if(req.header('x-forwarded-proto')!=='https')
    res.redirect(`https://${req.header('host')}${req.url}`)
    else next()
  })
}
if(process.env.NODE_ENV==='production') app.use(cors({credentials:true,origin:process.env.MOMENTS_APP_FRONT_SITE}))
else app.use(cors({origin:'http://localhost:3000'}))

app.use(express.json({limit:'50mb'}))
app.use(express.urlencoded({limit:'50mb',extended:true}))

// connecting mongoDB atlas
mongoose.connect(process.env.MONGODB_CONNECTION_URI)
.then(res=>console.log('MongoDB database is connected'))
.catch(err=>console.log(err.message))    

mongoose.connection.on('error', err => {
    console.log(err.message);
  });
// mongoose.set('toJSON',{virtuals:true})


// redis
const redisClient = new Redis(process.env.REDIS_TLS_URL,{
  tls:{
    rejectUnauthorized:false
  }
})
const flushDB = async()=>{
  try {
    await redisClient.flushdb()
    console.log('redis has been flushed');
  } catch (error) {
    console.log(error);
  }
}
flushDB()

// socket io
const server = http.createServer(app)
const io = new Server(server,{cors:{origin:process.env.NODE_ENV==='production'?process.env.MOMENTS_APP_FRONT_SITE:'http://localhost:3000'}})
// pass io instance to each route
app.use((req, res, next) => {
  req.io = io;
  req.redisClient = redisClient
  return next();
});

io.on('connection',(socket)=>{
  console.log('a user connected');

  socket.on('login',async({name})=>{
    console.log(`the user ${name} is logged in`);
    socket.data.name = name
    console.log('socket id: ',socket.id);
    socket.emit('welcome',`welcome, ${name}`)
    await redisClient.set(name,socket.id)
  })
  socket.on('logout', async({name})=>{
    console.log(`the user ${name} is logged out`);
    console.log('socket id: ',socket.id);
    let delres =await redisClient.del(socket.data.name)
    console.log('delete result: ',delres);
    socket.disconnect(true)
  })
  socket.on('disconnect',async(reason)=>{
    
    console.log('reason: ',reason);
    console.log('socket id: ',socket.id);
    let delres = await redisClient.del(socket.data.name)
    console.log('delete result: ',delres);
    let result = await redisClient.exists(socket.data.name)
    console.log('in redis? : ', result);
  })
})

app.get('/',(req,res)=>{
  res.send('<h1>Welcome, this is Moments API</h1>')
})

app.use('/api/posts',jwt({secret:process.env.JWT_SECRET,algorithms:['HS256'],getToken:req=>req.cookies.token}),postRoutes)
app.use('/api/comments',jwt({secret:process.env.JWT_SECRET,algorithms:['HS256'],getToken:req=>req.cookies.token}),commentRoutes)
app.use('/api/user',userRoutes)


//error handlers
const errorLogger = (err,req,res,next)=>{
  console.error('error:',err.message);
  next(err)
}

const errorResponder = (err,req,res,next)=>{
  const code = err.status || 500
  if(code===401) res.status(code).json({message:'Please sign in first'})
  else res.status(code).json({message:'Something wrong, please try again later'})
}

const invalidPathHandler = (req,res,next)=>{
  res.status(404).json({message:'cannot find the data'})
}

app.use(errorLogger,errorResponder,invalidPathHandler)

server.listen(port,()=>{
    console.log('server is running on port 8000');
})


// Nov 1,2022  heroku security notifications (OpenSSl CVE-2022-3786 & CVE-2022-3602) -- redeploy the project