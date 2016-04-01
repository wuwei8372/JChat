/**
 * Created by jxy on 02/01/16.
 */

// This file is required by App.js. It sets up event listeners
// for the two main URL endpoints of the application - /create and /chat/:id
// and listens for socket.io messages.

// Use the gravatar module, to turn email addresses into avatar images:

var gravatar = require('gravatar');

// load up the user model
var User       		= require('../config/models/user');

// Export a function, so that we can pass
// the app and io instances from the App.js file:

module.exports = function(app, io, pub, sub){

    app.get('/', function(req, res){

        // Render views/home.html
        res.render('index');
    });

    app.get('/chatPage', isLoggedIn, function(req, res){

        // Render views/home.html
        res.render('./chat/chat');
    });

    app.get('/userInfo', isLoggedIn, function(req, res){
        res.json({ 'userInfo': req.user});
    })

    app.get('/friendList', isLoggedIn, function(req, res){

        var list = [];
        User.findById(req.query.userId, function(err, user) {
            user.friendList.forEach(function(item){
                list.push({
                    id: item.id,
                    chID: item.chID,
                    userName: item.userName,
                    userStatus: item.userStatue,
                    imgSrc: item.imgSrc
                })
            })
        }).then(function(){
            res.contentType('application/json');
            res.send(JSON.stringify(
                list
            ))
        });

    })

     app.get('/chatRecord', isLoggedIn, function(req, res){

        var mockList = [
            {
               type: 'answer left',
               userName: 'n1',
               userStatus: 'online',
               imgSrc: '/images/unnamed.jpg',
               text: 'hahasdfasdhf',
               time: '2016.3.24'
            },
            {
               type: 'answer right',
               userName: 'n2',
               userStatus: 'online',
               imgSrc: '/images/unnamed.jpg',
               text: 'reply message',
               time: '2016.3.24'
            }
        ]
        //return mock friend list
        res.contentType('application/json');
        res.send(JSON.stringify(
           mockList
        ))
    })

    app.get('/create', function(req,res){

        // Generate unique id for the room
        var id = Math.round((Math.random() * 1000000));

        // Redirect to the random room
        res.redirect('/chat/'+id);
    });

    app.get('/chat/:id', function(req,res){

        // Render the chant.html view
        res.render('chat');
    });



    // Initialize a new socket.io application, named 'chat'
    var chat = io.on('connection', function (socket) {


        // When the client emits the 'load' event, reply with the
        // number of people in this chat room

        socket.on('load',function(data){

            var room = findClientsSocket(io,data);
            if(room.length === 0 ) {

                socket.emit('peopleinchat', {number: 0});
            }
            else if(room.length === 1) {

                socket.emit('peopleinchat', {
                    number: 1,
                    user: room[0].username,
                    avatar: room[0].avatar,
                    id: data
                });
            }
            else if(room.length >= 2) {

                chat.emit('tooMany', {boolean: true});
            }
        });

        // When the client emits 'login', save his name and avatar,
        // and add them to the room
        socket.on('login', function(data) {

            var room = findClientsSocket(io, data.id);
            // Only two people per room are allowed
            if (room.length < 2) {

                // Use the socket object to store data. Each client gets
                // their own unique socket object

                socket.username = data.user;
                socket.room = data.id;
                socket.avatar = gravatar.url(data.avatar, {s: '140', r: 'x', d: 'mm'});

                // Tell the person what he should use for an avatar
                socket.emit('img', socket.avatar);


                // Add the client to the room
                socket.join(data.id);

                if (room.length == 1) {

                    var usernames = [],
                        avatars = [];

                    usernames.push(room[0].username);
                    usernames.push(socket.username);

                    avatars.push(room[0].avatar);
                    avatars.push(socket.avatar);

                    // Send the startChat event to all the people in the
                    // room, along with a list of people that are in it.

                    chat.in(data.id).emit('startChat', {
                        boolean: true,
                        id: data.id,
                        users: usernames,
                        avatars: avatars
                    });
                }
            }
            else {
                socket.emit('tooMany', {boolean: true});
            }
        });

        // Somebody left the chat
        socket.on('disconnect', function() {

            // Notify the other person in the chat room
            // that his partner has left

            socket.broadcast.to(this.room).emit('leave', {
                boolean: true,
                room: this.room,
                user: this.username,
                avatar: this.avatar
            });

            // leave the room
            socket.leave(socket.room);
        });


        // Handle the sending of messages
        socket.on('msg', function(data){

            // When the server receives a message, it sends it to the other person in the room.
            //socket.broadcast.to(socket.room).emit('receive', {msg: data.msg, user: data.user, img: data.img});
            pub.publish('chatting', data);
        });

        sub.subscribe('chatting');
        sub.on('message', function(channel, message) {
            console.log('message in socketIO ' + message);
        })

    });



};

function findClientsSocket(io,roomId, namespace) {
    var res = [],
        ns = io.of(namespace ||"/");    // the default namespace is "/"

    if (ns) {
        for (var id in ns.connected) {
            if(roomId) {
                var index = ns.connected[id].rooms.indexOf(roomId) ;
                if(index !== -1) {
                    res.push(ns.connected[id]);
                }
            }
            else {
                res.push(ns.connected[id]);
            }
        }
    }
    return res;
}

// route middleware to make sure
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}

