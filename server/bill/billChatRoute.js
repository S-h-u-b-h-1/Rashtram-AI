const express = require('express');
const BillChat = require('../models/BillChat');
const fetchuser = require('../middleware/fetchuser');

const router = express.Router();


router.post('/get-or-create', fetchuser, async (req, res) => {
  try {
    const { billId, title, status, pdfUrl, summary } = req.body;
    const userId = req.user.id;

    if (!billId || !title) {
      return res.status(400).json({ error: 'Bill ID and title are required' });
    }

    const chat = await BillChat.findOrCreate(userId, {
      billId,
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
    console.error('Error getting or creating bill chat:', error);
    res.status(500).json({
      error: 'Failed to get or create chat',
      message: error.message,
    });
  }
});


router.get('/:billId', fetchuser, async (req, res) => {
  try {
    const { billId } = req.params;
    const userId = req.user.id;

    const chat = await BillChat.getChatByBill(userId, billId);

    if (!chat) {
      return res.json({
        success: true,
        chat: null,
      });
    }

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Error getting bill chat:', error);
    res.status(500).json({
      error: 'Failed to get chat',
      message: error.message,
    });
  }
});


router.post('/:billId/message', fetchuser, async (req, res) => {
  try {
    const { billId } = req.params;
    const { text, sender, timestamp, sources, isError } = req.body;
    const userId = req.user.id;

    if (!text || !sender) {
      return res.status(400).json({ error: 'Message text and sender are required' });
    }

    let chat = await BillChat.findOne({ userId, billId, isActive: true });

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


router.patch('/:billId/summary', fetchuser, async (req, res) => {
  try {
    const { billId } = req.params;
    const { summary } = req.body;
    const userId = req.user.id;

    if (!summary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    let chat = await BillChat.findOne({ userId, billId, isActive: true });

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

    const chats = await BillChat.getUserRecentChats(userId, limit);

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


router.delete('/:billId/messages', fetchuser, async (req, res) => {
  try {
    const { billId } = req.params;
    const userId = req.user.id;

    let chat = await BillChat.findOne({ userId, billId, isActive: true });

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


router.delete('/:billId', fetchuser, async (req, res) => {
  try {
    const { billId } = req.params;
    const userId = req.user.id;

    let chat = await BillChat.findOne({ userId, billId, isActive: true });

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
