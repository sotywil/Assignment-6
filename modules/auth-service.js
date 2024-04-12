require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

let Schema = mongoose.Schema;

const userSchema = new Schema({
    userName: {
        type: String,
        unique: true,
    },
    password: String,
    email: String,
    loginHistory: [{
        dateTime: Date,
        userAgent: String
    }]
});

let User;

initialize = function () {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(process.env.MONGODB);

        db.on('error', (err) => {
            reject(err);
        });
        db.once('open', () => {
            User = db.model('users', userSchema);
            resolve();
        });
    });
};

registerUser = function (userData) {
    return new Promise((resolve, reject) => {
        if (userData.password != userData.password2) {
            reject(new Error("Passwords do not match"));
        }

        bcrypt.hash(userData.password, 10).then(hash => {
            userData.password = hash;

            let newUser = new User(userData);
            newUser.save().then(() => {
                resolve();
            })
                .catch(err => {
                    if (err.code == 11000) {
                        reject(new Error("User Name already taken"));
                    }
                    else {
                        reject(new Error(`There was an error creating the user: ${err}`));
                    }
                });
        })
            .catch(err => {
                reject(new Error(`There was an error hashing the password: ${err}`));
            });
    });
}

checkUser = function (userData) {
    return new Promise((resolve, reject) => {
        User.find({ userName: userData.userName }).exec()
            .then((users) => {
                if (users.length == 0) {
                    reject(new Error(`Unable to find user: ${userData.userName}`));
                }

                bcrypt.compare(userData.password, users[0].password).then((result) => {
                    if (result === false) {
                        reject(new Error(`Incorrect Password for user: ${userData.userName}`));
                    }
                });

                if (users[0].loginHistory.length == 8) {
                    users[0].loginHistory.pop();
                }
                users[0].loginHistory.unshift({ dateTime: (new Date()).toString(), userAgent: userData.userAgent });
                User.updateOne({ userName: users[0].userName }, { $set: { loginHistory: users[0].loginHistory } }).exec()
                    .then(() => {
                        resolve(users[0]);
                    })
                    .catch(err => {
                        reject(new Error(`There was an error verifying the user: ${err}`));
                    });
            })
            .catch(err => {
                reject(new Error(`Unable to find user: ${userData.userName}`));
            });
    });
}

module.exports = {
    initialize,
    registerUser,
    checkUser
};