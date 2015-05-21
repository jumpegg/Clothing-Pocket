var express = require('express');
var router = express.Router();
var fs = require('fs');
var db_user = require('../models/db_user.js');
var async = require('async');
var multer = require('multer');
var logger = require('../logger');

router.get('/img/:IMG_NAME', function (req, res) {
    var imgName = req.params.IMG_NAME;
    var img = fs.readFileSync('./public/images/profile/' + imgName);
    res.writeHead(200, {'Content-Type': 'image/png'});
    res.end(img, 'binary');
});

router.use(multer({
    dest: './public/images/profile',
    rename: function (fieldname, filename) {
        return filename.toLowerCase() + Date.now();
    }
}));

router.post('/profile/update', function (req, res, next) {
    logger.info('req.files', req.files);

    var profile = req.files;
    var filename = profile.file.name;
    var filePath = 'http://52.68.143.198/user/img/' + filename;
    var nickname = req.session.nickname;
    var datas = [filePath, nickname];

    if (JSON.stringify(profile) == '{}') {
        logger.info('modifiedItemUploadFileNull');
        res.json({"result": 'itemUploadFileNull'});
    } else {
        logger.info('modifiedItemUploadOK');
        db_user.profileUpdate(datas, function (success) {
            if (success) {
                logger.info('/admin/add success');
                res.json({"Result": "ok"});
            } else {
                logger.info('/admin/add fail');
                res.json({"Result": "fail"});
            }
        });
    }
});


//일반 회원 가입
router.post('/join', function (req, res, next) {
    logger.info('req.body', req.body);

    var id = req.body.id;
    var passwd = req.body.passwd;
    var nickname = req.body.nickname;
    var gender = req.body.gender;
    var datas = [nickname, id, passwd, gender];

    async.waterfall([
        function (callback) {
            if (!id) {
                logger.error('/user/join idNull');
                callback(null, 0);
            } else if (!passwd) {
                logger.error('/user/join passwdNull');
                callback(null, 1);
            } else if (!nickname) {
                logger.error('/user/join nickNull');
                callback(null, 2);
            } else if (!gender) {
                logger.error('/user/join passwdNull');
                callback(null, 3);
            } else {
                callback(null, 4);
            }
        }, function (errNum, callback) {
            if (errNum == 0) {
                callback(null, "idNull");
            } else if (errNum == 1) {
                callback(null, "passwdNull");
            } else if (errNum == 2) {
                callback(null, "nickNull");
            } else if (errNum == 3) {
                callback(null, "genderNull");
            } else if (errNum == 4) {
                db_user.join(datas, function (flag, success) {
                    if (success) {
                        callback(null, "ok");
                    } else {
                        //flag=0
                        if (flag == 0) {
                            logger.error('회원가입 실패(아이디 중복)');
                            callback(null, "idDuplicated");
                        } else if (flag == 1) {
                            logger.error('회원가입 실패(닉네임 중복)');
                            callback(null, "nickDuplicated");
                        } else if (flag == 2) {
                            logger.error('회원가입 실패(커넥션 에러)');
                            callback(null, "connError");
                        } else if (flag == 3) {
                            logger.error('회원가입 실패(커넥션 쿼리 에러)');
                            callback(null, "connQueryError");
                        }
                    }
                });
            }
        }
    ], function (err, Msg) {
        if (Msg == "ok") {
            logger.info('회원가입 성공');
            req.session.nickname = nickname;
            res.json({"Result": "ok"});
        } else {
            res.json({"Result": Msg});
        }
    });
});

router.post('/fb', function (req, res, next) {
    logger.info('req.body', req.body);
    var access_token = req.body.accessToken;
    var push_id = req.body.pushId;
    var datas = [access_token, push_id];

    if (!access_token) {
        logger.error('/user/fb accessTokenNull');
        res.json({"Result": "accessTokenNull"});
    } else {
        db_user.fb(datas, function (flag, success, data) {
            if (success) {
                logger.info('페이스북 로그인');
                req.session.nickname = data;
                res.json({"Result": "ok"});
            } else {
                if (flag == 0) {
                    logger.info('/user/fb error');
                    res.json({"Result": "fail"});
                } else {
                    logger.info('/user/fb ->fbjoin');
                    req.session.nickname = data;
                    req.session.pushId = push_id;
                    res.json({"Result": "fbjoin"});
                    logger.info('data ', req.session.datas);
                }
            }
        });
    }
});

//페이스북 회원가입
router.post('/fbjoin', function (req, res, next) {
    var nickname = req.body.nickname;
    var datas = req.session.datas;
    datas.push(nickname);
    logger.info('req.session.datas ', datas);
    // datas = [facebook_id, join_path, gender, nickname];

    if (!nickname) {
        logger.error('/user/fbjoin nicknameNull');
        res.json({"Result": "nicknameNull"});
    } else if (!datas) {
        logger.error('/user/fbjoin sessionDataNull');
        res.json({"Result": "sessionDataNull"});
    } else {
        db_user.fbjoin(datas, function (success, flag) {
            if (success) {
                logger.info('/user/fbjoin success');
                req.session.nickname = nickname;
                res.json({"Result": "ok"});
            } else {
                req.session.datas.pop();
                if (flag == 0) {
                    logger.info('/user/fbjoin error');
                    res.json({"Result": "conn.queryError"});
                } else if (flag == 1) {
                    logger.info('/user/fbjoin idDuplicated');
                    res.json({"Result": "idDuplicated"});
                } else if (flag == 2) {
                    logger.info('/user/fbjoin conn.queryError');
                    res.json({"Result": "conn.queryError"});
                } else {
                    logger.info('/user/fbjoin nickDuplicated');
                    res.json({"Result": "nickDuplicated"});
                }
            }
        });
    }
});

