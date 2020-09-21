//jshint esversion:6

//CONFIGURATION REQUIRED FOR .ENV FILE
require('dotenv').config()

//REQUIRED BASIC MODULES
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require('mongoose')
const ejs = require("ejs");

//LODASH FOR QUERY STRING MANIPULATIONS 
var _ = require('lodash');

//REQUIRED MODULES FOR USER AUTHENTICATION
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const flash = require('connect-flash')
const cookie = require('cookie')

//JSON WEB TOKEN
const jwt = require('jsonwebtoken')

//MAILGUN API FOR EMAIL VERIFICATION
const mailgun = require("mailgun-js");
const { get } = require('lodash')
const DOMAIN = 'sandbox3e5d97fb9b6f43888ff79fd6aae2efcf.mailgun.org';
const mg = mailgun({apiKey: process.env.MAILGUN_API_KEY, domain: DOMAIN});

//FOR FLASHING MESSAGES
app.use(flash())

//SETTING UP MIDDLEWARES
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.use(express.static("public"));

//SESSION MIDDLEWARE
app.use(session({
  secret: process.env.ENCKEY,
  resave: false,
  saveUninitialized: false
}))

//SETTING UP CACHE CONTROL TO RESTRICT ACCESS TO SESSION THROUGH BACK BUTTON AFTER LOGOUT
app.use(function(req, res, next) {
  if (!req.user) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  }
  next();
});

//SETTING UP PASSPORT MIDDLEWARES FOR AUTHENTICATION AND SESSION MANAGEMENT
app.use(passport.initialize())
app.use(passport.session())

//SETTING UP DB CONNECTION USING MONGOOSE
const url = mongoose.connect(process.env.DB_NAME, { useUnifiedTopology: true }, { useNewUrlParser: true })
mongoose.set('useCreateIndex', true)

//SETTING UP DB SCHEMA 
const userSchema = new mongoose.Schema({

  firstname: String,
  lastname: String,
  email: String,
  username: String,
  password: String,
  resetPasswordToken: {
      data: String,
      default: ''
  },
  userBooksCollection: [],
  feedback: {
      type: String,
      default: ''
  },
  suggessions: {
    type: String,
    default: ''
  }
})


//SETTING UP PLUGGIN TO USE passport-local-mongoose
userSchema.plugin(passportLocalMongoose)

//SETTING UP MODEL FOR USER SCHEMA
const User = mongoose.model('user', userSchema)

//PASSPORT MIDDLEWARES
passport.use(User.createStrategy())
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

//ENTRY PAGE - (LOGIN/REGISTER)
app.get('/', (req, res)=> {
  res.render('entry', {error: '', emailConfirmation: '', status: ''})
})


//HOMEPAGE
app.get('/home', (req, res)=> {

  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
        if(res.statusCode !== 200)
            res.render('failure')
        else
        {
            User.find({username: req.user.username}, (err, documentFound)=> {

                if(err)
                  console.log(err);
                else
                { 
                    documentFound.forEach((element)=> {
                        res.render('home', {booksCollection: element.userBooksCollection}) // RENDERING ARRAY OF NESTED DOCUMENTS
                    })
                }
            })
        }
  }
  
})

//COMPOSE NEW REVIEW - GET ROUTE
app.get('/compose', (req, res)=> {
  
  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
      if(res.statusCode!==200)
           res.render('failure')
       else
            res.render('compose')
  }
})


//POST NEW REVIEW - POST ROUTE
app.post('/compose', (req, res)=> {
  
  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
      if(res.statusCode!==200)
          res.render('failure')
      else
      {
          let displayTitle = req.body.postTitle
          let postTitle = _.upperFirst(_.lowerCase(req.body.postTitle === "" ? 'DEFAULT' : req.body.postTitle))
          postTitle = postTitle.replace(/[ ]/g,'')
          let postBody = req.body.postBody
          let isPrivate
          let privacyStatus = req.body.isPrivateCompose
          if(privacyStatus === undefined)
            isPrivate = false
          else
            isPrivate = true
          
          User.update({username: req.user.username}, {
              
              $addToSet: 
              {
                  userBooksCollection: 
                  {
                      title: postTitle,
                      content: postBody,
                      displayTitle: displayTitle,
                      isPrivate: isPrivate
                  }
              }
          }, (err)=> {

              if(err)
                  console.log(err);
                
              else
                res.redirect('/home')
          })
       }
  }
})


