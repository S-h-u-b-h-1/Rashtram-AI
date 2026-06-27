const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: true,
    enum: ['user', 'assistant'],
  },
  timestamp: {
    type: String,
    required: true,
  },
  sources: [{
    type: mongoose.Schema.Types.Mixed,
  }],
  isError: {
    type: Boolean,
    default: false,
  },
}, { _id: true });

const BillChatSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  billTitle: {
    type: String,
    required: true,
  },
  billStatus: {
    type: String,
  },
  pdfUrl: {
    type: String,
  },
  summary: {
    type: String,
  },
  messages: [MessageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});


BillChatSchema.index({ userId: 1, billId: 1 });
BillChatSchema.index({ userId: 1, lastMessageAt: -1 });


BillChatSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.lastMessageAt = new Date();
  }
  next();
});


BillChatSchema.statics.findOrCreate = async function(userId, billData) {
  let chat = await this.findOne({
    userId,
    billId: billData.billId
  });

  if (!chat) {
    chat = new this({
      userId,
      billId: billData.billId,
      billTitle: billData.title,
      billStatus: billData.status,
      pdfUrl: billData.pdfUrl,
      summary: billData.summary || null,
      messages: [],
    });
    await chat.save();
  }

  return chat;
};


BillChatSchema.methods.addMessage = async function(messageData) {
  this.messages.push({
    text: messageData.text,
    sender: messageData.sender,
    timestamp: messageData.timestamp || new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    sources: messageData.sources || [],
    isError: messageData.isError || false,
  });

  this.lastMessageAt = new Date();
  await this.save();
  return this;
};


BillChatSchema.methods.updateSummary = async function(summary) {
  this.summary = summary;
  await this.save();
  return this;
};


BillChatSchema.statics.getUserRecentChats = async function(userId, limit = 10) {
  return this.find({
    userId,
    isActive: true
  })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .select('billId billTitle billStatus summary messages lastMessageAt createdAt')
    .lean();
};


BillChatSchema.statics.getChatByBill = async function(userId, billId) {
  return this.findOne({
    userId,
    billId,
    isActive: true
  }).lean();
};


BillChatSchema.methods.clearChat = async function() {
  this.messages = [];
  this.lastMessageAt = new Date();
  await this.save();
  return this;
};


BillChatSchema.methods.deactivate = async function() {
  this.isActive = false;
  await this.save();
  return this;
};

module.exports = mongoose.model('BillChat', BillChatSchema);
