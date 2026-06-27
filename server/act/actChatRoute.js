const express = require('express');
const ActChat = require('../models/ActChat');
const fetchuser = require('../middleware/fetchuser');

const router = express.Router();


router.post('/get-or-create', fetchuser, async (req, res) => {
  try {
    const { actId, title, status, pdfUrl, summary } = req.body;
    const userId = req.user.id;

    if (!actId || !title) {
      return res.status(400).json({ error: 'Act ID and title are required' });
    }

    const chat = await ActChat.findOrCreate(userId, {
      actId,
      title,
      status,
      pdfUrl,
      summary,
    });

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Error getting or creating act chat:', error);
    res.status(500).json({
      error: 'Failed to get or create chat',
      message: error.message,
    });
  }
});


router.get('/:actId', fetchuser, async (req, res) => {
  try {
    const { actId } = req.params;
    const userId = req.user.id;

    const chat = await ActChat.getChatByAct(userId, actId);

    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found',
        chat: null,
      });
    }

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Error getting act chat:', error);
    res.status(500).json({
      error: 'Failed to get chat',
      message: error.message,
    });
  }
});


router.post('/:actId/message', fetchuser, async (req, res) => {
  try {
    const { actId } = req.params;
    const { text, sender, timestamp, sources, isError } = req.body;
    const userId = req.user.id;

    if (!text || !sender) {
      return res.status(400).json({ error: 'Message text and sender are required' });
    }

    let chat = await ActChat.findOne({ userId, actId, isActive: true });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await chat.addMessage({
      text,
      sender,
      timestamp,
      sources,
      isError,
    });

    res.json({
      success: true,
      message: 'Message added successfully',
      chat,
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      error: 'Failed to add message',
      message: error.message,
    });
  }
});


router.patch('/:actId/summary', fetchuser, async (req, res) => {
  try {
    const { actId } = req.params;
    const { summary } = req.body;
    const userId = req.user.id;

    if (!summary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    let chat = await ActChat.findOne({ userId, actId, isActive: true });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await chat.updateSummary(summary);

    res.json({
      success: true,
      message: 'Summary updated successfully',
      summary: chat.summary,
    });
  } catch (error) {
    console.error('Error updating summary:', error);
    res.status(500).json({
      error: 'Failed to update summary',
      message: error.message,
    });
  }
});


router.get('/user/recent', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const chats = await ActChat.getUserRecentChats(userId, limit);

    res.json({
      success: true,
      chats,
      count: chats.length,
    });
  } catch (error) {
    console.error('Error getting recent chats:', error);
    res.status(500).json({
      error: 'Failed to get recent chats',
      message: error.message,
    });
  }
});


router.delete('/:actId/messages', fetchuser, async (req, res) => {
  try {
    const { actId } = req.params;
    const userId = req.user.id;

    let chat = await ActChat.findOne({ userId, actId, isActive: true });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await chat.clearChat();

    res.json({
      success: true,
      message: 'Chat messages cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({
      error: 'Failed to clear chat',
      message: error.message,
    });
  }
});


router.delete('/:actId', fetchuser, async (req, res) => {
  try {
    const { actId } = req.params;
    const userId = req.user.id;

    let chat = await ActChat.findOne({ userId, actId, isActive: true });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await chat.deactivate();

    res.json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({
      error: 'Failed to delete chat',
      message: error.message,
    });
  }
});

module.exports = router;