//GET A SPECIFIC REVIEW
app.get('/posts/:postName', (req, res)=> {

  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
      if(res.statusCode!==200)
          res.render('failure')
      else
      {
          let postName = _.upperFirst(_.lowerCase(req.params.postName))
          postName = postName.replace(/[ ]/g, '')

          User.find({username: req.user.username},(err, documentFound)=> {

              if(err)
                  console.log(err);
              else if(documentFound)
              {
                  documentFound.forEach((element)=> {

                    element.userBooksCollection.forEach((internalDocument)=> {

                      if(internalDocument.title === postName)
                        res.render('post', {postTitle: internalDocument.displayTitle, postBody: internalDocument.content, isPrivate: internalDocument.isPrivate})
                    })

                  })
              }
          })
      }
  }
})

//MAKE CHANGES FOR AN EXISTING REVIEW - GET ROUTE
app.post('/renderUpdate', (req, res)=> {

  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
      if(res.statusCode!==200)
        res.render('failure')
      else
      {
          let title = req.body.title
          title = _.upperFirst(_.lowerCase(title))
          title = title.replace(/[ ]/g, '-')
          let content = req.body.content
          let isPrivate = req.body.isPrivate
          console.log(isPrivate);
          

          res.render('put', {postTitle: title, postBody: content, isPrivate: isPrivate})
      }
  }
})


//MODIFIED REVIEW - POST ROUTE
app.post('/update', (req, res)=> {

  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
      if(res.statusCode!==200)
      res.render('failure')
      else
      {
          var displayEditTitle = req.body.postTitleEdit
          console.log(displayEditTitle);
          var title = req.body.postTitleEdit
          title = _.upperFirst(_.lowerCase(req.body.postTitleEdit === "" ? 'DEFAULT' : req.body.postTitleEdit))
          title = title.replace(/[ ]/g, '')
          var content = req.body.postBodyEdit
          var hiddenTitle = req.body.hiddenTitle

          let isPrivate
          let privacyStatus = req.body.isPrivateModify

          if(privacyStatus === undefined)
            isPrivate = false
          else
            isPrivate = true
      
          User.update({username: req.user.username}, {
              $set: {
                  
                  "userBooksCollection.$[element].title": title,
                  "userBooksCollection.$[element].content": content,
                  "userBooksCollection.$[element].displayTitle": displayEditTitle.replace(/[-]/g,' '),
                  "userBooksCollection.$[element].isPrivate": isPrivate

              }},
              {
                  arrayFilters: [{"element.title": _.upperFirst(hiddenTitle.replace(/[-]/g,''))}]
              },
              
              (err, succes)=> {

                  if(err)
                      console.log(err);
                  else
                      res.redirect('/home')
              }
          )
      }
  }
})

//DELETE A SPECIFIC REVIEW
app.post('/delete', (req, res)=> {

  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
        if(res.statusCode !== 200)
            res.render('failure')
        else
        {
            var title = req.body.title
            console.log(title);
            var content = req.body.content
      
            User.update({username: req.user.username}, {
      
                $pull: 
                {
                    userBooksCollection: {content : content}
                }
            }, 
            
            (err, success)=> {
      
                if(err)
                    console.log(err);
                else
                    res.redirect('/home')
            })
        }
  }

})


//DELETE ALL REVIEWS 
app.post('/deleteAll', (req, res)=> {

  if(!req.isAuthenticated())
      res.redirect('/')
  else
  {
      if(res.statusCode!==200)
          res.render('failure')
      else
      {
          User.update({username: req.user.username}, {

              $set:
              {
                  userBooksCollection: []
              }
          }, (err, success)=> {

              if(err)
                  console.log(err);
              else
                  res.redirect('/home')
          })
      }
  }

})


