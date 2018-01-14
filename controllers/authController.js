const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const crypto = require('crypto');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Failed to Login!',
    successRedirect: '/',
    successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
    req.logout();
    req.flash('success', 'You are now logged out');
    res.redirect('/quests');
};

exports.isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated()) {
        next();
        return;
    }
    req.flash('error', 'You must be logged in to do that');
    res.redirect('/login');
}

exports.isCreativeOrAdmin = (req, res, next) => {
    if(req.user.admin > 2) {
        next();
        return;
    }
    req.flash('info', 'You don\'t have premissions to add new quests');
    res.redirect('back');
}

exports.forgot = async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if(!user) {
        req.flash('error', `No account with ${req.body.email} exists`);
        return res.redirect('back');
    }
    
    user.resetPasswordToken = crypto.randomBytes(29).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();
    
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
    await mail.send({
        user,
        subject: 'Password Reset',
        resetURL,
        filename: 'password-reset'
    });
    req.flash('success', `You have been email a password reset link.`);
    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if(!user) {
        req.flash('error', 'Password reset is invaldi or has expired');
        return res.redirect('/login');
    }
    res.render('reset', {title: 'Reset you password'});
};

exports.confirmedPassords = (req, res, next) => {
    if(req.body.password === req.body['password-confirm']) {
        next();
        return;
    }
    req.flash('error', 'Password do not match');
    res.redirect('back');
};

exports.update = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if(!user) {
        req.flash('error', `No account with ${req.body.email} exists`);
        return res.redirect('/login');
    }

    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    const updatedUser = await user.save();
    await req.login(updatedUser);
    req.flash('success', 'Password has been reset, and out are not logged in!');
    res.redirect('/');
};