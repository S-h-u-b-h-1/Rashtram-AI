const express = require("express");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const fetchuser = require("../middleware/fetchuser");
require('dotenv').config();
const SecretKey = process.env.JWT_SECRET || "IssueWithJWTSecretKey";

const LoginController = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {

    const sanitizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const data = {
      user: {
        id: user._id,
      },
    };


    let authToken = jwt.sign(data, SecretKey, {
      expiresIn: '24h',
      issuer: 'rashtram-ai',
      audience: 'rashtram-ai-client'
    });

    res.status(200).json({
      authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const RegisterController = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  try {

    const sanitizedName = name.trim();
    const sanitizedEmail = email.toLowerCase().trim();


    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" });
    }


    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
    });

    const data = {
      user: {
        id: user._id,
      },
    };


    let authToken = jwt.sign(data, SecretKey, {
      expiresIn: '24h',
      issuer: 'rashtram-ai',
      audience: 'rashtram-ai-client'
    });

    res.status(201).json({
      authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: "User already exists with this email" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
const getUserController = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("-password");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = { LoginController, RegisterController, getUserController };
