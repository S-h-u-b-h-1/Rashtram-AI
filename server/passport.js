const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const passport = require('passport');
const User = require('./models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, cb) => {
    try {
      const user = await User.findOrCreateGoogleUser({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos?.[0]?.value || null,
      });
      return cb(null, user);
    } catch (err) {
      return cb(err);
    }
  }
));
