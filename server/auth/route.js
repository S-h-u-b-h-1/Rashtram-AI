const express = require("express");
const router = express.Router();
const { LoginController, RegisterController, getUserController } = require("./controller");
const { body } = require("express-validator");
const fetchuser = require("../middleware/fetchuser");
const {googleLoginController} = require("./googleController");
const passport = require('passport');
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .withMessage("Invalid email")
      .isLength({ max: 100 })
      .withMessage("Email must be less than 100 characters")
      .customSanitizer(value => value.toLowerCase().trim()),
    body("password")
      .isLength({ min: 1, max: 128 })
      .withMessage("Password is required and must be less than 128 characters"),
  ],
  LoginController
);
router.post(
  "/register",
  [
    body("name")
      .isLength({ min: 3, max: 50 })
      .withMessage("Name must be between 3 and 50 characters long")
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage("Name can only contain letters and spaces"),

    body("email")
      .isEmail()
      .withMessage("Invalid email")
      .isLength({ max: 100 })
      .withMessage("Email must be less than 100 characters")
      .customSanitizer(value => value.toLowerCase().trim()),

    body("password")
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be between 8 and 128 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  ],
  RegisterController
);

router.post('/getuser', fetchuser, getUserController);
router.get('/google',passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }), googleLoginController);

module.exports = router;
