import mongoose, { Schema, Document } from "mongoose";

export interface Message {
  _id?: string;
  content: string;
  createdAt?: Date;
  conversationId?: string;
  sender: string;
  recipientUsername?: string;   // for sender's copy ("me")
  senderUsername?: string;      // 🔥 NEW: real sender’s username (for recipient’s anonymous copy)
}

const MessageSchema: Schema = new Schema({
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  conversationId: {
    type: String,
    required: false,
  },
  sender: {
    type: String,
    default: "guest",
    required: true,
  },
  recipientUsername: {
    type: String,
    required: false,
  },
  senderUsername: {              // 🔥 NEW
    type: String,
    required: false,
  },
});

export interface User extends Document {
  username: string;
  email: string;
  password: string;
  verifyCode: string;
  verifyCodeExpiry: Date;
  isVerified: boolean;
  isAcceptingMessage: boolean;
  messages: Message[];
  blockedUsers: string[];
}

const UserSchema: Schema<User> = new Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    trim: true,
    unique: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    match: [/.+\@.+\..+/, "Please use a valid email address"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  verifyCode: {
    type: String,
    required: [true, "Verify code is required"],
  },
  verifyCodeExpiry: {
    type: Date,
    required: [true, "Verify code expiry is required"],
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isAcceptingMessage: {
    type: Boolean,
    default: true,
  },
  messages: [MessageSchema],
  blockedUsers: {
    type: [String],
    default: [],
  },
});

const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ||
  mongoose.model<User>("User", UserSchema);

export default UserModel;