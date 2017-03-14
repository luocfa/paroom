/**
 * 聊天室通用
 * @param io
 */
var chatRoom = function (io) {

    var db = require('./mysql');
    var parseCookie = require('cookie-parser')();
    var su = new (require('./socketUtil'))(io);

    var onlineUsers = {},
        onlineRoom = 'papaRoom';

    /**
     * 权限认证（其实就看看cookie有没有值）
     */
    io.use(function (socket, next) {
        parseCookie(socket.request, null, function (err) {
            if (err) {
                return next(new Error('cookie err'));
            }
            var userId = socket.request.cookies['userId'];
            var nickName = socket.request.cookies['nickName'];
            // 你走，你已经登录了
            if (onlineUsers[userId]) {
                return next(new Error('repeat login err'));
            }

            if (userId) {
                socket.userId = userId;
                socket.nickName = nickName;
                db.query({
                    sql : 'SELECT * FROM pa_users u WHERE u.`pk_user_id` = ?',
                    values : [userId],
                    success : function (rs) {
                        if (rs && rs.length > 0) {
                            socket.user = rs[0];
                            next();
                        } else {
                            return next(new Error('userId err'));
                        }
                    },
                    error : function () {
                        return next(new Error('userId err'));
                    }
                });
            } else {
                return next(new Error('no login'));
            }
        });

    });

    var gameData = {
            flag : 0,
            wdUserId : '',
            zcUserId : '',
            wdWord : '',
            pmWord : ''
        },
        roundData = {
            waitDescUsers : [],
            waitVoteUsers : [],
            hasDescedUsers : [],
            descedContent : {},
            hasVotedUsers : [],
            votedUsers : {},
            descId : '',
            round : 0
        },
        numGame = {
            gameFlag : !1,
            randomNum : -1,
            startNum : -1,
            endNum : -1,
            speakIndex : -1,
            playerList : []
        };

    io.on('connection', function (socket) {
        var userId = socket.userId,
            nickName = socket.nickName,
            userInfo = socket.user;

        if (!userId) {
            console.log('no login');
            return;
        }

        // 你走，你已经登录了
        if (onlineUsers[userId]) {
            return;
        }

        // 加入上线人员列表
        onlineUsers[userId] = {
            userId : userId,
            socketId : socket.id,
            nickName : nickName,
            userName : userInfo.user_name,
            style : userInfo.style,
            headImg : userInfo.headImg,
            type : onlineUsers[userId] && onlineUsers[userId].type || userInfo.user_type_id, // 2. 主持， 1，普通，3， 死亡
            descFlag : 0 // 1, 待描述不能投票 2，不能描述能投票
        };

        // 加入在线人员房间
        socket.join(onlineRoom);

        // 告诉用户连接成功了
        su.emitBack(socket, {
            action : 'connection',
            data : {
                userId : userId,
                flag : '1'
            }
        });
        // 告诉其他用户某人登录了，并且告诉他当前在线人员列表
        su.emitToRoomAll({
            action : 'notice',
            data : {
                // msg : '叮铃铃, ' + nickName + '上线了',
                onlineUsers : onlineUsers,
                startFlag : gameData.flag,
                readyToVote : gameData.readyToVote

            }
        });

        console.log(onlineUsers);

        if (gameData.flag == 1) {
        }

        // 掉线的话
        socket.on('disconnect', function () {

            // 从在线列表中删除
            delete onlineUsers[userId];
            // 踢出房间
            socket.leave(onlineRoom, null);

            // 告诉其他用户某人离开了，并更新列表
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    // msg : '叮铃铃, ' + nickName + '下线了',
                    onlineUsers : onlineUsers
                }
            });
        });

        socket.on('NumGameStart', function(rs) {
            numGame.playerList = [];
            for (var id in onlineUsers) {
                if (id != rs.zcUserId) {
                    var obj = {
                        userId : id,
                        nickName : onlineUsers[id].nickName
                    };
                    numGame.playerList.push(obj);
                    onlineUsers[id].type = 1;
                }
            }
            numGame.gameFlag = !0;
            numGame.startNum = rs.startNum;
            numGame.endNum = rs.endNum;
            var randomNum = getRandomNum(+rs.startNum+1, +rs.endNum-1);
            numGame.randomNum = randomNum;
            su.emitToPerson({
                action : 'randomNum',
                userId : onlineUsers[rs.zcUserId].socketId,
                data : {
                    randomNum : randomNum
                }
            });
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : '随机数已生成！数字范围('+ rs.startNum + '-' + rs.endNum +')，输入“/n 数字”来提交你的数字！'
                }
            });
            var user = {};
            do {
                user = numGame.playerList[++numGame.speakIndex];
            } while (user == null);
            console.log('第一个说话的人的id: ' + user.userId);
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : '首先是 ' + user.nickName + ' 输入你的数字！'
                }
            });
        });

        /**
         * 基本的聊天功能
         */
        socket.on('chatMsg', function (rs) {

            console.log(rs);

            var msg = rs.msg;
            if (numGame.gameFlag) {
                var user = numGame.playerList[numGame.speakIndex];
                var num = -1;
                var rv = msg.match(/^\/n ([0-9]+)$/);
                if (rv && rv.length > 1) {
                    console.log('当前说话的人的id: ' + rs.userId);
                    if (rs.userId != user.userId) {
                        console.log('还没有轮到你：' + onlineUsers[rs.userId].nickName);
                        su.emitToPerson({
                            action : 'notice',
                            userId : onlineUsers[rs.userId].socketId,
                            data : {
                                msg : '还没轮到你输入数字！'
                            }
                        });
                        return;
                    }

                    num = parseInt(rv[1], 10);
                    console.log('当前说话的人的num:' + num);
                    console.log('numGame.startNum:' + numGame.startNum);
                    console.log('numGame.endNum:' + numGame.endNum);
                    if ((num == -1) || (num <= numGame.startNum) || (num >= numGame.endNum)) {
                        su.emitToPerson({
                            action : 'notice',
                            userId : onlineUsers[rs.userId].socketId,
                            data : {
                                msg : '输入的数字不合法！'
                            }
                        });
                    } else {

                        do {
                            numGame.speakIndex++;
                            if (numGame.speakIndex >= numGame.playerList.length) {
                                numGame.speakIndex = 0;
                            }
                            user = numGame.playerList[numGame.speakIndex];
                        } while (user == null);

                        if (num != numGame.randomNum) {
                            if (num > numGame.randomNum) {
                                numGame.endNum = num;
                            } else {
                                numGame.startNum = num;
                            }
                            su.emitToRoomAll({
                                action : 'notice',
                                data : {
                                    msg : '新的数字范围(' + numGame.startNum + '-' + numGame.endNum + ')；下一个：' + user.nickName
                                }
                            });

                        } else {
                            numGame.gameFlag = !1;
                            su.emitToRoomAll({
                                action : 'notice',
                                data : {
                                    msg : 'Boom！！！  游戏结束！恭喜' + onlineUsers[rs.userId].nickName + '又中了一箭！爆炸数字：' + numGame.randomNum
                                }
                            });
                        }
                    }
                    return;
                }
            }

            su.emitToRoom(socket, {
                action : 'chatMsg',
                data : {
                    userId : rs.userId,
                    nickName : onlineUsers[rs.userId].nickName,
                    style : onlineUsers[rs.userId].style,
                    headImg : onlineUsers[rs.userId].headImg,
                    msg : rs.msg
                }
            });


            // 游戏过程中，要收集用户的第一句发言
            if (gameData.descFlag == 1) {

                if (roundData.waitDescUsers.length != roundData.hasDescedUsers.length) {
                    //
                    if (userId == roundData.descId && roundData.hasDescedUsers.indexOf(userId) == -1) {
                        roundData.hasDescedUsers.push(userId);
                        roundData.descedContent[userId] = rs.msg;

                        if (roundData.waitDescUsers.length != roundData.hasDescedUsers.length) {
                            getDescId();
                            su.emitToRoomAll({
                                action : 'notice',
                                data : {
                                    msg : '该' + onlineUsers[roundData.descId].nickName + '发言了！',
                                }
                            });
                        } else {
                            descDone();
                        }

                    }
                } else {// 发言完了
                    descDone();
                }

            }
        });

        function descDone() {
            gameData.descFlag = 0;
            gameData.readyToVote = 1;
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : '发言完毕，请根据以下发言内容进行投票',
                    readyToVote : gameData.readyToVote
                }
            });
            // 显示出刚才的发言内容
            var str = '';
            for (var id in roundData.descedContent) {
                str += '<p>' + onlineUsers[id].nickName + ': ' + roundData.descedContent[id] + '</p>';
            }
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    type : 1,
                    msg : str
                }
            });
        }

        /**
         * 游戏开始
         */
        socket.on('gameStart', function (rs) {

            if (userInfo.user_type_id != 2) {
                return;
            }


            // 把出了主持之外的人，都放到一个列表里
            for (var id in onlineUsers) {
                if (id != rs.zcUserId) {
                    roundData.waitDescUsers.push(id);
                    roundData.waitVoteUsers = roundData.waitDescUsers;
                    onlineUsers[id].type = 1;
                }
            }

            console.log(roundData.waitDescUsers);

            var num = getRandomNum(0, roundData.waitDescUsers.length - 1);
            var wdUserId = roundData.waitDescUsers[num];

            console.log(wdUserId);

            su.emitToPerson({
                action : 'gameWord',
                userId : onlineUsers[rs.zcUserId].socketId,
                data : {
                    wdName : onlineUsers[wdUserId].nickName
                }
            });

            gameData = rs;
            gameData.wdUserId = wdUserId;
            gameData.flag = 1;

            // 告诉卧底，你的词是啥
            su.emitToPerson({
                action : 'gameWord',
                userId : onlineUsers[wdUserId].socketId,
                data : {
                    word : rs.wdWord
                }
            });

            // 给平民发词
            for (var id in onlineUsers) {
                if (id != rs.zcUserId && id != wdUserId) {
                    // 平民
                    su.emitToPerson({
                        action : 'gameWord',
                        userId : onlineUsers[id].socketId,
                        data : {
                            word : rs.pmWord
                        }
                    });
                }
            }

            // 告诉所有人
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : '词语派发完毕，请做好准备，等待主持宣布开始发言！（看到开始提示后，你的第一句话将会成为你的描述内容）',
                    startFlag : gameData.flag
                }
            })
        });

        /**
         * 开始发言
         */
        socket.on('describe', function (rs) {

            startDesc(rs);

        });

        function startDesc(rs) {

            gameData.descFlag = 1;

            var arr1 = [];
            var arr2 = [];
            for (var id in onlineUsers) {
                if (onlineUsers[id].descFlag == 1) {
                    arr1.push(id);
                } else if (onlineUsers[id].descFlag == 2) {
                    arr2.push(id);
                }
                onlineUsers[id].descFlag = 0;
            }

            arr1.length == 0 && (arr1 = roundData.waitDescUsers);
            arr2.length == 0 && (arr2 = roundData.waitVoteUsers);

            // 初始化一下
            roundData = {
                waitDescUsers : arr1,
                waitVoteUsers : arr2,
                descedContent : {},
                hasDescedUsers : [],
                hasVotedUsers : [],
                votedUsers : {},
                descId : '',
                round : roundData.round
            };

            // if (rs.flag == 1) {
            //     roundData.descedContent = {};
            // }

            var num = getRandomNum(0, roundData.waitDescUsers.length - 1);
            var descId = roundData.waitDescUsers[num];

            roundData.descId = descId;

            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : onlineUsers[descId].nickName + '开始发言！！！'
                }
            });
        }

        // 投票咯
        socket.on('vote', function (rs) {


            // 主持人点的话
            // if (userInfo.user_type_id == 2) {
            //     outSomeOne(rs);
            //     return;
            // }

            var votedId = rs.votedId;
            // 首先，投票人必须在可发言的人直接
            if (roundData.waitVoteUsers.indexOf(userId) == -1) {
                console.log('投票人不对！');
                return;
            }
            // 每个人只能投一次
            if (roundData.hasVotedUsers.indexOf(userId) > -1) {
                console.log('这货已经投过了');
                return;
            }
            //
            if (roundData.waitDescUsers.indexOf(votedId) == -1) {
                console.log('你投的人都不在列表中');
                return;
            }

            roundData.hasVotedUsers.push(userId);
            var num = roundData.votedUsers[votedId];
            roundData.votedUsers[votedId] = num ? ++num : 1;

            // 告诉所有人，你投过了
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : onlineUsers[userId].nickName + '已经完成投票！！！'
                }
            });

            // 都投过票了
            if (roundData.hasVotedUsers.length === roundData.waitDescUsers.length) {
                var str = '';
                for (var id in roundData.votedUsers) {
                    str += onlineUsers[id].nickName + ': ' + roundData.votedUsers[id] + '票； '
                }
                // 告诉所有人投票结果
                su.emitToRoomAll({
                    action : 'notice',
                    data : {
                        msg : str
                    }
                });

                // 统计一下投票结果
                var max = 0;
                for (var id in roundData.votedUsers) {
                    if (max < roundData.votedUsers[id]) {
                        max = roundData.votedUsers[id];
                    }
                }
                var newDescUserIds = [];
                for (var id in roundData.votedUsers) {
                    if (max == roundData.votedUsers[id]) {
                        newDescUserIds.push(id);
                    }
                }

                if (newDescUserIds.length == 1) {
                    // 就一个，那么out吧
                    outSomeOne({votedId : newDescUserIds[0]});
                } else {
                    // 两个人以上投票数相投

                    // 如果所有人，一人一票，那重新开始吧
                    if (newDescUserIds.length != roundData.waitDescUsers.length) {
                        for (var id in onlineUsers) {
                            if (onlineUsers[id].type == 1) {
                                if (newDescUserIds.indexOf(id) > -1) {
                                    onlineUsers[id].descFlag = 1;
                                } else {
                                    onlineUsers[id].descFlag = 2;
                                }
                            }
                        }
                    }
                    startDesc();
                }
            }

        });

        function outSomeOne(rs) {
            var outId = rs.votedId;
            var index = roundData.waitDescUsers.indexOf(outId);
            // 从数组里把人删掉
            index > -1 && roundData.waitDescUsers.splice(index, 1);

            onlineUsers[outId].type = 3;

            getDescId();
            gameData.readyToVote = 0;
            su.emitToRoomAll({
                action : 'notice',
                data : {
                    msg : onlineUsers[outId].nickName + 'out!!!',
                    onlineUsers : onlineUsers,
                    startFlag : gameData.flag,
                    readyToVote : gameData.readyToVote
                }
            });

            // 下面判断游戏是否结束
            if (outId === gameData.wdUserId) {
                // 游戏结束，卧底失败
                su.emitToRoomAll({
                    action : 'notice',
                    data : {
                        msg : '游戏结束！！！哈哈哈哈！！！ 卧底  ' + onlineUsers[outId].nickName + '不行了啊，要学会隐藏啊小朋友！'
                    }
                });
                su.emitToRoomAll({
                    action : 'notice',
                    data : {
                        msg : '卧底的词：' + gameData.wdWord + ',,平民的词：' + gameData.pmWord,
                        startFlag : 0
                    }
                });
                clearData();
            } else if (roundData.waitDescUsers.length <= 2) {
                // 游戏结束，卧底胜利
                su.emitToRoomAll({
                    action : 'notice',
                    data : {
                        msg : '游戏结束！！！恭喜！！！ 卧底  ' + onlineUsers[gameData.wdUserId].nickName + '走上了人生巅峰！！！'
                    }
                });
                su.emitToRoomAll({
                    action : 'notice',
                    data : {
                        msg : '卧底的词：' + gameData.wdWord + ',,平民的词：' + gameData.pmWord,
                        startFlag : 0
                    }
                });
                clearData();
            } else {
                roundData = {
                    waitDescUsers : roundData.waitDescUsers,
                    waitVoteUsers : roundData.waitDescUsers,
                    descedContent :  {},
                    hasDescedUsers : [],
                    hasVotedUsers : [],
                    votedUsers : {},
                    descId : roundData.descId,
                    round : roundData.round++
                };
                // 游戏继续
                su.emitToRoomAll({
                    action : 'notice',
                    data : {
                        msg : onlineUsers[roundData.descId].nickName + '开始发言！！！'
                    }
                });

                gameData.descFlag = 1;
            }

        };

        function clearData() {

            for (var id in onlineUsers) {
                if (id != gameData.zcUserId) {
                    onlineUsers[id].type = 1;
                }
            }

            gameData = {
                flag : 0,
                descFlag : 0,
                wdUserId : '',
                zcUserId : '',
                wdWord : '',
                pmWord : ''
            };
            roundData = {
                waitDescUsers : [],
                hasDescedUsers : [],
                hasVotedUsers : [],
                votedUsers : {},
                descId : '',
                round : 0
            };

        }

        /**
         * 指定范围随机数
         * @param min
         * @param max
         * @returns {Number}
         */
        function getRandomNum(min, max) {
            return parseInt(Math.random() * (max - min + 1) + min, 10);
        }

        /**
         * 按顺序下一个描述人Id
         * @returns {*}
         */
        function getDescId() {
            var index = roundData.waitDescUsers.indexOf(roundData.descId);
            var nextIndex = (index + 1) > (roundData.waitDescUsers.length - 1) ? 0 : (index + 1);
            roundData.descId = roundData.waitDescUsers[nextIndex];
        }

        socket.on('sendToPerson', function (rs) {
            var userId = rs.userId,
                desId = rs.desId,
                msg = rs.msg;

            if (onlineUsers[userId].type != 2 || !onlineUsers[desId]) {
                return;
            }

            su.emitToPerson({
                userId : onlineUsers[desId].socketId,
                action : 'warning',
                data : {
                    msg : msg
                }
            });
        });

    });

};

module.exports = chatRoom;