//FEEDBACK AND SUGGESSIONS - GET
app.get('/contact', (req, res)=> {
  
    if(!req.isAuthenticated())
        res.redirect('/')
    else
    {
        if(res.statusCode!==200)
            res.render('failure')
        else 
            res.render('contact')
    }

  })


//POST A FEEDBACK/SUGGESSION
app.post('/contact', (req, res)=> {

  if(!req.isAuthenticated())
    res.redirect('/')
  else
  {
    if(res.statusCode!==200)
        res.render('failure')
    else
    {
        var feedback = req.body.feedback
        var suggessions = req.body.suggessions
    
        if(feedback !== '' && suggessions !== '')
        {
            User.update({username: req.user.username}, {$set:  {feedback: feedback, suggessions: suggessions}}, (err, success)=> {
    
                if(err)
                  console.log(err)
              })    
        }
        else if(feedback !== '')
        {
            User.update({username: req.user.username}, {$set: {feedback: feedback}}, (err, success)=> {
    
                if(err)
                  console.log(err);
              })    
        }
        else if(suggessions !== '')
        {
            User.update({username: req.user.username}, {$set: {suggessions: suggessions}}, (err, success)=> {
    
                if(err)
                  console.log(err);
              })    
        }
        res.render('success')
    }
  }
})

//IMPORT ROUTE
app.get('/import', (req, res)=> {

    if(!req.isAuthenticated())
        res.redirect('/')
    else
    {
        if(res.statusCode !== 200)
            res.render('failure')
        else
            res.render('import', {isGetRequest: true, alertMessage: '', booksCollection: [], otherUsername: '', successMessage: '', thisUsername: req.user.username})
    }
})

//SEARCH FOR A USER
app.post('/searchUsername', (req, res)=> {

    if(!req.isAuthenticated())
        res.redirect('/')
    else
    {
        if(res.statusCode !== 200)
            res.render('failure')
        else
        {
            var otherUsername = req.body.otherUserName
            console.log('otheruser name value from /searchOthertUser : ' + otherUsername);
            var publicOnlyBooksCollection = []
    
            User.find({username: otherUsername},(err, success)=> {
    
                if(err)
                    console.log(err);
                if(!success.length)
                    res.render('import', {isGetRequest: false, alertMessage: 'user does not exist', booksCollection: [], otherUsername: '', successMessage: '', thisUsername: req.user.username})
                else
                {
                        success.forEach((element)=> {
    
                            element.userBooksCollection.forEach((book)=> {
                                if(!book.isPrivate)
                                    publicOnlyBooksCollection.push(book)
                            })

                            res.render('import', {isGetRequest: false, alertMessage: '', booksCollection: publicOnlyBooksCollection, otherUsername: otherUsername, successMessage: '', thisUsername: req.user.username})
                       })
                }
            })
        }
    }
})

//IMPORT REVIEWS FROM OTHER USERS
app.post('/importFromOtherUser', (req, res)=> {

    if(!req.isAuthenticated())
        res.redirect('/')
    else
    {
        if(res.statusCode !== 200)
            res.render('failure')
        else
        {
            const otherUser = req.body.otherUsername
            const wholeDocument = req.body.wholeDoc
    
            User.find({username: otherUser}, (err, success)=> {
    
                if(err)
                    console.log(err);
                
                if(!success)
                    res.render('import', {isGetRequest: false, alertMessage: 'user does not exist', booksCollection: [], otherUsername: '', successMessage: '', thisUsername: req.user.username})
                
                else if(success)
                {
                    success.forEach((docs)=> {
    
                        docs.userBooksCollection.forEach((book)=> {
    
                            if(!book.isPrivate)
                            {
                                User.update({username: req.user.username}, {$addToSet: {userBooksCollection: {title: book.title, content: book.content, displayTitle: book.displayTitle}}}, (err, success)=> {
    
                                    if(err)
                                        console.log(err);
                                })
                            }
                        })
                    })
                    res.redirect('/home')
                }
    
            })
        }
    }
})

//FAIL CASES

//ANY OTHER CHAINED ROUTES
app.get('/compose/:other', (req, res)=>{

    res.render('failure')
  })
  
  //some random invalid route
  app.get('/contact/:other', (req, res)=> {
  
    res.render('failure')
  })  
  
  //some random invalid route
  app.get('/renderUpdate/:other', (req, res)=> {
  
    res.render('failure')
  })
  //some random invalid route
  app.get('/home/:other', (req, res)=>{

    res.render('failure')
  })

