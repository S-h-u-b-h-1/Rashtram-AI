const jwt = require("jsonwebtoken");
require('dotenv').config();

const getSecretKey = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  return process.env.JWT_SECRET;
};

const googleLoginController = async (req, res) => {
    try{
    const data = {
      user: {
        id: req.user._id,
      },
    };

    const token = jwt.sign(data, getSecretKey(), {
      expiresIn: '24h',
      issuer: 'rashtram-ai',
      audience: 'rashtram-ai-client'
    });








    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${clientUrl}/app?token=${encodeURIComponent(token)}`);
    }catch(error){
        console.error('Google Login error:', error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
module.exports = { googleLoginController };
