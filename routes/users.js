var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/a.htm', function(req, res, next) {
  console.log('filter : 4');
  res.send('respond with a resource a.htm');
});

module.exports = router;
