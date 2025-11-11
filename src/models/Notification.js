import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    user : { type : mongoose.Schema.Types.ObjectId , ref : "User" , required : true , index : true },
    title : { type : String , required : true  },
    Message : { type : String },
    link : { type : String ,},
    data : { type : mongoose.Schema.Types.Mixed  },
    isRead : { type : Boolean , default : false },
    createdAt : { type : Date , default : Date.now },
    updatedAt : { type : Date , default : Date.now },
});

export default mongoose.models.Notification || mongoose.model("Notification" , notificationSchema);
