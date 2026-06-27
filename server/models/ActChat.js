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

const ActChatSchema = new mongoose.Schema({
  actId: {
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
  actTitle: {
    type: String,
    required: true,
  },
  actStatus: {
    type: String,
  },
  pdfUrl: {
    type: String,
  },
  summary: {
    type: String,
  },
  messages: [MessageSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});


ActChatSchema.index({ userId: 1, actId: 1, isActive: 1 });


ActChatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});


ActChatSchema.statics.findOrCreate = async function(userId, actData) {
  const { actId, title, status, pdfUrl, summary } = actData;

  let chat = await this.findOne({ userId, actId, isActive: true });

  if (!chat) {
    chat = await this.create({
      userId,
      actId,
      actTitle: title,
      actStatus: status,
      pdfUrl,
      summary,
      messages: [],
    });
  } else {

    if (title) chat.actTitle = title;
    if (status) chat.actStatus = status;
    if (pdfUrl) chat.pdfUrl = pdfUrl;
    if (summary) chat.summary = summary;
    await chat.save();
  }

  return chat;
};


ActChatSchema.statics.getChatByAct = async function(userId, actId) {
  return this.findOne({ userId, actId, isActive: true });
};


ActChatSchema.statics.getUserRecentChats = async function(userId, limit = 10) {
  return this.find({ userId, isActive: true })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('-messages');
};


ActChatSchema.methods.addMessage = async function(messageData) {
  this.messages.push(messageData);
  await this.save();
  return this;
};


ActChatSchema.methods.updateSummary = async function(summary) {
  this.summary = summary;
  await this.save();
  return this;
};


ActChatSchema.methods.clearChat = async function() {
  this.messages = [];
  await this.save();
  return this;
};


ActChatSchema.methods.deactivate = async function() {
  this.isActive = false;
  await this.save();
  return this;
};

const ActChat = mongoose.model('ActChat', ActChatSchema);

module.exports = ActChat;
