/**
 * 测试
 */

var should = require('should');
var async = require('async');

var MySQLPool = require('../');
var db = new MySQLPool({
  host:     'localhost',
  port:     3306,
  database: 'test',
  user:     'root',
  password: '',
  pool:     '2'
});

var TABLE = 'test';


describe('Simple MySQL Model', function () {

  var INIT_COUNT = 10;

  it('dropTable', function (done) {
    db.dropTable(TABLE, function (err, info) {
      should.equal(err, null);
      done();
    })
  });

  it('createTable', function (done) {
    db.createTable(TABLE, {
      id: {
        type: 'int',
        autoIncrement: true
      },
      value: {
        type: 'double',
        default: 0
      },
      timestamp: 'int'
    }, [
      {fields: 'id', primary: true}
    ], function (err, info) {
      should.equal(err, null);
      done();
    })
  });

  it('insert random data', function (done) {
    var lines = [];
    for (var i = 0; i < INIT_COUNT; i++) {
      lines.push({value: Math.random(), timestamp: db.timestamp() + i});
    }
    db.insert(TABLE, lines, done);
  });

});
