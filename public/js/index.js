$(function () {

    var windowHidden = !1;

    if (!("Notification" in window)) {
        alert('你的浏览器不支持通知！');
    }

    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    window.onblur = function() {
        windowHidden = !0;
    };

    window.onfocus = function() {
        windowHidden = !1;
    };

    // 默认登录处理
    if (userId) {
        creatSocket();
    }

    //针对屏幕在414以下的做一些控制
    if(screen.width < 414 || screen.width == 414){
        $('.head').on('touchstart',function(){
            $(this).css('height','80px');
            $('.logo').fadeIn();
            $('.login').fadeIn();
            event.stopImmediatePropagation();
        });
        $('.left').on('touchstart',function(){
            $(this).css('left','-1px');
            event.stopImmediatePropagation();
        });
        $(document).on('touchstart',function(){
            $('.logo').fadeOut();
            $('.login').fadeOut();
            $('.head').css('height','-10px');
            $('.left').css('left','-235px');
        });
        $('.right').css('height',screen.height-100);
    }

    /**
     * 这里是登陆按钮
     */
    $('#login').on('click',function(){
        if (userId) {
            logOut();
        } else {
            if(screen.width > 414){
                var obj = $(this),
                    top = obj.offset().top,
                    left = obj.offset().left,
                    width = obj.width(),
                    height = obj.height();
                $('.AG_login').css({'top':top+height+10,'left':left-$('.AG_login').width()-15}).fadeToggle();//淡入：fadeIn() 淡出：fadeOut()
            }else{
                $('.AG_login').fadeToggle();
            }
        }

    });

    /**
     * 这里是点击登陆
     */
    $('#doLogin').on('click', function () {
        var userName = $('#userName').val();
        var passWord = $('#passWord').val();
        if (!!userName && !!passWord) {
            $.ajax({
                url : 'dologin',
                type : 'get',
                dataType : 'json',
                data : {
                    userName : userName,
                    passWord : passWord
                },
                success : function (rs) {
                    if (rs.flag == 1) {
                        afterLogin(rs);
                    } else {
                        alert(rs.reason);
                    }
                }
            });
        } else {
            alert('不能空。')
        }

    });

    /**
     * 登陆成功的逻辑
     * @param rs
     */
    function afterLogin(rs) {
        user = rs;
        userId = rs.pk_user_id;
        // 显示自己的昵称
        $('#login').html(rs.nick_name + '<em></em><em></em>').css({background : 'none'});
        $('.AG_login').fadeToggle();
        // 显示所有联系人
        creatSocket();
        // 显示左边的主持面板或者普通面板
        if (rs.user_type_id == 2) {
            $('.king').show();
        } else {
            $('.myword').show();
        }
    }

    function logOut() {
        var myDate = new Date();
        myDate.setTime(-1000);
        document.cookie = 'userId=; expires=' + myDate.toGMTString();
        location.reload();
    }

    /**
     * 查询所有联系人
     * @param func
     */
    function queryUserList(func) {
        $.ajax({
            url : 'queryuserlist',
            type : 'get',
            dataType : 'json',
            data : {
                userId : userId
            },
            success : function (rs) {
                var userList = rs.user;
                var html = '';
                if (userList && userList.length > 0) {
                    for (var i = 0; i < userList.length; i++) {
                        html += '<li style="display: none;" class="out" id="userId_' + userList[i].pk_user_id + '">' + userList[i].nick_name + '</li>';
                    }
                    $('#userList').html(html);

                    func();
                }

            }
        });
    }

    /**
     * 创建socket链接
     */
    function creatSocket() {
        initSocket(io());
    }

    /**
     * 按钮动画效果
     * @param obj
     */
    function btnAnimation(obj) {
        var obj = $(obj);
        obj.css({'-webkit-animation' : 'twinkling 0.2s 3 ease-in-out'});
        setTimeout(function () {
            obj.css({'-webkit-animation' : ''});
        }, 500);
    }

    /**
     * socket开始了
     * @param cio
     */
    function initSocket(cio) {

        window.sendToPerson = function(id, msg) {
            cio.emit('sendToPerson', {
                userId : userId,
                desId : id,
                msg : msg
            });
        };

        cio.on('warning', function(msg) {
            alert(msg.msg);
        });

        // 链接监视
        cio.on('connection', function (rs) {
            rs.flag == 1 ? console.log('链接socket服务器成功') : console.log('链接socket服务器失败');
        });

        // 监控系统消息
        cio.on('notice', function (rs) {
            rs.msg && appendSystemNotice(rs.type, rs.msg);
            if (rs.onlineUsers) {
                var html = '';
                // $('#userList li').attr({class : 'out'}).hide();
                for (var id in rs.onlineUsers) {
                    var user = rs.onlineUsers[id];
                    html += '<li class="'
                        + (function() {
                            if (user.type == 2) {
                                return 'king';
                            } else if (user.type == 3) {
                                return 'die';
                            } else {
                                return '';
                            }
                        })()
                        + '" id="userId_' + user.userId + '">' + user.nickName + '</li>';


                    /*if (rs.onlineUsers[id].type == 2) {
                        $('#userId_' + id).attr({class : 'king'});
                    } else if (rs.onlineUsers[id].type == 3) {
                        $('#userId_' + id).attr({class : 'die'});
                    } else {
                        $('#userId_' + id).attr({class : ''});
                    }*/
                }
                $('#userList').html(html);
            }
            if (rs.readyToVote == 1) {
                $('#userList li[class=online]').addClass('canchoose').on('click', function () {
                    var obj = this;
                    cio.emit('vote', {
                        votedId : obj.id.split('_')[1]
                    })
                });
            } else if (rs.readyToVote == 0) {
                $('#userList li').removeClass('canchoose').unbind('click');
            }
            if (rs.startFlag == 1) {
                $('#userList li[class=""]').addClass('online');
            } else if (rs.startFlag == 0) {
                $('#userList li').removeClass('online');
            }
        });

        // 监控聊天内容
        cio.on('chatMsg', function (rs) {
            if (rs.msg) {
                appendTalkL(rs);
            }
        });

        // 发送消息
        $("#txtSend").on('keyup', function (e) {
            if (e.keyCode == 13) { //回车键
                send();
            }
        });

        function send() {
            var text = $("#txtSend").val();
            if (!(text.replace(/(^\s*)|(\s*$)/g, ''))) {
                return;
            }
            var data = (typeof user == 'string') ? JSON.parse(user) : user;

            cio.emit('chatMsg', {
                userId : userId,
                msg : text
            });

            data.msg = text;

            appendTalkR(data);
            $("#txtSend").val('');
        }

        // 游戏相关
        $('#startGame').on('click', function () {
            btnAnimation(this);
            cio.emit('gameStart', {
                wdWord : $('#wdWord').val(),
                pmWord : $('#pmWord').val(),
                zcUserId : userId
            });
        });

        // 游戏相关
        $('#startNumGame').on('click', function () {
            btnAnimation(this);
            cio.emit('NumGameStart', {
                startNum : $('#startNum').val(),
                endNum : $('#endNum').val(),
                zcUserId : userId
            });
        });

        cio.on('outyou', function() {
            var myDate = new Date();
            myDate.setTime(-1000);
            document.cookie = 'userId=; expires=' + myDate.toGMTString();
            alert('你已经再别处登录了，不允许重复登录');
            location.reload();
        });

        cio.on('error', function(rs) {
            if (rs == 'repeat login err') {
                var myDate = new Date();
                myDate.setTime(-1000);
                document.cookie = 'userId=; expires=' + myDate.toGMTString();
                alert('你已经再别处登录了，不允许重复登录');
                location.reload();
            }
        });

        cio.on('randomNum', function(rs) {
            rs.randomNum && $('#randomNum').val(rs.randomNum);
        });

        // 收到的词
        cio.on('gameWord', function (rs) {
            if (rs.word) {
                $('#yourWord').val(rs.word);
            }
            if (rs.wdName) {
                $('#wdName').val(rs.wdName);
            }
        });

        //开始描述
        $('.startTalk').on('click', function () {
            btnAnimation(this);
            cio.emit('describe', {flag : 1});
        });

        // // 投票了
        // $('#userList').on('click', 'li[class=online]', function () {
        //
        // });
    }


    /**
     * 展示系统消息
     * @param msg
     */
    function appendSystemNotice(type, msg) {
        windowHidden && new Notification('系统消息：', {
            body : msg,
            icon : '/image/notice.jpg',
            tag : 'notice'
        });
        !(type && type == 1) && (msg = '系统消息：' + msg);
        $('.talk').append('<div class="system"><span>' + msg + '</span></div>');
        adjustMsg();
    }

    /**
     * 好友的消息
     */
    function appendTalkL(rs) {
        windowHidden && new Notification(rs.nickName + '：', {
            body : rs.msg,
            icon : '/image/' + rs.headImg + '.jpg',
            tag : 'msg'
        });
        var html = '<div class="talk-main-left"><div class="T-head TH-left"><div class="T-head-little" style="background: '
            + 'url(\'/image/' + rs.headImg + '.jpg\') no-repeat; -webkit-background-size:100% 100% ;'
            + '"></div></div><div class="T-word TW-left" style="'
            + rs.style
            + '"><p>'
            + rs.nickName
            + '：</p><span>'
            + rs.msg
            + '</span></div></div>';
        $('.talk').append(html);
        adjustMsg();
    }

    /**
     * 自己的消息
     * @param rs
     */
    function appendTalkR(rs) {
        var html = '<div class="talk-main-right"><div class="T-head TH-right"><div class="T-head-little" style="background: '
            + 'url(\'/image/' + rs.headImg + '.jpg\') no-repeat; -webkit-background-size:100% 100% ;'
            + '"></div></div><div class="T-word TW-right" style="'
            + rs.style
            + '"><p>'
            + rs.nick_name
            + '：</p><span>'
            + rs.msg
            + '</span></div></div>';
        $('.talk').append(html);
        adjustMsg();
    }

    /**
     *  自动滚动到底部
     */
    function adjustMsg() {
        var box = document.getElementById('msgBox');
        box.scrollTop = box.scrollHeight;
    }
});