// ========================================================================================================================================
                                             // AUTHENTICATION AND SECURITY


//REGISTER ROUTE
app.post('/register', (req, res)=> {

        if(res.statusCode !== 200)
            res.render('failureBeforeAuthentication')
        else
        {
            var firstname = req.body.firstname
            var lastname = req.body.lastname
            var email = req.body.email
            var username = req.body.username
            var password = req.body.password
            
            
            const userDetailsWithPassword = new User({
            
              firstname: firstname,
              lastname: lastname,
              email: email,
              username: username,
              password: password
            
            })
            
                  User.findOne({$or: [{email: email},{username: username}]}, (err, found)=> {
                      if(err)
                          console.log(err);
            
                      else if(found)
                          res.render('entry', {error: 'User with these credentials already exists', emailConfirmation: '', status: ''})
            
                      else{
                          const token = jwt.sign(userDetailsWithPassword.toJSON(), process.env.JWT_ACC_ACTIVATE,{expiresIn: '20m'})
                      
                          const data = {
                              from: 'donotreply@Bibiophily.com',
                              to: email,
                              subject: 'Account Verification Link',
                              html: `<h2>Please click on the below link to activate your account</h2>
                                      <p><a href="${process.env.CLIENT_URL}/emailVerification/${token}" role="button">Verify Account</a></p>`
                          };
                          mg.messages().send(data, function (error, body) {
                              
                              if(error)
                                  console.log(error);
                              else
                                  res.render('entry', {emailConfirmation: 'An email has been sent to the given email address. Kindly verify', error: '', status: ''})
                          }); 
                      }
                      
                  })
        }
    
    })

    
    //EMAIL VERIFICATION FROM RESPECTIVE EMAIL SERVICE PROVIDER
    app.get('/emailVerification/:token', (req, res)=> {
        
        if(res.statusCode !== 200)
            res.render('failureBeforeAuthentication')
        else
        {
            const token = req.params.token
            if(token)
            jwt.verify(token, process.env.JWT_ACC_ACTIVATE, (err, decodedToken)=> {
              if(err)
                  res.render('entry', {error: 'Incorrect or expired link', status: '', emailConfirmation: ''})
              else
                  {
                      console.log('No errors in token verification');
                      const {firstname, lastname, email, username, password} = decodedToken
                      User.findOne({email: email}, (err, found)=> {
                          if(err)
                               console.log(err);
                          else if(found)
                              res.render('entry', {status: 'This account has already been verified', error: '',emailConfirmation: ''})
                          else
                          {
                              console.log(('No repetition on verification. A FRESH REQUEST'));
                              const newUser = new User({
            
                                  firstname: firstname,
                                  lastname: lastname,
                                  email: email,
                                  username: username,
                              }) 
                             User.register(newUser, password, (err, user)=> {
                                 if(err)
                                   console.log(err);
                                 else
                                  {
                                      console.log('registered user details');
                                      res.render('entry', {status: 'Account verfication was successful', emailConfirmation: '', error: ''})
                                  }
                             })
                          }
                      })
                  }
              })
        }
    
    })


 //USER AUTHENTICATION
app.post('/login', (req, res)=> {

    if(res.statusCode !== 200)
        res.render('failureBeforeAuthentication')
    else
    {
        var username = req.body.username
        var password = req.body.password
      
        const user = new User({
            username: username,
            password: password
        })
      
            req.login(user, (err)=> {
      
                if(err)
                    console.log(err);
                else if(!user)
                    res.render('entry', {error: 'Incorrect username or password'})
                else
                {
                    passport.authenticate('local', {successRedirect: '/home', failureRedirect: '/', failureFlash: true})(req, res, ()=> {
                    })
                }
            })
    }

})

