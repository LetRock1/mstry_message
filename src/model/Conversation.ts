import mongoose, { Schema, Document } from 'mongoose';

export interface ThreadMessage {
  senderUsername: string;
  senderAlias: string;
  content: string;
  createdAt: Date;
}

export interface Conversation extends Document {
  participants: string[];
  messages: ThreadMessage[];
  updatedAt: Date;
}

const ThreadMessageSchema: Schema<ThreadMessage> = new Schema({
  senderUsername: { type: String, required: true },
  senderAlias: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ConversationSchema: Schema<Conversation> = new Schema({
  participants: [{ type: String, required: true }],
  messages: [ThreadMessageSchema],
  updatedAt: { type: Date, default: Date.now },
});

ConversationSchema.index({ participants: 1 });

const ConversationModel =
  (mongoose.models.Conversation as mongoose.Model<Conversation>) ||
  mongoose.model<Conversation>('Conversation', ConversationSchema);

export default ConversationModel;