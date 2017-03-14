/**
 * DBTOOL
 */
var mysql = require('mysql');

// 首先创建了一个连接池
var pool = mysql.createPool({
    host : '139.196.23.103',
    user : 'papa',
    password : 'papa',
    database : 'papa'
});

function dealSql(type, params) {
    pool.getConnection(function (err, conn) {
        if (err) {
            console.log('[Connection Error]: ' + err);
            return;
        }

        var sql = params.sql, /* 传一个字符串咯 */
            values = params.values, /* 一个数组，对应问号*/
            success = params.success,
            error = params.error;

        conn.query(sql, values, function (err, result, filed) {
            conn.release();
            if (err) {
                error && error(err);
                var errInfo = '';
                if (type === 1) {
                    errInfo = '[Query Error]: ' + err;
                } else if (type === 2) {
                    errInfo = '[Insert Error]: ' + err;
                } else if (type === 3) {
                    errInfo = '[Update Error]: ' + err;
                } else {
                    errInfo = '[Delete Error]: ' + err;
                }
                console.log(errInfo);
            } else {
                var returnValue = '';
                if (type === 1) {
                    returnValue = result;
                } else if (type === 2) {
                    returnValue = result.insertId;
                } else {
                    returnValue = result.affectedRows;
                }
                success && success(returnValue);
            }
        });
    });
}

var db = {
    query : function(params) {
        dealSql(1, params);
    },
    insert : function(params) {
        dealSql(2, params);
    },
    update : function(params) {
        dealSql(3, params);
    },
    delete : function(params) {
        dealSql(4, params);
    }
};

module.exports = db;