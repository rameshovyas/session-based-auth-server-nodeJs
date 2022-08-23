const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const mysql = require("mysql");
const app = new express();

app.use(express.json());

const port = 3000;

// Create connection pool
const pool = mysql.createPool({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'auth'
});
  
/* Sign up */
app.post("/signup", async(req,res) => {
    try {
        const { username , password } = req.body;
        pool.getConnection((err, connection) => {
            if(err) {
                console.log(`Error connecting MySQL : ${err}`);
                return;
            }
            console.log("Mysql connected as id : " + connection.threadId);
            // Check user already exists 
            const sql = `select username from user_session where username = '${username}'`;
            
            connection.query(sql, async(err,rows) =>{
                try{
                    if(err) {
                        console.log(err);
                        return;
                    }                              
                    
                    if(rows.length ===0 ) { //Create new user
                        // Generate a new salt for every user
                        const salt = await bcrypt.genSalt();
                        // Create password hash
                        const hashedPassword = await bcrypt.hash(req.body.password,salt);
                        
                        const user = {"username": req.body.username,"password": hashedPassword};                            
                        const sql = "insert into user_session (username,user_password) values('" + username + "','" + hashedPassword + "')";
                      
                        connection.query(sql, (err,rows) =>{
                            if(err) {
                                console.log(err);
                                return;
                            }
                            console.log("User created!");
                            res.status(201).send(user);
                        });                        

                    }
                    else{
                        console.log("User alreday exists");
                        res.send({"error": "User already exists!"});
                    }
                }
                catch {
                    res.send({"error": "Unable to access data"});
                }

             });
        });             
       
    }
    catch {
        res.status(500).send();
    }    

});


// Login route
app.post("/login", async (req, res) => {
    try {
        const { username,password } = req.body;
        if(username) {            
            pool.getConnection((err, connection) => {
            if(err) {
                console.error(err);
                return;
            }
            const sql =`select * from user_session where username='${username}'`;
            connection.query(sql, async(err,rows) =>{
                if(err) {
                    console.log(err);
                    return;
                }
                if(rows.length ===0) {
                    res.status(400).send("Username not found!");
                    return;
                }

                // Username found Compare the password now
                const saltedPassword = rows[0].user_password;
        
                const compareResult = await bcrypt.compare(password, saltedPassword);

                if(compareResult === true) {                  

                    // Generate new SessionId
                    const sessionId = await randomSessionId();

                    //Associate sessionId with the user by updating record
                    const sql= `update user_session set sessionId ='${sessionId}' where username='${username}'`
                    connection.query(sql, (err,rows) => {
                    if(err) {
                       console.error(err);                       
                     } 
                     else {
                        res.setHeader("set-cookie", [`SESSION_ID=${sessionId}; httponly; samesite=lax`]);
                        res.send({"success": "Logged in successfully!"});
                     }                       
                });

                }
                else {
                    res.send("Error : password incorrect !");
                }

                
            });    
            });
        }
        else {
            res.status(400).send("Username is required");
        }
    }
    catch (ex){       
        console.error(ex);
    }
});

app.post("/logout", async (req,res) => {
    const sessionId = req.cookies.SESSION_ID;
    if(sessionId) {
        pool.getConnection((err, connection) => {
            if(err) {
                console.error(err);
            }
            else
            {   
              const sql=`update user_session set sessionId = null where sessionId = '${sessionId}'`
              connection.query(sql, (err,rows) => {
                if(err) {
                    console.error(err);
                    res.send({"error" : err});
                }
                else {
                    res.send({"success": "logged out successfully"})
                }
              });
            }
        });  
    }
});

app.listen(port,() => {console.log(`Authentication server running at port ${port}`)});



// Function to Gneretae random string for session id
async function randomSessionId() {
    return crypto.randomBytes(64).toString('hex');
}