router.post('/login', function (req, res, next) {
    logger.info('req.body', req.body);
    var id = req.body.id;
    var passwd = req.body.passwd;
    var push_id = req.body.pushId;
    var datas = [id, passwd, push_id];

    db_user.login(datas, function (success, nickname) {
        if (success) {
            logger.info('/user/login success');
            req.session.nickname = nickname;
            req.session.pushId = push_id;
            res.json({"Result": "ok"});
        } else {
            logger.info('/user/login fail');
            res.json({"Result": "fail"});
        }
    })
});

router.post('/logout', function (req, res, next) {
    req.session.destroy(function (err) {
        if (err) {
            logger.error('/user/logout error ', err);
            res.json({"Result": "fail"});
        } else {
            logger.info('/user/logout success');
            res.json({"Result": "ok"});
        }
    });
});

router.post('/update', function (req, res, next) {
    logger.info('/user/update req.session.nickname ', req.session.nickname);
    var nickname = req.session.nickname;
    db_user.update(nickname, function (success, rows) {
        if (success) {
            logger.error('/user/update success');
            res.json({"id": rows[0].USER_ID, "nickname": rows[0].USER_NICKNAME});
        } else {
            logger.error('/user/update error');
            res.json({"Result": "fail"});
        }
    });
});

router.post('/update/password', function (req, res, next) {
    logger.info('req.session.nickname ', req.session.nickname);
    logger.info('req.body ', req.body);
    var nickname = req.session.nickname;
    var current_passwd = req.body.currentPasswd;
    var new_passwd = req.body.newPasswd;
    var new_passwd2 = req.body.newPasswd2;

    if (new_passwd != new_passwd2) {
        logger.error('/update/passwd new_passwd!=new_passwd2');
        res.json({"Result": "newPasswdMatchError"});
    } else {
        logger.info('/update/passwd new_passwd==new_passwd2');
        var datas = [nickname, current_passwd, new_passwd];
        db_user.changepasswd(datas, function (success) {
            if (success) {
                logger.info('/update/passwd success');
                res.json({"Result": "ok"});
            } else {
                logger.info('/update/passwd fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

router.post('/profile/add', function (req, res, next) {
    res.json({"Result": "ok"});
});

router.post('/search', function (req, res, next) {
    logger.info('req.body ', req.body.searchWord);
    var word = req.body.searchWord + '%';

    if (!word) {
        logger.error('/user/search searchWordNull');
        res.json({"Result": "searchWordNull"});
    } else {
        db_user.userSearch(word, function (success, datas) {
            if (success) {
                logger.info('/user/search success');
                res.json({"searchUserList": datas});
            } else {
                logger.error('/user/search fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

router.post('/alarm', function (req, res, next) {
    var nickname = req.session.nickname;

    if (!nickname) {
        logger.error('/user/alarm nicknameNull');
        res.json({"Result": "nicknameNull"});
    } else {
        db_user.alarm(nickname, function (success, alarms) {
            if (success) {
                logger.info('/user/alarm success');
                res.json({"alarm": alarms});
            } else {
                logger.info('/user/alarm fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

router.post('/alarm/del', function (req, res, next) {
    var alarm_num = req.body.alarmNum;
    var nickname = req.session.nickname;
    var datas = [nickname, alarm_num];

    if (!datas) {
        logger.error('/user/alarm/del dataNull');
        res.json({"Result": "dataNull"});
    } else {
        db_user.alarmDel(datas, function (success) {
            if (success) {
                logger.info('/user/alarm/del success');
                res.json({"Result": "ok"});
            } else {
                logger.info('/user/alarm/del fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

router.post('/alarm/del/all', function (req, res, next) {
    var nickname = req.session.nickname;

    if (!nickname) {
        logger.error('/user/alarm/del nicknameNull');
        res.json({"Result": "nicknameNull"});
    } else {
        db_user.alarmDelAll(nickname, function (success) {
            if (success) {
                logger.info('/user/alarm/del/all success');
                res.json({"Result": "ok"});
            } else {
                logger.info('/user/alarm/del/all fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

router.post('/personal/submit', function (req, res, next) {
    var nickname = req.session.nickname;

    if (!nickname) {
        logger.error('/user/personal/submit nicknameNull');
        res.json({"Result": "nicknameNull"});
    } else {
        db_user.personalAlarmSubmit(nickname, function (success) {
            if (success) {
                logger.info('/user/personal/submit success');
                res.json({"Result": "ok"});
            } else {
                logger.info('/user/personal/submit fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

router.post('/personal', function (req, res, next) {
    var nickname = req.session.nickname;

    if (!nickname) {
        logger.error('/user/personal nicknameNull');
        res.json({"Result": "nicknameNull"});
    } else {
        db_user.personalAlarm(nickname, function (success, flag) {
            if (success) {
                logger.info('/user/personal success');
                res.json({"alarmStatus": flag});
            } else {
                logger.info('/user/personal fail');
                res.json({"Result": "fail"});
            }
        });
    }
});

module.exports = router;