/**
 * Created by Administrator on 2016/8/31.
 */
var express = require('express');
var router = express.Router();

var qiniu = require('qiniu');

qiniu.conf.ACCESS_KEY = 'sNio9fL2_ZmozIvuUGaa2nv_1V86Rzy9ZR4NW8fO';
qiniu.conf.SECRET_KEY = 'hXlIur11OXBj4U6fKJR5RmzAmpaMNZAm8l5S9LRC';

var BUCKET = 'bucket-papa';

//构建上传策略函数
function uptoken(bucket, key) {
    var putPolicy = new qiniu.rs.PutPolicy(bucket+":"+key);
    return putPolicy.token();
}

//构造上传函数
function uploadFile(uptoken, key, localFile) {
    var extra = new qiniu.io.PutExtra();
    qiniu.io.putFile(uptoken, key, localFile, extra, function(err, ret) {
        if(!err) {
            // 上传成功， 处理返回值
            console.log(ret.hash, ret.key, ret.persistentId);
        } else {
            // 上传失败， 处理返回代码
            console.log(err);
        }
    });
}