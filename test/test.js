/**
 * 测试
 */

var should = require('should');
var async = require('async');
var Model = require('../');

var MySQLPool = require('lei-mysql');
var db = new MySQLPool({
  host:     'localhost',
  port:     3306,
  database: 'test',
  user:     'root',
  password: '',
  pool:     '2'
});

var TABLE = 'test';
var INIT_COUNT = 100;

function createModel (options) {
  options = options || {};
  options.table = TABLE;
  options.connection = db;
  if (!options.limit) options.limit = INIT_COUNT + 1;
  return Model.create(options);
}


describe('Simple MySQL Model', function () {

  it('#dropTable', function (done) {
    db.dropTable(TABLE, function (err, info) {
      should.equal(err, null);
      done();
    });
  });

  it('#createTable', function (done) {
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
    });
  });

  it('#insert random data', function (done) {
    var lines = [];
    for (var i = 0; i < INIT_COUNT; i++) {
      lines.push({value: Math.random(), timestamp: db.timestamp() + i});
    }
    db.insert(TABLE, lines, done);
  });

  it('#get & list & count', function (done) {
    var model = createModel({
      fields: {
        id: 'number',
        value: 'number',
        timestamp: 'number'
      }
    });
    async.series([
      function (next) {
        model.get({id: 1}, function (err, item) {
          should.equal(err, null);
          item.id.should.equal(1);
          next();
        });
      },
      function (next) {
        model.list({}, {}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(INIT_COUNT);
          next();
        });
      },
      function (next) {
        model.list({id: 3}, {}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(1);
          next();
        });
      },
      function (next) {
        model.list({}, {limit: 10}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(10);
          next();
        });
      },
      function (next) {
        model.list({}, {offset: 10, order: [['id', 'asc']]}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(INIT_COUNT - 10);
          list[0].id.should.equal(11);
          list[1].id.should.equal(12);
          next();
        });
      },
      function (next) {
        model.list({}, {offset: 10, order: [['id', 'desc']]}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(INIT_COUNT - 10);
          list[0].id.should.equal(INIT_COUNT - 10);
          list[1].id.should.equal(INIT_COUNT - 11);
          next();
        });
      },
      function (next) {
        model.list({}, {limit: 20, offset: 10, order: 'id:asc'}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(20);
          list[0].id.should.equal(11);
          list[1].id.should.equal(12);
          next();
        });
      },
      function (next) {
        model.list({}, {limit: 20, offset: 10, order: 'id:desc'}, function (err, list) {
          should.equal(err, null);
          list.length.should.equal(20);
          list[0].id.should.equal(INIT_COUNT - 10);
          list[1].id.should.equal(INIT_COUNT - 11);
          next();
        });
      },
      function (next) {
        model.count({}, function (err, count) {
          should.equal(err, null);
          count.should.equal(INIT_COUNT);
          next();
        });
      },
      function (next) {
        model.count({id: 2}, function (err, count) {
          should.equal(err, null);
          count.should.equal(1);
          next();
        });
      }
    ], done);
  });

});