//FORGOT PASSWORD POST ROUTE
app.post('/forgotPassword', (req, res)=> {

    if(res.statusCode !== 200)
        res.render('failureBeforeAuthentication')
    else
    {
        const email = req.body.emailResetPassword

        User.find({email: email}, (err, found)=> {
        
          if(err)
              res.render('entry', {error: 'Email does not exist', status: '', emailConfirmation: ''})
          else if(!found)
          {
              res.render('entry', {error: 'Email does not exist', status: '', emailConfirmation: ''})
          }
          else
          {
              const token = jwt.sign({_id: found._id}, process.env.JWT_RESET_PASSWORD,{expiresIn: '20m'})
                  
                      const data = {
                          from: 'support@customlists.com',
                          to: email,
                          subject: 'Reset Password',
                          html: `<h2>Please click on the below link to reset your password</h2>
                                  <a href="${process.env.CLIENT_URL}/resetPassword/${token}" role="button" class="btn btn-lg btn-success">Reset Password</a>`
                      };
                      
                  User.updateOne({resetPasswordToken: token}, (err, success)=> {
                      if(err)
                        console.log(err);
                      else
                      {
                          mg.messages().send(data, function (error, body) {
                          
                              if(error)
                                res.render('entry', {error: 'Email does not exist', status: '', emailConfirmation: ''})
                              else
                                  res.render('entry', {emailConfirmation: 'A reset link has been sent to the given email address. Kindly check to proceed further', error: '', status: ''})
                          }); 
        
                      }
        
                  })
            }
        })  
    }
})

//AUTHENTICATING TOKEN FOR RESETTING PASSWORD
app.get('/resetPassword/:resetToken', (req, res)=> {

    if(res.statusCode !== 200)
        res.render('failureBeforeAuthentication')
    else
    {
        const resetToken = req.params.resetToken 
        if(resetToken)
        {
          jwt.verify(resetToken, process.env.JWT_RESET_PASSWORD, (err, decodedToken)=> {
              if(err)
                  res.render('entry', {error: 'Incorrect or expired link', status: '', emailConfirmation: ''})
          })
          User.findOne({resetPasswordToken: resetToken}, (err, foundmatchingToken)=> {
              if(err)
              {
                  res.render('entry', {error: 'AUTHENTICATION ERROR', status: '', emailConfirmation: ''})
                  console.log('token is not matching');
              }
                  
              else
                  res.render('reset', {resetToken: resetToken, error: ''})
          })
        }
        else
        {
          res.render('entry', {error: 'AUTHENTICATION ERROR', status: '', emailConfirmation: ''})
          console.log('token format is not matching');
        }
    }
})

//CHANGE PASSWORD POST ROUTE
app.post('/changePassword', (req, res)=> {

    if(res.statusCode !== 200)
        res.render('failureBeforeAuthentication')
    else
    {
        const resetToken = req.body.resetToken
        const newPassword = req.body.newPassword
        const confirmNewPassword = req.body.confirmNewPassword
        
        if(newPassword !== confirmNewPassword)
          res.render('reset', {resetToken: resetToken ,error: 'Passwords do not match'})
        else
        {
        
          User.findOne({resetPasswordToken: resetToken}, (err, foundUser)=> {
        
              if(err)
                  res.render('entry', {error: 'Password reset unsuccessful. Try again', status: '', emailConfirmation: ''})
               else if(foundUser)
               {
                  foundUser.setPassword(newPassword, (err, success)=> {
                      if(err)
                          res.render('entry', {error: 'Password reset unsuccessful. Try again', status: '', emailConfirmation: ''})
                      else
                      {
                          foundUser.save((err,success)=> {
                              if(err)
                                   res.render('entry', {error: 'Password reset unsuccessful. Try again', status: '', emailConfirmation: ''})
                              else
                                  res.render('entry', {status: 'Password has been changed successfully', error: '', emailConfirmation: ''})
                          })
                      }
                          
                  })
               }
          })
        }
    }
})

//LOGOUT AND INVALIDATING SESSION
app.get('/logout', (req, res)=> {

    if(res.statusCode !== 200)
        res.render('failure')
    else
    {
        req.logOut()
        res.redirect('/')
    }
})
                                      

//SERVER LISTENING ON PORT
app.listen(process.env.PORT || 6589, ()=> {
    console.log(`listening on port ${process.env.PORT}`);
})
