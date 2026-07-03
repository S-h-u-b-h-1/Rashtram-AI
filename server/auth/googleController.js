const { createSessionToken } = require("./sessionService");
require('dotenv').config();

const googleLoginController = async (req, res) => {
    try{
    const token = await createSessionToken(req.user._id, req);








    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${clientUrl}/app?token=${encodeURIComponent(token)}`);
    }catch(error){
        console.error('Google Login error:', error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
module.exports = { googleLoginController };
