var express = require('express');
var router = express.Router();

var db = require('../lib/mysql');

/* GET home page. */
router.get('/', function (req, res, next) {
    var userId = req.cookies['userId'];

    if (userId) {
        // 现在也没有好友的概念，就查出所有的好了
        db.query({
            sql : 'SELECT * FROM pa_users u WHERE u.`pk_user_id` = ?',
            values : [userId],
            success : function (rs) {
                res.render('index', {
                    user : rs.length > 0 ? rs[0] : {}
                });
            },
            error : function () {
                res.render('index', {
                    user : {}
                });
            }
        });
    } else {
        res.render('index', {
            user : {}
        });
    }
});


router.get('/dologin', function (req, res, next) {
    var params = req.query;
    console.log(params);
    var model = {};
    if (!(!!params.userName && !!params.passWord)) {
        return {
            flag : 0
        }
    }
    db.query({
        sql : 'SELECT * FROM pa_users u WHERE u.`user_name` = ?',
        values : [params.userName],
        success : function (rs) {
            if (rs && rs.length > 0) {
                db.query({
                    sql : 'SELECT * FROM pa_users u WHERE u.`user_name` = ? AND u.`user_password` = ?',
                    values : [params.userName, params.passWord],
                    success : function (rs) {
                        if (rs && rs.length > 0) {
                            // 塞cookie
                            res.cookie('userId', rs[0].pk_user_id, {maxAge : 18000000});
                            res.cookie('nickName', rs[0].nick_name, {maxAge : 18000000});
                            model = rs[0];
                            model.flag = 1;
                        } else {
                            model.flag = 0;
                            model.reason = '用户名已存在，密码错误';
                        }
                        res.send(model);
                    },
                    error : function () {
                        res.send({
                            flag : 0
                        });
                    }
                });
            } else {
                db.insert({
                    sql : 'insert into pa_users (user_name, user_password, nick_name) values (?,?,?)',
                    values : [params.userName, params.passWord, params.userName],
                    success : function (insertId) {
                        if (insertId) {
                            db.query({
                                sql : 'SELECT * FROM pa_users u WHERE u.`pk_user_id` = ?',
                                values : [insertId],
                                success : function (rs) {
                                    if (rs && rs.length > 0) {
                                        // 塞cookie
                                        res.cookie('userId', rs[0].pk_user_id, {maxAge : 18000000});
                                        res.cookie('nickName', rs[0].nick_name, {maxAge : 18000000});
                                        model = rs[0];
                                        model.flag = 1;
                                    } else {
                                        model.flag = 0;
                                        model.reason = '用户名不存在，为你注册成功，获取信息失败';
                                    }
                                    res.send(model);
                                }
                            });
                        } else {
                            // 注册失败
                            model.flag = 0;
                            model.reason = '用户名不存在，为你注册失败';
                            res.send(model);
                        }
                    }
                });
            }
        }
    });

});

router.get('/queryUserList', function (req, res, next) {
    var userId = req.cookies['userId'];
    if (userId) {
        // 现在也没有好友的概念，就查出所有的好了
        db.query({
            sql : 'SELECT * FROM pa_users u ',
            values : [userId],
            success : function (rs) {
                res.send({
                    user : rs
                });
            },
            error : function () {
                res.send({
                    user : {}
                });
            }
        });
    } else {
        res.send({
            user : {}
        });
    }
});

module.exports = router;
