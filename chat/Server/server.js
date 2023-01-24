const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const app = express()
const socket = require('socket.io')
const Users = require('./models/userModel')
const Messages = require('./models/MessagesModel')
require('dotenv').config()

const PORT = 8000
let socketUsers = []

// Middleware
app.use(cors())
app.use(bodyParser.json())

// DB connection
try {
    mongoose.connect(process.env.REACT_APP_MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then((res) => {
        console.log("Connected to MongoDB");
    })
    .catch (err => {
        console.log(err);
    })
} catch (err) {
    console.log(err);
}

// Routing
app.get("/", (req, res) => {
    res.end('')
})

app.get("/api/all-users", async (req, res) => {
    const users = await Users.find().select([
        "username",
        "avatar_img"
    ])

    return res.json({ users })
})

app.post("/api/get-chat", async (req, res) => {
    const { senderID, receiverID } = req.body

    const sentMess = await Messages.find({ senderID }).where({ receiverID })
    const receivedMess = await Messages.find({ senderID: receiverID }).where({ receiverID: senderID })

    const chat = [...receivedMess, ...sentMess]

    chat.sort((a, b) => {
        return new Date(a.updatedAt) - new Date(b.updatedAt)
    })

    if (!chat) {
        res.json({ status: false })
    }
    
    return res.json({ status: true, data: chat })
})

app.post("/api/send-mess", async (req, res) => {
    const { message, senderID, receiverID } = req.body

    const mess = await Messages.create({
        message,
        senderID,
        receiverID
    })

    return res.json({ status: true, message: mess })
})

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body

    const user = await Users.findOne({ username })
    if (!user) {
        return res.json({ status: false })
    } 

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
        return res.json({status: false})
    }
    user.password = undefined

    return res.json({ status: true, user })
})

app.post("/api/add-friend", async (req, res) => {

    // const { username, password} = req.body

    // const usernameCheck = await Users.findOne({ username })
    // if (usernameCheck) {
    //     return res.json({ status: false })
    // }

    // const hashedPassword = await bcrypt.hash(password, 10)
    // const user = await Users.create({
    //     username,
    //     password: hashedPassword,
    // })
    // delete user.password

    return res.json({ status: true })
})

app.post("/api/add-user", async (req, res) => {
    const { username, password} = req.body

    const usernameCheck = await Users.findOne({ username })
    if (usernameCheck) {
        return res.json({ status: false })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await Users.create({
        username,
        password: hashedPassword,
    })
    delete user.password

    return res.json({ status: true })
})

const server = app.listen(PORT, () => {
    console.log(`Server is listening on ${PORT}`);
})

// Sockets
const io = socket(server, {
    cors: {
      origin: "http://localhost:3000",
      credentials: true,
    },
  });

io.on('connect', socket => {        
    socket.on('add-user', id => {
        console.log(socket.id + " user added");
        socketUsers.push({socketID: socket.id, userID: id})
    })
    
    socket.on('disconnect', () => {
        console.log(socket.id + " disconnected");
        socketUsers = socketUsers.filter(user => user.socketID !== socket.id)
    })

    socket.on('send-msg', (data) => {
        const receivingSocket = socketUsers.filter(user => user.userID === data.receiverID)
        
        if (receivingSocket.length > 0) {
            socket.to(receivingSocket[0].socketID).emit('receive-msg', data)
        }
    })
})