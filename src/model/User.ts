import mongoose,{Schema,Document} from "mongoose";

export interface Message {
  _id?: string;
  content: string;
  createdAt?: Date;
  conversationId: string;
  sender: string;
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
    required: true,
  },
  sender: {
    type: String, // "anonymous" OR username
    required: true,
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
}

const UserSchema: Schema<User> = new Schema({
  username: {
    type: String,
    required: [true,"Username is required"],
    trim:true,
    unique:true
  },
  email: {
    type: String,
    required: [true,"Username is required"],
    unique:true,
    match: [/.+\@.+\..+/, "please use a valid email address"]
  },

   password: {
    type: String,
    required: [true,"Password is required"],
},
 verifyCode: {
    type: String,
    required: [true,"Verify is required"],},

    verifyCodeExpiry: {
    type: Date,
    required: [true,"Username is required"],},

isVerified: {
    type: Boolean,
    default:false},

isAcceptingMessage:{
    type:Boolean,
    default:true,
}
,
messages:[MessageSchema]
}
);


const UserModel=(mongoose.models.User as mongoose.Model<User>)|| mongoose.model<User>("User",UserSchema)

export default UserModel;


