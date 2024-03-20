const express = require("express");
const app = express();
const multer = require("multer");
const AWS = require("aws-sdk");
require("dotenv").config();
const path = require("path");

process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = "1";

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ASSETS_KEY_ID,
  secretAccessKey: process.env.SECRET_ASSETS_KEY,
});

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const bucketName = process.env.S3_BUCKET_NAME;
const tableName = process.env.DYNAMODB_TABLE_NAME;

app.use(express.static("./views"));
app.set("view engine", "ejs");
app.set("views", "./views");

const data = require("./data");
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage({
  destination(req, file, callback) {
    callback(null, "");
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2000000 },
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

function checkFileType(file, cb) {
  const fileTypes = /jpeg|jpg|png|gif/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  return cb("error");
}

app.get("/", async (req, res) => {
  try {
    const params = { TableName: tableName };
    const data = await dynamodb.scan(params).promise();
    console.log("data", data.Items);
    return res.render("index", { data: data.Items });
  } catch (error) {
    console.error("loi truy xuat", error);
    return res.status(500).send("sv error;");
  }
});

app.post("/save", upload.single("image"), (req, res) => {
  try {
    console.log(req.body);
    const maSanPham = Number(req.body.maSanPham);
    const tenSanPham = req.body.tenSanPham;
    const soLuong = Number(req.body.soLuong);

    const image = req?.file?.originalname.split(".");
    const fileTypes = image[image.length - 1];
    const filePath = `${maSanPham}_${Date.now().toString()}.${fileTypes}`;

    const paramsS3 = {
      Bucket: bucketName,
      Key: filePath,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };
    s3.upload(paramsS3, async (err, data) => {
      if (err) {
        console.log("error", err);
        return res.send("Internal server error");
      } else {
        const imageURL = data.Location;
        const paramsDynamoDb = {
          TableName: tableName,
          Item: {
            masp: Number(maSanPham),
            tenSanPham: tenSanPham,
            soLuong: soLuong,
            image: imageURL,
          },
        };
        await dynamodb.put(paramsDynamoDb).promise();
        return res.redirect("/");
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log("Server running on port:", +port);
});
